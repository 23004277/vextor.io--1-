import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  signInWithPopup,
  updateProfile
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  limit,
  where,
  onSnapshot,
  DocumentSnapshot
} from 'firebase/firestore';
import { db, auth, googleProvider } from './FirebaseConfig';
import { AuthResponse, User, UserStats, Achievement, Quest, TankClass, HighScoreEntry } from '../types';
import { SHOP_ITEMS, ACHIEVEMENTS, QUESTS } from '../constants';

// ─── Session persistence key ────────────────────────────────────────────────
const SESSION_KEY = 'vextor_session_token';

// ─── In-flight Firestore fetch deduplication ────────────────────────────────
// Prevents loginWithGoogle() and getSession() from racing each other with two
// simultaneous getDoc calls for the same UID.
const pendingProfileFetches = new Map<string, Promise<DocumentSnapshot>>();

// ─── Throttle repeated timeout warnings so the console is not flooded ───────
let lastSessionWarningTime = 0;
const SESSION_WARNING_THROTTLE_MS = 5000;

// ─── Initial stats for new users ────────────────────────────────────────────
const INITIAL_STATS: UserStats = {
  totalGames: 0,
  totalScore: 0,
  highScore: 0,
  maxLevel: 1,
  totalKills: 0,
  totalDeaths: 0,
  eliteKills: 0,
  transformations: 0,
  highestEliteDamage: 0,
  achievementsUnlocked: [],
  questsUnlocked: []
};

const SUPPORTER_RANKS = new Set(['standard', 'rank1', 'rank2', 'rank3']);
const SHOP_ITEM_IDS = new Set(SHOP_ITEMS.map((item) => item.id));
const TANK_CLASS_VALUES = new Set(Object.values(TankClass) as TankClass[]);
const SECURITY_LOG_KEY = 'vextor_security_log';
const RATE_LIMIT_STATE_KEY = 'vextor_rate_limit_state';
const SCORE_GUARD_KEY = 'vextor_score_guard';
const OPERATION_COOLDOWNS_MS = {
  stats: 1800,
  purchase: 700,
  equip: 250,
  support: 900,
  score: 1800,
  callsign: 1500,
} as const;
const RATE_LIMIT_RULES = {
  authLogin: { maxEvents: 5, windowMs: 60_000, penaltyMs: 120_000 },
  authRegister: { maxEvents: 3, windowMs: 60_000, penaltyMs: 180_000 },
  authGoogle: { maxEvents: 4, windowMs: 60_000, penaltyMs: 90_000 },
  sessionRestore: { maxEvents: 8, windowMs: 60_000, penaltyMs: 45_000 },
  statsWrite: { maxEvents: 4, windowMs: 45_000, penaltyMs: 90_000 },
  purchase: { maxEvents: 6, windowMs: 30_000, penaltyMs: 60_000 },
  equip: { maxEvents: 14, windowMs: 12_000, penaltyMs: 30_000 },
  support: { maxEvents: 4, windowMs: 30_000, penaltyMs: 75_000 },
  scoreSubmit: { maxEvents: 3, windowMs: 90_000, penaltyMs: 120_000 },
  callsign: { maxEvents: 3, windowMs: 60_000, penaltyMs: 180_000 },
} as const;
const MAX_SESSION_SCORE = 25_000_000;
const MAX_SESSION_LEVEL = 200;
const MAX_SESSION_KILLS = 5_000;
const MAX_SESSION_ELITE_KILLS = 250;
const MAX_SESSION_TRANSFORMATIONS = 50;
const MAX_SESSION_ELITE_DAMAGE = 25_000_000;
const MAX_SUPPORT_CONTRIBUTION = 100;
const MAX_ACCOUNT_CURRENCY = 25_000_000;
const MAX_SUPPORT_TOTAL = 10_000_000;
const MAX_TOTAL_CURRENCY_REWARD = 500_000;
const SCORE_GUARD_WINDOW_MS = 10 * 60_000;
const SCORE_GUARD_HISTORY_LIMIT = 12;
const operationWindows = new Map<string, number>();
const rateLimitMemory = new Map<string, { hits: number[]; blockedUntil: number }>();

// ─── Firestore custom error reporting ───────────────────────────────────────

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createTimeoutError(code: string, message: string): Error & { code: string } {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  return err;
}

/**
 * Races a promise against a timeout. After the timeout fires, any later
 * resolution or rejection from the original promise is silently swallowed —
 * this prevents a second console error from the same logical operation.
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutCode: string,
  timeoutMessage: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;

  // Wrap the original promise so post-cancellation outcomes are ignored.
  const wrapped = promise.then(
    (val) => {
      if (cancelled) return new Promise<T>(() => {});
      return val;
    },
    (err) => {
      if (cancelled) return new Promise<T>(() => {});
      throw err;
    }
  );

  try {
    return await Promise.race([
      wrapped,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          cancelled = true;
          reject(createTimeoutError(timeoutCode, timeoutMessage));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Emits a console.error at most once per SESSION_WARNING_THROTTLE_MS window.
 * Prevents console flooding when Firestore times out on repeated session checks.
 */
