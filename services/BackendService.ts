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
          unlockedEliteSkins: completeUser.unlockedEliteSkins
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
          unlockedEliteSkins: completeUser.unlockedEliteSkins
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
      totalGames: current.totalGames + (gameData.totalGames || 0),
      totalScore: current.totalScore + (gameData.totalScore || 0),
      highScore: Math.max(current.highScore, gameData.highScore || 0),
      maxLevel: Math.max(current.maxLevel, gameData.maxLevel || 0),
      totalKills: current.totalKills + (gameData.totalKills || 0),
      totalDeaths: current.totalDeaths + (gameData.totalDeaths || 0),
      eliteKills: (current.eliteKills || 0) + (gameData.eliteKills || 0),
      transformations: (current.transformations || 0) + (gameData.transformations || 0),
      highestEliteDamage: Math.max(current.highestEliteDamage || 0, gameData.highestEliteDamage || 0),
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
        if (achievement.rewardSkinId && !user.inventory.includes(achievement.rewardSkinId)) {
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
      if (quest.rewardSkinId && !user.inventory.includes(quest.rewardSkinId)) {
        user.inventory.push(quest.rewardSkinId);
      }
    }

    const achievementBonus = newlyUnlocked.reduce((sum, a) => sum + (a.rewardCurrency || 0), 0);
    const questBonus = newlyUnlockedQuests.reduce((sum, q) => sum + (q.rewardCurrency || 0), 0);
    const totalReward = currencyReward + achievementBonus + questBonus;
    const nextCurrency = (user.currency || 0) + totalReward;

    const nextUnlockedEliteSkins = [...(user.unlockedEliteSkins || [])];
    for (const skin of unlockedSkins) {
      if (!nextUnlockedEliteSkins.includes(skin)) {
        nextUnlockedEliteSkins.push(skin);
      }
    }

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

    const userDocPath = `users/${currentUser.uid}`;
    let userDoc: DocumentSnapshot;
    try {
      userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, userDocPath);
    }

    if (!userDoc!.exists()) return { success: false, error: 'Commander profile not found' };

    const user = this.migrateUser(userDoc!.data(), currentUser.uid);
    const item = SHOP_ITEMS.find(i => i.id === itemId);

    if (!item) return { success: false, error: 'Item configuration not found' };
    if (user.inventory.includes(itemId)) return { success: false, error: 'Equipment already owned' };
    if (user.currency < item.price) return { success: false, error: 'Insufficient command currency' };

    const nextCurrency = user.currency - item.price;
    const nextInventory = [...user.inventory, itemId];

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

    const userDocPath = `users/${currentUser.uid}`;
    let userDoc: DocumentSnapshot;
    try {
      userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, userDocPath);
    }

    if (!userDoc!.exists()) return { success: false, error: 'Pilot record not found' };

    const user = this.migrateUser(userDoc!.data(), currentUser.uid);
    if (!user.inventory.includes(itemId)) return { success: false, error: 'Equipment is unacquired' };

    try {
      await updateDoc(doc(db, 'users', currentUser.uid), { equippedItem: itemId });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, userDocPath);
    }

    user.equippedItem = itemId;

    return { success: true, user: { ...user, token: currentUser.uid } };
  }

  /**
   * Persist a player callsign update and synchronize existing score records.
   */
  static async updateCallsign(nextCallsign: string): Promise<{ success: boolean; error?: string }> {
    const currentUser = auth.currentUser;
    if (!currentUser) return { success: false, error: 'Credentials missing' };

    const callsign = nextCallsign.trim();
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

    const recordId = `score_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const highScorePath = `highScores/${recordId}`;
    const resolvedUserId = userId || auth.currentUser?.uid || null;

    try {
      await setDoc(doc(db, 'highScores', recordId), {
        userId: resolvedUserId,
        name: name || 'ANONYMOUS_UNIT',
        score: Math.floor(score),
        level,
        classType,
        date: new Date().toISOString()
      });
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
    if (typeof finalUser.currency !== 'number') finalUser.currency = 0;
    if (!Array.isArray(finalUser.inventory)) finalUser.inventory = ['color_default'];
    if (!finalUser.equippedItem) finalUser.equippedItem = 'color_default';
    if (!Array.isArray(finalUser.unlockedEliteSkins)) finalUser.unlockedEliteSkins = [];

    if (!finalUser.stats) finalUser.stats = { ...INITIAL_STATS };
    if (typeof finalUser.stats.eliteKills !== 'number') finalUser.stats.eliteKills = 0;
    if (typeof finalUser.stats.transformations !== 'number') finalUser.stats.transformations = 0;
    if (typeof finalUser.stats.highestEliteDamage !== 'number') finalUser.stats.highestEliteDamage = 0;
    if (!Array.isArray(finalUser.stats.achievementsUnlocked)) finalUser.stats.achievementsUnlocked = [];
    if (!Array.isArray(finalUser.stats.questsUnlocked)) finalUser.stats.questsUnlocked = [];

    return finalUser as User;
  }
}