function throttledAuthWarning(message: string, err: unknown): void {
  const now = Date.now();
  if (now - lastSessionWarningTime > SESSION_WARNING_THROTTLE_MS) {
    lastSessionWarningTime = now;
    console.error(message, err);
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function clampInt(value: unknown, min: number, max: number, fallback = min): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function sanitizeCallsign(value: unknown, fallback = 'PILOT_UNIT'): string {
  const cleaned = String(value ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9_ -]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 18);
  return cleaned || fallback;
}

function logSecurityEvent(type: string, detail: Record<string, unknown>): void {
  const payload = { type, detail, at: new Date().toISOString() };
  console.warn('[Security]', payload);
  if (typeof window === 'undefined') return;
  try {
    const current = JSON.parse(localStorage.getItem(SECURITY_LOG_KEY) || '[]');
    const next = Array.isArray(current) ? current.slice(-24) : [];
    next.push(payload);
    localStorage.setItem(SECURITY_LOG_KEY, JSON.stringify(next.slice(-25)));
  } catch {
    // Ignore local telemetry persistence failures.
  }
}

function beginOperationWindow(scope: keyof typeof OPERATION_COOLDOWNS_MS, actorId: string): boolean {
  const key = `${scope}:${actorId}`;
  const now = Date.now();
  const until = operationWindows.get(key) || 0;
  if (until > now) return false;
  operationWindows.set(key, now + OPERATION_COOLDOWNS_MS[scope]);
  return true;
}

function loadRateLimitState(): void {
  if (typeof window === 'undefined') return;
  if (rateLimitMemory.size > 0) return;
  try {
    const raw = localStorage.getItem(RATE_LIMIT_STATE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, { hits?: number[]; blockedUntil?: number }>;
    const now = Date.now();
    for (const [key, value] of Object.entries(parsed || {})) {
      if (!value || !Array.isArray(value.hits)) continue;
      const hits = value.hits.filter((hit): hit is number => typeof hit === 'number' && Number.isFinite(hit) && hit > now - (10 * 60_000));
      const blockedUntil = typeof value.blockedUntil === 'number' && Number.isFinite(value.blockedUntil) ? value.blockedUntil : 0;
      if (hits.length > 0 || blockedUntil > now) rateLimitMemory.set(key, { hits, blockedUntil });
    }
  } catch {
    // Ignore persistence corruption and rebuild from memory.
  }
}

function persistRateLimitState(): void {
  if (typeof window === 'undefined') return;
  try {
    const now = Date.now();
    const payload: Record<string, { hits: number[]; blockedUntil: number }> = {};
    for (const [key, value] of rateLimitMemory.entries()) {
      const hits = value.hits.filter((hit) => hit > now - (10 * 60_000));
      const blockedUntil = value.blockedUntil > now ? value.blockedUntil : 0;
      if (hits.length === 0 && blockedUntil === 0) continue;
      payload[key] = { hits, blockedUntil };
    }
    localStorage.setItem(RATE_LIMIT_STATE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore persistence failures; in-memory limiting still works this session.
  }
}

function consumeRateLimit(scope: keyof typeof RATE_LIMIT_RULES, actorId: string): { ok: boolean; retryAfterMs: number } {
  loadRateLimitState();
  const now = Date.now();
  const key = `${scope}:${actorId}`;
  const rule = RATE_LIMIT_RULES[scope];
  const current = rateLimitMemory.get(key) || { hits: [], blockedUntil: 0 };
  const recentHits = current.hits.filter((hit) => hit > now - rule.windowMs);

  if (current.blockedUntil > now) {
    rateLimitMemory.set(key, { hits: recentHits, blockedUntil: current.blockedUntil });
    persistRateLimitState();
    return { ok: false, retryAfterMs: current.blockedUntil - now };
  }

  recentHits.push(now);
  if (recentHits.length > rule.maxEvents) {
    const blockedUntil = now + rule.penaltyMs;
    rateLimitMemory.set(key, { hits: recentHits, blockedUntil });
    persistRateLimitState();
    return { ok: false, retryAfterMs: rule.penaltyMs };
  }

  rateLimitMemory.set(key, { hits: recentHits, blockedUntil: 0 });
  persistRateLimitState();
  return { ok: true, retryAfterMs: 0 };
}

function rateLimitMessage(retryAfterMs: number, fallback: string): string {
  const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return `${fallback} Try again in ${seconds}s.`;
}

function sanitizeUnlockedEliteSkins(unlockedSkins: TankClass[]): TankClass[] {
  return Array.from(new Set((Array.isArray(unlockedSkins) ? unlockedSkins : []).filter((skin): skin is TankClass => TANK_CLASS_VALUES.has(skin))));
}

function isEliteSkinId(itemId: string): itemId is `elite_skin_${string}` {
  return itemId.startsWith('elite_skin_');
}

function eliteSkinIdToClass(itemId: string): TankClass | null {
  if (!isEliteSkinId(itemId)) return null;
  const raw = itemId.slice('elite_skin_'.length);
  return TANK_CLASS_VALUES.has(raw as TankClass) ? (raw as TankClass) : null;
}

function sanitizeInventory(inventory: unknown): string[] {
  const values = Array.isArray(inventory) ? inventory : ['color_default'];
  const next = Array.from(new Set(values.filter((item): item is string => typeof item === 'string' && SHOP_ITEM_IDS.has(item))));
  return next.length > 0 ? next : ['color_default'];
}

function sanitizeSessionStats(gameData: Partial<UserStats>): Partial<UserStats> {
  const totalGames = clampInt(gameData.totalGames, 0, 1, 0);
  const totalScore = clampInt(gameData.totalScore, 0, MAX_SESSION_SCORE, 0);
  const totalKills = clampInt(gameData.totalKills, 0, MAX_SESSION_KILLS, 0);
  const eliteKills = clampInt(gameData.eliteKills, 0, Math.min(MAX_SESSION_ELITE_KILLS, totalKills), 0);
  const transformations = clampInt(
    gameData.transformations,
    0,
    totalGames > 0 ? Math.min(MAX_SESSION_TRANSFORMATIONS, 2) : 0,
    0
  );
  return {
    totalGames,
    totalScore,
    highScore: clampInt(gameData.highScore, 0, totalScore || MAX_SESSION_SCORE, 0),
    maxLevel: clampInt(gameData.maxLevel, 1, MAX_SESSION_LEVEL, 1),
    totalKills,
    totalDeaths: clampInt(gameData.totalDeaths, 0, totalGames > 0 ? 1 : 0, 0),
    eliteKills,
    transformations,
    highestEliteDamage: clampInt(gameData.highestEliteDamage, 0, MAX_SESSION_ELITE_DAMAGE, 0),
  };
}

function deriveCurrencyRewardFromSession(gameData: Partial<UserStats>): number {
  const scoreReward = Math.floor((gameData.totalScore || 0) / 100);
  const killReward = (gameData.totalKills || 0) * 10;
  const eliteReward = (gameData.eliteKills || 0) * 100;
  return clampInt(scoreReward + killReward + eliteReward, 0, MAX_TOTAL_CURRENCY_REWARD, 0);
}

function describeSessionAnomalies(rawGameData: Partial<UserStats>, sanitizedSession: Partial<UserStats>): string[] {
  const issues: string[] = [];
  if ((rawGameData.totalGames || 0) > 1) issues.push('multi_game_payload');
  if ((rawGameData.totalDeaths || 0) > 1) issues.push('multi_death_payload');
  if ((rawGameData.highScore || 0) > (sanitizedSession.totalScore || 0) && (sanitizedSession.totalScore || 0) > 0) issues.push('high_score_exceeds_session_score');
  if ((rawGameData.eliteKills || 0) > (rawGameData.totalKills || 0)) issues.push('elite_kills_exceed_total_kills');
  if ((rawGameData.transformations || 0) > 2) issues.push('excess_transformations');
  return issues;
}

type ScoreGuardEntry = {
  actorId: string;
  signature: string;
  at: number;
};

function loadScoreGuardEntries(): ScoreGuardEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SCORE_GUARD_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const now = Date.now();
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is ScoreGuardEntry =>
        !!entry &&
        typeof entry.actorId === 'string' &&
        typeof entry.signature === 'string' &&
        typeof entry.at === 'number' &&
        Number.isFinite(entry.at) &&
        entry.at > now - SCORE_GUARD_WINDOW_MS
      )
      .slice(-SCORE_GUARD_HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function persistScoreGuardEntries(entries: ScoreGuardEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SCORE_GUARD_KEY, JSON.stringify(entries.slice(-SCORE_GUARD_HISTORY_LIMIT)));
  } catch {
    // Ignore local persistence failures.
  }
}

function buildScoreSubmissionSignature(actorId: string, score: number, level: number, classType: TankClass): string {
  return `${actorId}|${score}|${level}|${classType}`;
}

function shouldBlockDuplicateScoreSubmission(actorId: string, score: number, level: number, classType: TankClass): boolean {
  const entries = loadScoreGuardEntries();
  const signature = buildScoreSubmissionSignature(actorId, score, level, classType);
  return entries.some((entry) => entry.actorId === actorId && entry.signature === signature);
}

function rememberScoreSubmission(actorId: string, score: number, level: number, classType: TankClass): void {
  const entries = loadScoreGuardEntries();
  entries.push({
    actorId,
    signature: buildScoreSubmissionSignature(actorId, score, level, classType),
    at: Date.now(),
  });
  persistScoreGuardEntries(entries);
}

function mapFirebaseAuthError(err: any): string {
  const code: string = err?.code || '';
  if (code === 'auth/unauthorized-domain') {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'your-domain';
    return `Google sign-in is blocked for this domain. Add "${host}" in Firebase Console -> Authentication -> Settings -> Authorized domains.`;
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'Google sign-in popup was closed before authentication completed.';
  }
  if (code === 'auth/cancelled-popup-request') {
    return 'Google sign-in was cancelled. Please try again.';
  }
  if (code === 'auth/operation-timeout') {
    return 'Authentication timed out. Please check your connection and try again.';
  }
  if (code === 'firestore/operation-timeout') {
    return 'Signed in, but profile sync timed out. Your progress will sync shortly.';
  }
  return err?.message || 'Authentication request failed.';
}

function mapEmailPasswordAuthError(err: any, mode: 'login' | 'register'): string {
  const code: string = err?.code || '';
  if (code === 'auth/invalid-email') return 'Invalid email format.';
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') return 'Incorrect email or password.';
  if (code === 'auth/user-not-found') return 'No account found for this email.';
  if (code === 'auth/email-already-in-use') return 'An account already exists for this email.';
  if (code === 'auth/weak-password') return 'Password is too weak. Use at least 6 characters.';
  if (code === 'auth/too-many-requests') return 'Too many attempts. Please wait and try again.';
  return err?.message || (mode === 'login' ? 'Login failed.' : 'Account creation failed.');
}

function resolveAuthEmail(input: string): string {
  const raw = input.toLowerCase().trim();
  if (raw.includes('@')) return raw;
  return `${raw}@vextor.io`;
}

function buildCleanUsername(displayName?: string | null, email?: string | null, fallback = 'PILOT'): string {
  return (displayName || email?.split('@')[0] || fallback)
    .replace(/[^a-zA-Z0-9_]/g, '')
    .substring(0, 12)
    .toUpperCase() || 'PILOT_UNIT';
}

/**
 * Writes (or merges) a user profile doc to Firestore in the background.
 * Never throws — callers must not depend on this completing.
 */
async function ensureUserProfileDoc(uid: string, profile: User): Promise<void> {
  const userDocPath = `users/${uid}`;
  try {
    console.log('[Firestore] ensureUserProfileDoc write start', userDocPath);
    await withTimeout(
      setDoc(doc(db, 'users', uid), { ...profile, createdAt: new Date().toISOString() }, { merge: true }),
      12000,
      'firestore/operation-timeout',
      'Firestore user profile ensure timed out.'
    );
    console.log('[Firestore] ensureUserProfileDoc write success', userDocPath);
  } catch (err) {
    console.error('[Firestore] ensureUserProfileDoc write failed', err);
  }
}

/**
 * Shared, deduplicated Firestore profile fetch.
 *
 * If a fetch for this UID is already in-flight (e.g. loginWithGoogle and
 * getSession both racing), the second caller joins the existing promise
 * instead of issuing a second getDoc. The map entry is cleared in finally
 * so the next fresh call after settlement always starts a new fetch.
 *
 * Timeout is 12 s — long enough for slow mobile connections but short enough
 * that the auth-only fallback path kicks in before the user notices a hang.
 */
function getOrFetchUserProfile(uid: string): Promise<DocumentSnapshot> {
  if (!pendingProfileFetches.has(uid)) {
    const fetchPromise = withTimeout(
      getDoc(doc(db, 'users', uid)),
      12000,
      'firestore/operation-timeout',
      'Firestore user profile fetch timed out.'
    ).finally(() => {
      pendingProfileFetches.delete(uid);
    });
    pendingProfileFetches.set(uid, fetchPromise);
  }
  return pendingProfileFetches.get(uid)!;
}

// ─── BackendService ───────────────────────────────────────────────────────────

export class BackendService {

  // ── Auth Methods ────────────────────────────────────────────────────────

  /**
   * Email / password login.
   * Auth success is returned immediately; Firestore profile fetch has a
   * 12 s window before falling back to an auth-only user so that a slow DB
   * never blocks the player entering the game.
   */
  static async login(username: string, password: string): Promise<AuthResponse> {
    const loginActor = resolveAuthEmail(username);
    const loginLimit = consumeRateLimit('authLogin', loginActor);
    if (!loginLimit.ok) {
      logSecurityEvent('auth_login_rate_limited', { actor: loginActor, retryAfterMs: loginLimit.retryAfterMs });
      return { success: false, error: rateLimitMessage(loginLimit.retryAfterMs, 'Login requests are cooling down.') };
    }
    try {
      const email = resolveAuthEmail(username);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      const fallbackUser: User = {
        username: buildCleanUsername(firebaseUser.displayName, firebaseUser.email, username),
        token: firebaseUser.uid,
        createdAt: new Date().toISOString(),
        currency: 0,
        inventory: ['color_default'],
        equippedItem: 'color_default',
        unlockedEliteSkins: [],
        supportTotal: 0,
        supporterRank: 'standard',
        stats: { ...INITIAL_STATS }
      };

      let userDoc: DocumentSnapshot;
      try {
        // Uses the shared in-flight cache — will reuse any concurrent fetch.
        userDoc = await getOrFetchUserProfile(firebaseUser.uid);
      } catch (err) {
        throttledAuthWarning('[Auth] Login Firestore read failed; returning auth-only fallback', err);
        // Sync profile in background — do not block login.
        ensureUserProfileDoc(firebaseUser.uid, fallbackUser).catch(() => {});
        localStorage.setItem(SESSION_KEY, JSON.stringify({ username: fallbackUser.username, uid: firebaseUser.uid }));
        return { success: true, user: fallbackUser };
      }

      if (!userDoc.exists()) {
        // Profile missing — create it in background and return fallback immediately.
        ensureUserProfileDoc(firebaseUser.uid, fallbackUser).catch(() => {});
        localStorage.setItem(SESSION_KEY, JSON.stringify({ username: fallbackUser.username, uid: firebaseUser.uid }));
        return { success: true, user: fallbackUser };
      }

      const completeUser = this.migrateUser(userDoc.data(), firebaseUser.uid);
      localStorage.setItem(SESSION_KEY, JSON.stringify({ username: completeUser.username, uid: firebaseUser.uid }));

      return {
        success: true,
        user: {
          username: completeUser.username,
          token: firebaseUser.uid,
          stats: completeUser.stats,
          createdAt: completeUser.createdAt,
          currency: completeUser.currency,
          inventory: completeUser.inventory,
          equippedItem: completeUser.equippedItem,
          unlockedEliteSkins: completeUser.unlockedEliteSkins,
          supportTotal: completeUser.supportTotal,
          supporterRank: completeUser.supporterRank
        }
      };
    } catch (err: any) {
      console.error('[Auth] Email login failure', err);
      return { success: false, error: mapEmailPasswordAuthError(err, 'login') };
    }
  }

  /**
   * New pilot registration.
   * Firebase Auth + displayName update happen synchronously; the Firestore
   * profile write fires in the background so a slow DB does not block the
   * new player from entering the game.
   */
  static async register(username: string, password: string): Promise<AuthResponse> {
    if (username.length < 3) return { success: false, error: 'Email or username must be at least 3 characters' };
    if (password.length < 6) return { success: false, error: 'Security key must be at least 6 characters' };
    const registerActor = resolveAuthEmail(username);
    const registerLimit = consumeRateLimit('authRegister', registerActor);
    if (!registerLimit.ok) {
      logSecurityEvent('auth_register_rate_limited', { actor: registerActor, retryAfterMs: registerLimit.retryAfterMs });
      return { success: false, error: rateLimitMessage(registerLimit.retryAfterMs, 'Registration requests are cooling down.') };
    }

    try {
      const email = resolveAuthEmail(username);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      await updateProfile(firebaseUser, { displayName: username });

      const newUserDoc: User = {
        username,
        token: firebaseUser.uid,
        createdAt: new Date().toISOString(),
        currency: 100, // Enlistment bonus
        inventory: ['color_default'],
        equippedItem: 'color_default',
        unlockedEliteSkins: [],
        supportTotal: 0,
        supporterRank: 'standard',
        stats: { ...INITIAL_STATS }
      };

      // Fire-and-forget — auth already succeeded; Firestore write must not
      // block the player or turn a successful registration into an error.
      ensureUserProfileDoc(firebaseUser.uid, newUserDoc).catch(() => {});

      localStorage.setItem(SESSION_KEY, JSON.stringify({ username, uid: firebaseUser.uid }));

      return {
        success: true,
        user: { ...newUserDoc, token: firebaseUser.uid }
      };
    } catch (err: any) {
      console.error('[Auth] Registration failure', err);
      return { success: false, error: mapEmailPasswordAuthError(err, 'register') };
    }
  }

  /**
   * Google Single Sign-On.
   * Popup has a 20 s hard limit. Firestore profile fetch uses the shared
   * in-flight cache (getOrFetchUserProfile) so if getSession() is running
   * concurrently for the same UID it joins this fetch rather than firing a
   * second one.
   */
  static async loginWithGoogle(): Promise<AuthResponse> {
    const googleActor = auth.currentUser?.uid || 'google_popup';
    const googleLimit = consumeRateLimit('authGoogle', googleActor);
    if (!googleLimit.ok) {
      logSecurityEvent('auth_google_rate_limited', { actor: googleActor, retryAfterMs: googleLimit.retryAfterMs });
      return { success: false, error: rateLimitMessage(googleLimit.retryAfterMs, 'Google sign-in is cooling down.') };
    }
    try {
      console.log('[Auth] Google popup sign-in start');
      const result = await withTimeout(
        signInWithPopup(auth, googleProvider),
        20000,
        'auth/operation-timeout',
        'Google sign-in popup timed out.'
      );
      const firebaseUser = result.user;
      console.log('[Auth] Google popup sign-in success', { uid: firebaseUser.uid, email: firebaseUser.email });

      const fallbackUser: User = {
        username: buildCleanUsername(firebaseUser.displayName, firebaseUser.email),
        token: firebaseUser.uid,
        createdAt: new Date().toISOString(),
        currency: 150,
        inventory: ['color_default'],
        equippedItem: 'color_default',
        unlockedEliteSkins: [],
        supportTotal: 0,
        supporterRank: 'standard',
        stats: { ...INITIAL_STATS }
      };

      let userDoc: DocumentSnapshot;
      try {
        console.log('[Auth] Fetching Firestore user doc', `users/${firebaseUser.uid}`);
        // getOrFetchUserProfile owns the timeout; do NOT double-wrap here.
        userDoc = await getOrFetchUserProfile(firebaseUser.uid);
      } catch (err) {
        throttledAuthWarning('[Auth] Firestore user doc read failed, falling back to local profile', err);
        // Sync in background — player enters game immediately.
        ensureUserProfileDoc(firebaseUser.uid, fallbackUser).catch(() => {});
        localStorage.setItem(SESSION_KEY, JSON.stringify({ username: fallbackUser.username, uid: firebaseUser.uid }));
        return { success: true, user: fallbackUser };
      }

      let finalUser: User;

      if (!userDoc.exists()) {
        // First Google sign-in — create profile in background.
        finalUser = fallbackUser;
        ensureUserProfileDoc(firebaseUser.uid, finalUser).catch(() => {});
      } else {
        finalUser = this.migrateUser(userDoc.data(), firebaseUser.uid);
      }

      localStorage.setItem(SESSION_KEY, JSON.stringify({ username: finalUser.username, uid: firebaseUser.uid }));
      console.log('[Auth] Google login flow resolved', { uid: firebaseUser.uid, username: finalUser.username });

      return {
        success: true,
        user: { ...finalUser, token: firebaseUser.uid }
      };
    } catch (err: any) {
      console.error('[Auth] Google authentication failed', err);
      return { success: false, error: mapFirebaseAuthError(err) };
    }
  }

  /**
   * Sign out and clear local session.
   */
  static async logout(): Promise<void> {
    try {
      await signOut(auth);
      localStorage.removeItem(SESSION_KEY);
    } catch (err) {
      console.error('[Auth] Sign out failure', err);
    }
  }

  /**
   * Restore a previous session on page load.
   *
   * Fast-path: if auth.currentUser is already populated (e.g. we just
   * returned from loginWithGoogle) skip registering a new onAuthStateChanged
   * listener entirely. This is the primary fix for the duplicate-fetch race:
   * we join the in-flight getOrFetchUserProfile promise from loginWithGoogle
   * instead of issuing a second parallel getDoc.
   */
  static async getSession(): Promise<AuthResponse> {
    const sessionStr = localStorage.getItem(SESSION_KEY);
    if (!sessionStr) return { success: false };

    try {
      const { uid } = JSON.parse(sessionStr);
      const sessionLimit = consumeRateLimit('sessionRestore', uid || 'session_restore');
      if (!sessionLimit.ok) {
        logSecurityEvent('session_restore_rate_limited', { actor: uid || 'session_restore', retryAfterMs: sessionLimit.retryAfterMs });
        return { success: false, error: rateLimitMessage(sessionLimit.retryAfterMs, 'Session restore is cooling down.') };
      }
      console.log('[Auth] Restoring session start', { uid });

      // Only wait for the auth state listener when we genuinely do not
      // yet have a resolved current user.
      if (!auth.currentUser) {
        await withTimeout(
          new Promise<void>((resolve) => {
            const unsubscribe = auth.onAuthStateChanged(() => {
              unsubscribe();
              resolve();
            });
          }),
          8000,
          'auth/operation-timeout',
          'Auth state listener timed out.'
        );
      }

      if (!auth.currentUser || auth.currentUser.uid !== uid) {
        return { success: false };
      }

      let userDoc: DocumentSnapshot;
      try {
        // Shares the in-flight promise with loginWithGoogle if it ran
        // moments ago — zero duplicate Firestore reads.
        userDoc = await getOrFetchUserProfile(uid);
      } catch (err) {
        throttledAuthWarning('[Auth] Session Firestore read failed; returning auth-only fallback', err);
        return {
          success: true,
          user: {
            username: buildCleanUsername(auth.currentUser.displayName, auth.currentUser.email),
            token: uid,
            createdAt: new Date().toISOString(),
            currency: 0,
            inventory: ['color_default'],
            equippedItem: 'color_default',
            unlockedEliteSkins: [],
            supportTotal: 0,
            supporterRank: 'standard',
            stats: { ...INITIAL_STATS }
          }
        };
      }

      if (!userDoc.exists()) {
        return { success: false };
      }

      const completeUser = this.migrateUser(userDoc.data(), uid);
      console.log('[Auth] Session restore success', { uid, username: completeUser.username });

      return {
        success: true,
        user: {
          username: completeUser.username,
          token: uid,
          stats: completeUser.stats,
          createdAt: completeUser.createdAt,
          currency: completeUser.currency,
          inventory: completeUser.inventory,
          equippedItem: completeUser.equippedItem,
          unlockedEliteSkins: completeUser.unlockedEliteSkins,
          supportTotal: completeUser.supportTotal,
          supporterRank: completeUser.supporterRank
        }
      };
    } catch (e) {
      console.error('[Auth] Session parse/resolve error', e);
    }

    return { success: false };
  }

  // ── Database Modification Methods ───────────────────────────────────────

  /**
   * Update pilot combat metrics and achievement progress.
   */
  static async updateUserStats(
    username: string,
    gameData: Partial<UserStats>,
    currencyReward: number = 0,
    unlockedSkins: TankClass[] = []
  ): Promise<{ user: User, newlyUnlocked: Achievement[], newlyUnlockedQuests: Quest[], currencyEarned: number } | null> {
    const currentUser = auth.currentUser;
    if (!currentUser) return null;
    const statsBurst = consumeRateLimit('statsWrite', currentUser.uid);
    if (!statsBurst.ok) {
      logSecurityEvent('stats_burst_limited', { uid: currentUser.uid, retryAfterMs: statsBurst.retryAfterMs });
      return null;
    }
    if (!beginOperationWindow('stats', currentUser.uid)) {
      logSecurityEvent('stats_rate_limited', { uid: currentUser.uid });
      return null;
    }

    const sanitizedSession = sanitizeSessionStats(gameData);
    const sanitizedUnlocks = sanitizeUnlockedEliteSkins(unlockedSkins);
    const sessionAnomalies = describeSessionAnomalies(gameData, sanitizedSession);
    if (sessionAnomalies.length > 0) {
      logSecurityEvent('stats_implausible_session', {
        uid: currentUser.uid,
        anomalies: sessionAnomalies,
        raw: {
          totalGames: gameData.totalGames || 0,
          totalScore: gameData.totalScore || 0,
          highScore: gameData.highScore || 0,
          totalKills: gameData.totalKills || 0,
          eliteKills: gameData.eliteKills || 0,
          transformations: gameData.transformations || 0,
        }
      });
    }
    const expectedReward = deriveCurrencyRewardFromSession(sanitizedSession);
    const requestedReward = clampInt(currencyReward, 0, MAX_TOTAL_CURRENCY_REWARD, 0);
    if (requestedReward !== expectedReward) {
      logSecurityEvent('stats_reward_mismatch', { uid: currentUser.uid, requestedReward, expectedReward });
    }

    const userDocPath = `users/${currentUser.uid}`;
    let userDoc: DocumentSnapshot;
    try {
      userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, userDocPath);
    }

    if (!userDoc!.exists()) return null;

    const user = this.migrateUser(userDoc!.data(), currentUser.uid);
    const current = user.stats;

    const updatedStats: UserStats = {
      totalGames: current.totalGames + (sanitizedSession.totalGames || 0),
      totalScore: current.totalScore + (sanitizedSession.totalScore || 0),
      highScore: Math.max(current.highScore, sanitizedSession.highScore || sanitizedSession.totalScore || 0),
      maxLevel: Math.max(current.maxLevel, sanitizedSession.maxLevel || 1),
      totalKills: current.totalKills + (sanitizedSession.totalKills || 0),
      totalDeaths: current.totalDeaths + (sanitizedSession.totalDeaths || 0),
      eliteKills: (current.eliteKills || 0) + (sanitizedSession.eliteKills || 0),
      transformations: (current.transformations || 0) + (sanitizedSession.transformations || 0),
      highestEliteDamage: Math.max(current.highestEliteDamage || 0, sanitizedSession.highestEliteDamage || 0),
      achievementsUnlocked: current.achievementsUnlocked || [],
      questsUnlocked: current.questsUnlocked || []
    };

    const newlyUnlocked: Achievement[] = [];
    for (const achievement of ACHIEVEMENTS) {
      if (updatedStats.achievementsUnlocked.includes(achievement.id)) continue;

      let reached = false;
      switch (achievement.category) {
        case 'kills':   reached = updatedStats.totalKills >= achievement.requirement; break;
        case 'score':   reached = updatedStats.highScore >= achievement.requirement; break;
        case 'games':   reached = updatedStats.totalGames >= achievement.requirement; break;
        case 'elite':   reached = updatedStats.eliteKills >= achievement.requirement; break;
        case 'level':   reached = updatedStats.maxLevel >= achievement.requirement; break;
        case 'special': reached = updatedStats.transformations >= achievement.requirement; break;
      }

      if (reached) {
        updatedStats.achievementsUnlocked.push(achievement.id);
        newlyUnlocked.push(achievement);
        if (achievement.rewardSkinId && !user.inventory.includes(achievement.rewardSkinId) && SHOP_ITEM_IDS.has(achievement.rewardSkinId)) {
          user.inventory.push(achievement.rewardSkinId);
        }
      }
    }

    const newlyUnlockedQuests: Quest[] = [];
    const getQuestProgress = (quest: Quest): number => {
      switch (quest.category) {
        case 'combat': return updatedStats.totalKills;
        case 'farming': return updatedStats.totalScore;
        case 'survival': return updatedStats.maxLevel;
        case 'teamplay': return updatedStats.totalGames;
        case 'objective': return updatedStats.eliteKills + updatedStats.transformations;
        default: return 0;
      }
    };

    for (const quest of QUESTS) {
      if (updatedStats.questsUnlocked.includes(quest.id)) continue;
      if (getQuestProgress(quest) < quest.requirement) continue;
      updatedStats.questsUnlocked.push(quest.id);
      newlyUnlockedQuests.push(quest);
      if (quest.rewardSkinId && !user.inventory.includes(quest.rewardSkinId) && SHOP_ITEM_IDS.has(quest.rewardSkinId)) {
        user.inventory.push(quest.rewardSkinId);
      }
    }

    const achievementBonus = newlyUnlocked.reduce((sum, a) => sum + (a.rewardCurrency || 0), 0);
    const questBonus = newlyUnlockedQuests.reduce((sum, q) => sum + (q.rewardCurrency || 0), 0);
    const totalReward = clampInt(expectedReward + achievementBonus + questBonus, 0, MAX_TOTAL_CURRENCY_REWARD, 0);
    const nextCurrency = clampInt((user.currency || 0) + totalReward, 0, MAX_ACCOUNT_CURRENCY, 0);
    if (nextCurrency >= MAX_ACCOUNT_CURRENCY && (user.currency || 0) + totalReward > MAX_ACCOUNT_CURRENCY) {
      logSecurityEvent('currency_cap_reached', { uid: currentUser.uid, previousCurrency: user.currency || 0, attemptedReward: totalReward });
    }

    const nextUnlockedEliteSkins = [...(user.unlockedEliteSkins || [])];
    for (const skin of sanitizedUnlocks) {
      if (!nextUnlockedEliteSkins.includes(skin)) {
        nextUnlockedEliteSkins.push(skin);
      }
    }

    user.inventory = sanitizeInventory(user.inventory);

    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        stats: updatedStats,
        currency: nextCurrency,
        inventory: user.inventory,
        unlockedEliteSkins: nextUnlockedEliteSkins
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, userDocPath);
    }

    user.stats = updatedStats;
    user.currency = nextCurrency;
    user.unlockedEliteSkins = nextUnlockedEliteSkins;

    return { user: { ...user, token: currentUser.uid }, newlyUnlocked, newlyUnlockedQuests, currencyEarned: totalReward };
  }

  /**
   * Purchase an item from the Armory.
   */
  static async purchaseItem(username: string, itemId: string): Promise<{ success: boolean, user?: User, error?: string }> {
    const currentUser = auth.currentUser;
    if (!currentUser) return { success: false, error: 'Authentication missing' };
    const purchaseBurst = consumeRateLimit('purchase', currentUser.uid);
    if (!purchaseBurst.ok) {
      logSecurityEvent('purchase_burst_limited', { uid: currentUser.uid, retryAfterMs: purchaseBurst.retryAfterMs, itemId });
      return { success: false, error: rateLimitMessage(purchaseBurst.retryAfterMs, 'Armory requests are cooling down.') };
    }
    if (!beginOperationWindow('purchase', currentUser.uid)) return { success: false, error: 'Armory sync cooling down' };

    const userDocPath = `users/${currentUser.uid}`;
    let userDoc: DocumentSnapshot;
    try {
      userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, userDocPath);
    }

    if (!userDoc!.exists()) return { success: false, error: 'Commander profile not found' };

    const user = this.migrateUser(userDoc!.data(), currentUser.uid);
    const normalizedItemId = typeof itemId === 'string' ? itemId.trim() : '';
    const item = SHOP_ITEMS.find(i => i.id === normalizedItemId);

    if (!item) {
      logSecurityEvent('purchase_invalid_item', { uid: currentUser.uid, itemId: normalizedItemId || itemId });
      return { success: false, error: 'Item configuration not found' };
    }
    if (item.isAchievementReward) return { success: false, error: 'Reward skins unlock through gameplay only' };
    if (item.type === 'elite_skin') return { success: false, error: 'Elite variants unlock through gameplay only' };
    user.inventory = sanitizeInventory(user.inventory);
    if (user.inventory.includes(normalizedItemId)) return { success: false, error: 'Equipment already owned' };
    if (user.currency < item.price) return { success: false, error: 'Insufficient command currency' };

    const nextCurrency = user.currency - item.price;
    const nextInventory = sanitizeInventory([...user.inventory, normalizedItemId]);

    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        currency: nextCurrency,
        inventory: nextInventory
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, userDocPath);
    }

    user.currency = nextCurrency;
    user.inventory = nextInventory;

    return { success: true, user: { ...user, token: currentUser.uid } };
  }

  /**
   * Equip a pilot chassis or skin.
   */
  static async equipItem(username: string, itemId: string): Promise<{ success: boolean, user?: User, error?: string }> {
    const currentUser = auth.currentUser;
    if (!currentUser) return { success: false, error: 'Credentials missing' };
    const equipBurst = consumeRateLimit('equip', currentUser.uid);
    if (!equipBurst.ok) {
      logSecurityEvent('equip_burst_limited', { uid: currentUser.uid, retryAfterMs: equipBurst.retryAfterMs, itemId });
      return { success: false, error: rateLimitMessage(equipBurst.retryAfterMs, 'Loadout changes are cooling down.') };
    }
    if (!beginOperationWindow('equip', currentUser.uid)) return { success: false, error: 'Loadout sync cooling down' };

    const userDocPath = `users/${currentUser.uid}`;
    let userDoc: DocumentSnapshot;
    try {
      userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, userDocPath);
    }

    if (!userDoc!.exists()) return { success: false, error: 'Pilot record not found' };

    const user = this.migrateUser(userDoc!.data(), currentUser.uid);
    const normalizedItemId = typeof itemId === 'string' ? itemId.trim() : '';
    user.inventory = sanitizeInventory(user.inventory);
    const isKnownItem = SHOP_ITEM_IDS.has(normalizedItemId) || eliteSkinIdToClass(normalizedItemId) !== null;
    if (!isKnownItem) {
      logSecurityEvent('equip_invalid_item', { uid: currentUser.uid, itemId: normalizedItemId || itemId });
      return { success: false, error: 'Equipment record not found' };
    }

    const eliteClass = eliteSkinIdToClass(normalizedItemId);
    const hasEliteUnlock = eliteClass ? (user.unlockedEliteSkins || []).includes(eliteClass) : false;
    const hasClassicUnlock = user.inventory.includes(normalizedItemId);
    if (!hasClassicUnlock && !hasEliteUnlock) {
      logSecurityEvent('equip_unowned_item', { uid: currentUser.uid, itemId: normalizedItemId });
      return { success: false, error: 'Equipment is unacquired' };
    }

    try {
      await updateDoc(doc(db, 'users', currentUser.uid), { equippedItem: normalizedItemId });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, userDocPath);
    }

    user.equippedItem = normalizedItemId;

    return { success: true, user: { ...user, token: currentUser.uid } };
  }

  static async getSupporterRank(uid: string): Promise<'standard' | 'rank1' | 'rank2' | 'rank3'> {
    if (!uid) return 'standard';
    try {
      const q = query(collection(db, 'users'), orderBy('supportTotal', 'desc'), limit(3));
      const snap = await getDocs(q);
      const ids = snap.docs.map((d) => d.id);
      const idx = ids.indexOf(uid);
      if (idx === 0) return 'rank1';
      if (idx === 1) return 'rank2';
      if (idx === 2) return 'rank3';
      return 'standard';
    } catch {
      return 'standard';
    }
  }

  static async addSupportContribution(amount: number): Promise<{ success: boolean; user?: User; error?: string }> {
    const currentUser = auth.currentUser;
    if (!currentUser) return { success: false, error: 'Credentials missing' };
    const supportBurst = consumeRateLimit('support', currentUser.uid);
    if (!supportBurst.ok) {
      logSecurityEvent('support_burst_limited', { uid: currentUser.uid, retryAfterMs: supportBurst.retryAfterMs, amount });
      return { success: false, error: rateLimitMessage(supportBurst.retryAfterMs, 'Support uplink is cooling down.') };
    }
    if (!beginOperationWindow('support', currentUser.uid)) return { success: false, error: 'Support uplink cooling down' };
    const requestedAmount = typeof amount === 'number' && Number.isFinite(amount) ? Math.floor(amount) : 0;
    if (requestedAmount < 1) {
      logSecurityEvent('support_invalid_amount', { uid: currentUser.uid, amount });
      return { success: false, error: 'Support amount must be positive' };
    }
    const normalized = clampInt(requestedAmount, 1, MAX_SUPPORT_CONTRIBUTION, 1);
    if (requestedAmount !== normalized) {
      logSecurityEvent('support_amount_clamped', { uid: currentUser.uid, requestedAmount, normalized });
    }
    const userDocRef = doc(db, 'users', currentUser.uid);
    try {
      const snap = await getDoc(userDocRef);
      if (!snap.exists()) return { success: false, error: 'Pilot record not found' };
      const user = this.migrateUser(snap.data(), currentUser.uid);
      const nextTotal = clampInt((user.supportTotal || 0) + normalized, 0, MAX_SUPPORT_TOTAL, 0);
      if ((user.supportTotal || 0) + normalized > MAX_SUPPORT_TOTAL) {
        logSecurityEvent('support_total_cap_reached', { uid: currentUser.uid, previousTotal: user.supportTotal || 0, normalized });
      }
      await updateDoc(userDocRef, { supportTotal: nextTotal });
      user.supportTotal = nextTotal;
      user.supporterRank = await this.getSupporterRank(currentUser.uid);
      return { success: true, user: { ...user, token: currentUser.uid } };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Support transaction failed' };
    }
  }

  /**
   * Persist a player callsign update and synchronize existing score records.
   */
  static async updateCallsign(nextCallsign: string): Promise<{ success: boolean; error?: string }> {
    const currentUser = auth.currentUser;
    if (!currentUser) return { success: false, error: 'Credentials missing' };
    const callsignBurst = consumeRateLimit('callsign', currentUser.uid);
    if (!callsignBurst.ok) {
      logSecurityEvent('callsign_burst_limited', { uid: currentUser.uid, retryAfterMs: callsignBurst.retryAfterMs });
      return { success: false, error: rateLimitMessage(callsignBurst.retryAfterMs, 'Callsign updates are cooling down.') };
    }
    if (!beginOperationWindow('callsign', currentUser.uid)) return { success: false, error: 'Callsign uplink cooling down' };

    const callsign = sanitizeCallsign(nextCallsign, '');
    if (!callsign) return { success: false, error: 'Callsign cannot be empty' };

    try {
      await updateDoc(doc(db, 'users', currentUser.uid), { username: callsign });

      // Keep Firebase Auth displayName aligned for future fallback reads.
      try {
        await updateProfile(currentUser, { displayName: callsign });
      } catch {
        // Non-fatal, Firestore username remains source of truth.
      }

      // Update all leaderboard rows linked to this UID.
      const byUser = query(collection(db, 'highScores'), where('userId', '==', currentUser.uid));
      const scoreDocs = await getDocs(byUser);
      await Promise.all(scoreDocs.docs.map((scoreDoc) => updateDoc(doc(db, 'highScores', scoreDoc.id), { name: callsign })));

      const sessionRaw = localStorage.getItem(SESSION_KEY);
      if (sessionRaw) {
        try {
          const parsed = JSON.parse(sessionRaw);
          localStorage.setItem(SESSION_KEY, JSON.stringify({ ...parsed, username: callsign }));
        } catch {
          localStorage.setItem(SESSION_KEY, JSON.stringify({ username: callsign, uid: currentUser.uid }));
        }
      } else {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ username: callsign, uid: currentUser.uid }));
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to update callsign' };
    }
  }

  // ── Leaderboard ─────────────────────────────────────────────────────────

  /**
   * Submit a high score to the public record.
   */
  static async submitHighScore(name: string, score: number, level: number, classType: TankClass, userId?: string): Promise<void> {
    if (score <= 0) return;

    const authUid = auth.currentUser?.uid || null;
    const actorId = authUid || userId || 'anonymous';
    const scoreBurst = consumeRateLimit('scoreSubmit', actorId);
    if (!scoreBurst.ok) {
      logSecurityEvent('score_burst_limited', { actorId, retryAfterMs: scoreBurst.retryAfterMs, score });
      return;
    }
    if (!beginOperationWindow('score', actorId)) {
      logSecurityEvent('score_rate_limited', { actorId });
      return;
    }

    if (authUid && userId && userId !== authUid) {
      logSecurityEvent('score_user_mismatch', { authUid, suppliedUserId: userId, score, level });
    }

    const recordId = `score_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const highScorePath = `highScores/${recordId}`;
    const resolvedUserId = authUid || userId || null;
    const cleanScore = clampInt(score, 1, MAX_SESSION_SCORE, 1);
    const cleanLevel = clampInt(level, 1, MAX_SESSION_LEVEL, 1);
    const cleanName = sanitizeCallsign(name, 'ANONYMOUS_UNIT');
    const cleanClassType = TANK_CLASS_VALUES.has(classType) ? classType : TankClass.BASIC;

    if (shouldBlockDuplicateScoreSubmission(actorId, cleanScore, cleanLevel, cleanClassType)) {
      logSecurityEvent('score_duplicate_blocked', { actorId, score: cleanScore, level: cleanLevel, classType: cleanClassType });
      return;
    }

    try {
      await setDoc(doc(db, 'highScores', recordId), {
        userId: resolvedUserId,
        name: cleanName,
        score: cleanScore,
        level: cleanLevel,
        classType: cleanClassType,
        date: new Date().toISOString()
      });
      rememberScoreSubmission(actorId, cleanScore, cleanLevel, cleanClassType);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, highScorePath);
    }
  }

  /**
   * Subscribe to real-time global leaderboard updates.
   */
  static listenToLeaderboard(callback: (scores: HighScoreEntry[]) => void): () => void {
    const q = query(
      collection(db, 'highScores'),
      orderBy('score', 'desc'),
      limit(10)
    );
    let revision = 0;

    return onSnapshot(q, async (snapshot) => {
      const currentRevision = ++revision;
      const scores: HighScoreEntry[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        scores.push({
          userId: data.userId ?? null,
          name: data.name,
          score: data.score,
          level: data.level,
          classType: data.classType as TankClass,
          date: data.date
        });
      });

      const uniqueUserIds = [...new Set(scores.map(s => s.userId).filter((id): id is string => !!id))];
      if (uniqueUserIds.length === 0) {
        callback(scores);
        return;
      }

      const resolvedNames = new Map<string, string>();
      await Promise.all(uniqueUserIds.map(async (uid) => {
        try {
          const userSnap = await getDoc(doc(db, 'users', uid));
          if (userSnap.exists()) {
            const data = userSnap.data() as { username?: string };
            if (data.username && typeof data.username === 'string') {
              resolvedNames.set(uid, data.username);
            }
          }
        } catch {
          // Ignore single profile read failures; we keep original score names.
        }
      }));

      if (currentRevision !== revision) return;
      callback(scores.map((entry) => {
        const persistedName = (entry.name || '').trim();
        return {
          ...entry,
          // Preserve the callsign stored with the score entry.
          // Fallback to account profile name only when entry name is missing.
          name: persistedName || ((entry.userId && resolvedNames.get(entry.userId)) || 'ANONYMOUS_UNIT')
        };
      }));
    }, (error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[Leaderboard] Firestore read failed', message);
    });
  }

  // ── User migration ───────────────────────────────────────────────────────

  private static migrateUser(user: any, token: string = ''): User {
    const finalUser = { ...user };
    finalUser.token = token;
    finalUser.username = sanitizeCallsign(finalUser.username, buildCleanUsername(undefined, undefined, 'PILOT'));
    finalUser.currency = clampInt(finalUser.currency, 0, MAX_ACCOUNT_CURRENCY, 0);
    finalUser.inventory = sanitizeInventory(finalUser.inventory);
    finalUser.equippedItem = typeof finalUser.equippedItem === 'string' && finalUser.equippedItem.trim()
      ? finalUser.equippedItem.trim()
      : 'color_default';
    finalUser.unlockedEliteSkins = sanitizeUnlockedEliteSkins(finalUser.unlockedEliteSkins || []);
    finalUser.supportTotal = clampInt(finalUser.supportTotal, 0, MAX_SUPPORT_TOTAL, 0);
    finalUser.supporterRank = SUPPORTER_RANKS.has(finalUser.supporterRank) ? finalUser.supporterRank : 'standard';

    if (!finalUser.stats) finalUser.stats = { ...INITIAL_STATS };
    finalUser.stats.totalGames = clampInt(finalUser.stats.totalGames, 0, Number.MAX_SAFE_INTEGER, 0);
    finalUser.stats.totalScore = clampInt(finalUser.stats.totalScore, 0, Number.MAX_SAFE_INTEGER, 0);
    finalUser.stats.highScore = clampInt(finalUser.stats.highScore, 0, Number.MAX_SAFE_INTEGER, 0);
    finalUser.stats.maxLevel = clampInt(finalUser.stats.maxLevel, 1, MAX_SESSION_LEVEL, 1);
    finalUser.stats.totalKills = clampInt(finalUser.stats.totalKills, 0, Number.MAX_SAFE_INTEGER, 0);
    finalUser.stats.totalDeaths = clampInt(finalUser.stats.totalDeaths, 0, Number.MAX_SAFE_INTEGER, 0);
    finalUser.stats.eliteKills = clampInt(finalUser.stats.eliteKills, 0, Number.MAX_SAFE_INTEGER, 0);
    finalUser.stats.transformations = clampInt(finalUser.stats.transformations, 0, Number.MAX_SAFE_INTEGER, 0);
    finalUser.stats.highestEliteDamage = clampInt(finalUser.stats.highestEliteDamage, 0, Number.MAX_SAFE_INTEGER, 0);
    if (!Array.isArray(finalUser.stats.achievementsUnlocked)) finalUser.stats.achievementsUnlocked = [];
    if (!Array.isArray(finalUser.stats.questsUnlocked)) finalUser.stats.questsUnlocked = [];
    finalUser.stats.achievementsUnlocked = Array.from(new Set(finalUser.stats.achievementsUnlocked.filter((id: unknown): id is string => typeof id === 'string')));
    finalUser.stats.questsUnlocked = Array.from(new Set(finalUser.stats.questsUnlocked.filter((id: unknown): id is string => typeof id === 'string')));

    const equippedEliteClass = eliteSkinIdToClass(finalUser.equippedItem);
    const hasEquippedClassic = finalUser.inventory.includes(finalUser.equippedItem);
    const hasEquippedElite = equippedEliteClass ? finalUser.unlockedEliteSkins.includes(equippedEliteClass) : false;
    if (!hasEquippedClassic && !hasEquippedElite) {
      finalUser.equippedItem = 'color_default';
    }

    return finalUser as User;
  }
}
