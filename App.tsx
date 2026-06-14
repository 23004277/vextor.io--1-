
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import GameCanvas from './components/GameCanvas';
import UIOverlay from './components/UIOverlay';
import CustomCursor from './components/CustomCursor';
import { GameMode, GameState, HighScoreEntry, TankClass, User, Team, Achievement, UserStats, GameSettings } from './types';
import { GameEngine } from './services/GameEngine';
import { BackendService } from './services/BackendService';
import { LoginModal } from './components/LoginModal';
import { ShopModal } from './components/ShopModal';
import { AlmanacModal } from './components/AlmanacModal';
import { AchievementsModal } from './components/AchievementsModal';
import { SettingsModal } from './components/SettingsModal';
import { AchievementPopup } from './components/AchievementPopup';
import { COLORS, SHOP_ITEMS, ACHIEVEMENTS, UPDATE_LOG } from './constants';
import { TankPreview } from './components/TankPreview';
import { TacticalTooltip } from './components/TacticalTooltip';
import { MainMenu } from './components/MainMenu';
import { ClickToPlayGate } from './components/ClickToPlayGate';
import { BackgroundMusic, BackgroundMusicVisualizerFrame } from './Background Music';

type UpdateLogEntry = typeof UPDATE_LOG[number];
type MenuBootPhase = 'locked' | 'unlocking' | 'revealing' | 'ready';

const DEFAULT_SETTINGS: GameSettings = {
    volume: 0.15,
    musicVolume: 1,
    darkMode: true,
    showMinimap: true,
    showLeaderboard: true,
    compactScoreNotation: false,
    shakeEnabled: true,
    shakeIntensity: 1.0,
    particleDensity: 1.0,
    uiScale: 1.0,
    showFps: true
};

type OverlayErrorBoundaryProps = {
  children: React.ReactNode;
  onExit: () => void;
};

type OverlayErrorBoundaryState = {
  hasError: boolean;
};

class OverlayErrorBoundary extends React.Component<OverlayErrorBoundaryProps, OverlayErrorBoundaryState> {
  constructor(props: OverlayErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): OverlayErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('UIOverlay crashed:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="absolute inset-0 z-[250] flex items-center justify-center bg-black/65 backdrop-blur-sm">
          <div className="pointer-events-auto rounded-2xl border border-white/20 bg-[#090909] px-8 py-7 text-center">
            <h2 className="text-xl font-black tracking-wide text-white">HUD RECOVERY MODE</h2>
            <p className="mt-2 text-sm text-white/70">Overlay crashed, gameplay is still running.</p>
            <button
              onClick={this.props.onExit}
              className="mt-5 rounded-lg bg-cyan-500 px-5 py-2 text-sm font-black text-black transition hover:bg-cyan-400"
            >
              RETURN TO MENU
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [engine, setEngine] = useState<GameEngine | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('vextor_pilot_name') || '');
  const [highScores, setHighScores] = useState<HighScoreEntry[]>([]);
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  
  const [user, setUser] = useState<User | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showAlmanac, setShowAlmanac] = useState(false);
  const [showUpdateHistory, setShowUpdateHistory] = useState(false);
  const [selectedUpdateId, setSelectedUpdateId] = useState<string>(UPDATE_LOG[0]?.id ?? '');
  const [updateSearch, setUpdateSearch] = useState('');
  const [ownerCopyStatus, setOwnerCopyStatus] = useState<string>('');
  const archiveCopyFallbackRef = useRef<HTMLTextAreaElement | null>(null);
  const selectedReleaseExportRef = useRef<HTMLTextAreaElement | null>(null);
  const fullArchiveExportRef = useRef<HTMLTextAreaElement | null>(null);
  const [showSupport, setShowSupport] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  
  const [newlyUnlocked, setNewlyUnlocked] = useState<Achievement[]>([]);
  const [showAchievementPopup, setShowAchievementPopup] = useState(false);
  const [lastDeathReport, setLastDeathReport] = useState<{ moneyEarned: number; unlockedAchievements: number; unlockedQuests: number } | null>(null);
  const [creditToast, setCreditToast] = useState<{ id: number; amount: number; total: number } | null>(null);
  const [creditCopiedId, setCreditCopiedId] = useState<number | null>(null);
  
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.FFA);
  const [selectedTeam, setSelectedTeam] = useState<Team>(Team.BLUE);
  const [isSpectating, setIsSpectating] = useState(false);
  const [menuMusicSnapshot, setMenuMusicSnapshot] = useState<BackgroundMusicVisualizerFrame | null>(null);
  const [menuBootPhase, setMenuBootPhase] = useState<MenuBootPhase>('locked');
  const [menuBootOverlayVisible, setMenuBootOverlayVisible] = useState(true);
  const [menuMousePos, setMenuMousePos] = useState({ x: 0, y: 0 });
  const lastUnmutedVolumesRef = useRef<{ volume: number; musicVolume: number }>({
    volume: DEFAULT_SETTINGS.volume,
    musicVolume: DEFAULT_SETTINGS.musicVolume,
  });
  const menuMusicRef = useRef<BackgroundMusic | null>(null);
  const isPlayingRef = useRef(false);
  const menuBootFadeTimeoutRef = useRef<number | null>(null);
  const menuBootSettleTimeoutRef = useRef<number | null>(null);
  const menuBootActivationLockRef = useRef(false);
  const menuBootTransitionRunRef = useRef(0);
  const previousCurrencyRef = useRef<number | null>(null);
  const currencyHydratedRef = useRef(false);
  const suppressNextCreditToastRef = useRef(false);
  const menuBootVisualActive = menuBootPhase !== 'locked';
  const menuBootMusicActive = menuBootPhase === 'ready';
  const menuBootMenuVisible = menuBootPhase === 'revealing' || menuBootPhase === 'ready';
  const menuBootUnlocking = menuBootPhase === 'unlocking';
  const menuBootTransitioning = menuBootPhase === 'revealing';

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const clearMenuBootTimers = useCallback(() => {
    if (menuBootFadeTimeoutRef.current != null) {
      window.clearTimeout(menuBootFadeTimeoutRef.current);
      menuBootFadeTimeoutRef.current = null;
    }
    if (menuBootSettleTimeoutRef.current != null) {
      window.clearTimeout(menuBootSettleTimeoutRef.current);
      menuBootSettleTimeoutRef.current = null;
    }
  }, []);

  const silenceMenuMusic = useCallback(() => {
    const music = menuMusicRef.current;
    if (!music) return;
    music.pauseImmediately();
    setMenuMusicSnapshot(music.getVisualizerFrame());
  }, []);

  const primeMenuMusicSnapshot = useCallback(async () => {
    const music = menuMusicRef.current;
    if (!music) return null;

    let snapshot = music.getVisualizerFrame();
    setMenuMusicSnapshot(snapshot);
    if (!snapshot.paused) return snapshot;

    for (let i = 0; i < 4; i += 1) {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      snapshot = music.getVisualizerFrame();
      setMenuMusicSnapshot(snapshot);
      if (!snapshot.paused) break;
    }

    return snapshot;
  }, []);

  const unlockMenuBoot = useCallback(async () => {
    if (menuBootActivationLockRef.current || menuBootMenuVisible || isPlayingRef.current) return;

    const transitionRun = menuBootTransitionRunRef.current + 1;
    menuBootTransitionRunRef.current = transitionRun;
    menuBootActivationLockRef.current = true;
    setMenuBootPhase('unlocking');
    try {
      engine?.sound.enable();
      const music = menuMusicRef.current;
      if (music) {
        setMenuMusicSnapshot(music.getVisualizerFrame());
      }
    } finally {
      if (menuBootTransitionRunRef.current !== transitionRun) return;

      clearMenuBootTimers();
      menuBootFadeTimeoutRef.current = window.setTimeout(() => {
        if (menuBootTransitionRunRef.current !== transitionRun) return;
        setMenuBootOverlayVisible(false);
        setMenuBootPhase('revealing');
        menuBootFadeTimeoutRef.current = null;
      }, 2000);
      menuBootSettleTimeoutRef.current = window.setTimeout(() => {
        if (menuBootTransitionRunRef.current !== transitionRun) return;
        setMenuBootPhase('ready');
        menuBootActivationLockRef.current = false;
        menuBootSettleTimeoutRef.current = null;
      }, 5000);
    }
  }, [clearMenuBootTimers, engine, menuBootMenuVisible]);

  const handleMenuBootOverlayActivate = useCallback(() => {
    if (menuBootActivationLockRef.current || menuBootMenuVisible || isPlayingRef.current) return;
    void unlockMenuBoot();
  }, [menuBootMenuVisible, unlockMenuBoot]);

  // Tooltip State
  const [tooltip, setTooltip] = useState<{ label: string; desc?: string; visible: boolean }>({
    label: '',
    visible: false
  });

  const parallax = useMemo(() => {
    const x = (menuMousePos.x / window.innerWidth - 0.5) * 2;
    const y = (menuMousePos.y / window.innerHeight - 0.5) * 2;
    return { x, y };
  }, [menuMousePos]);

  const menuBootLoadProgress = useMemo(() => {
    const energy = Math.max(0, Math.min(1, menuMusicSnapshot?.energy ?? 0.28));
    const reactor = Math.max(0, Math.min(1, menuMusicSnapshot?.reactorPulse ?? 0.22));
    if (menuBootPhase === 'unlocking') return Math.min(0.78, 0.18 + energy * 0.2 + reactor * 0.16);
    if (menuBootPhase === 'revealing') return Math.min(0.99, 0.84 + energy * 0.07 + reactor * 0.05);
    if (menuBootPhase === 'ready') return 1;
    return 0.08;
  }, [menuBootPhase, menuMusicSnapshot?.energy, menuMusicSnapshot?.reactorPulse]);

  const menuBootLoadLabel = useMemo(() => {
    if (menuBootPhase === 'unlocking') return 'Bootstrapping audio core and reactor telemetry';
    if (menuBootPhase === 'revealing') return 'Finalizing command deck render and live uplink';
    return 'Standing by';
  }, [menuBootPhase]);

  const activeColor = useMemo(() => {
      if (user && user.equippedItem) {
          const item = SHOP_ITEMS.find(i => i.id === user.equippedItem);
          if (item) return item.value;
      }
      return COLORS.player;
  }, [user]);

  const filteredUpdateLog = useMemo(() => {
    const query = updateSearch.trim().toLowerCase();
    if (!query) return UPDATE_LOG;
    return UPDATE_LOG.filter((entry) => {
      const haystack = [
        entry.id,
        entry.title,
        entry.date,
        entry.theme,
        entry.content,
        ...(entry.tags ?? []),
        ...(entry.sections ?? []).flatMap((section) => [section.label, ...section.items]),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [updateSearch]);

  const selectedUpdate = useMemo<UpdateLogEntry | undefined>(() => {
    return filteredUpdateLog.find((entry) => entry.id === selectedUpdateId) ?? filteredUpdateLog[0];
  }, [filteredUpdateLog, selectedUpdateId]);

  const selectedUpdateClipboardText = useMemo(() => {
    if (!selectedUpdate) return '';
    const tagBlock = selectedUpdate.tags?.length ? `Tags: ${selectedUpdate.tags.join(' | ')}` : '';
    const sectionBlock = (selectedUpdate.sections ?? [])
      .map((section) => {
        const items = section.items.map((item) => `- ${item}`).join('\n');
        return `${section.label}\n${items}`;
      })
      .join('\n\n');

    return [
      `${selectedUpdate.id} - ${selectedUpdate.title}`,
      `Date: ${selectedUpdate.date}`,
      selectedUpdate.theme ? `Theme: ${selectedUpdate.theme}` : '',
      '',
      'Summary',
      selectedUpdate.content,
      tagBlock,
      '',
      sectionBlock,
    ]
      .filter(Boolean)
      .join('\n');
  }, [selectedUpdate]);

  const fullArchiveClipboardText = useMemo(() => {
    return UPDATE_LOG.map((entry) => {
      const tagBlock = entry.tags?.length ? `Tags: ${entry.tags.join(' | ')}` : '';
      const sectionBlock = (entry.sections ?? [])
        .map((section) => {
          const items = section.items.map((item) => `- ${item}`).join('\n');
          return `${section.label}\n${items}`;
        })
        .join('\n\n');

      return [
        `${entry.id} - ${entry.title}`,
        `Date: ${entry.date}`,
        entry.theme ? `Theme: ${entry.theme}` : '',
        '',
        'Summary',
        entry.content,
        tagBlock,
        '',
        sectionBlock,
      ]
        .filter(Boolean)
        .join('\n');
    }).join('\n\n----------------------------------------\n\n');
  }, []);
  const playHover = useCallback(() => {
    if (!engine) return;
    engine.sound.enable();
    engine.sound.playUIHover();
  }, [engine]);

  const playClick = useCallback(() => {
    if (!engine) return;
    engine.sound.enable();
    engine.sound.playUIClick();
  }, [engine]);

  const playSelect = useCallback(() => {
    if (!engine) return;
    engine.sound.enable();
    engine.sound.playUISelect();
  }, [engine]);

  useEffect(() => {
    const music = new BackgroundMusic();
    music.setVolume(settings.musicVolume);
    menuMusicRef.current = music;
    setMenuMusicSnapshot(music.getVisualizerFrame());
    return () => {
      music.stop();
      if (menuMusicRef.current === music) menuMusicRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || isPlaying || !menuBootVisualActive) return;
    let rafId = 0;
    let lastVisualTick = 0;
    const tick = (timestamp: number) => {
      const music = menuMusicRef.current;
      if (music && timestamp - lastVisualTick >= 33) {
        setMenuMusicSnapshot(music.getVisualizerFrame());
        lastVisualTick = timestamp;
      }
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [isPlaying, menuBootVisualActive]);

  useEffect(() => {
    const music = menuMusicRef.current;
    if (!music) return;
    music.setVolume(settings.musicVolume);
  }, [settings.musicVolume]);

  useEffect(() => {
    const music = menuMusicRef.current;
    if (!music) return;

    if (isPlaying || !menuBootMusicActive) {
      silenceMenuMusic();
      return;
    }

    music.resume()
      .then(() => primeMenuMusicSnapshot())
      .catch(() => undefined);
  }, [isPlaying, menuBootMusicActive, primeMenuMusicSnapshot, silenceMenuMusic]);

  useEffect(() => {
    return () => {
      menuBootTransitionRunRef.current += 1;
      menuBootActivationLockRef.current = false;
      clearMenuBootTimers();
    };
  }, [clearMenuBootTimers]);

  useEffect(() => {
    if (playerName) localStorage.setItem('vextor_pilot_name', playerName);
  }, [playerName]);

  // Local-first leaderboard remap so callsign edits reflect instantly in Top Agents.
  const displayHighScores = useMemo(() => {
    const nextCallsign = playerName.trim();
    if (!nextCallsign || !user) return highScores;
    return highScores.map((entry) => {
      if (entry.userId && user.token && entry.userId === user.token) {
        return { ...entry, name: nextCallsign };
      }
      if (!entry.userId && entry.name === user.username) {
        return { ...entry, name: nextCallsign };
      }
      return entry;
    });
  }, [highScores, playerName, user]);

  useEffect(() => {
      const initAuth = async () => {
          const redirectResult = await BackendService.resolveGoogleRedirect();
          if (redirectResult.success && redirectResult.user) {
              hydrateSupportRank(redirectResult.user).then(setUser).catch(() => setUser(redirectResult.user!));
              setPlayerName(prev => prev.trim() ? prev : redirectResult.user!.username);
              return;
          }

          const res = await BackendService.getSession();
          if (res.success && res.user) {
              hydrateSupportRank(res.user).then(setUser).catch(() => setUser(res.user!));
              setPlayerName(prev => prev.trim() ? prev : res.user!.username);
          }
      };

      initAuth();
  }, []);

  useEffect(() => {
    if (!user) {
      previousCurrencyRef.current = null;
      currencyHydratedRef.current = false;
      return;
    }

    const currentCurrency = user.currency || 0;
    if (!currencyHydratedRef.current) {
      previousCurrencyRef.current = currentCurrency;
      currencyHydratedRef.current = true;
      return;
    }

    const previousCurrency = previousCurrencyRef.current ?? currentCurrency;
    if (currentCurrency > previousCurrency) {
      const gain = currentCurrency - previousCurrency;
      if (suppressNextCreditToastRef.current) {
        suppressNextCreditToastRef.current = false;
      } else {
        setCreditToast({
          id: Date.now(),
          amount: gain,
          total: currentCurrency,
        });
      }
    }

    previousCurrencyRef.current = currentCurrency;
  }, [user]);

  useEffect(() => {
    if (!creditToast) return;
    const timer = window.setTimeout(() => {
      setCreditToast((current) => (current?.id === creditToast.id ? null : current));
    }, 2400);
    return () => window.clearTimeout(timer);
  }, [creditToast]);

  useEffect(() => {
    if (!creditToast) setCreditCopiedId(null);
  }, [creditToast]);

  useEffect(() => {
    if (!showUpdateHistory) return;
    if (filteredUpdateLog.length === 0) return;
    if (!filteredUpdateLog.some((entry) => entry.id === selectedUpdateId)) {
      setSelectedUpdateId(filteredUpdateLog[0].id);
    }
  }, [filteredUpdateLog, selectedUpdateId, showUpdateHistory]);

  const handleCreditToastClick = async (t: { id: number; amount: number; total: number }) => {
    try {
      await navigator.clipboard.writeText(String(t.total));
      setCreditCopiedId(t.id);
      setTimeout(() => setCreditCopiedId((cur) => (cur === t.id ? null : cur)), 1400);
    } catch {
      // ignore clipboard failures silently
    }
  };

  useEffect(() => {
    if (!engine || !user) return;
    engine.setPlayerSkin(user.equippedItem || 'default', user.supporterRank || 'standard');
  }, [engine, user?.equippedItem, user?.supporterRank, user]);

  useEffect(() => {
    if (!user) return;
    const nextCallsign = playerName.trim();
    if (!nextCallsign || nextCallsign === user.username) return;

    const id = window.setTimeout(async () => {
      const result = await BackendService.updateCallsign(nextCallsign);
      if (result.success) {
        setUser(prev => prev ? { ...prev, username: nextCallsign } : prev);
      }
    }, 450);

    return () => window.clearTimeout(id);
  }, [playerName, user]);

  useEffect(() => {
      // Connect real-time global leaderboard from Firebase Firestore database
      const unsubscribe = BackendService.listenToLeaderboard((scores) => {
          setHighScores(scores);
      });
      return () => unsubscribe();
  }, []);

  useEffect(() => {
      if (engine) engine.sound.muteGameSounds = !isPlaying;
  }, [engine, isPlaying]);

  useEffect(() => {
    if (engine) {
        engine.setSettings(settings);
    }
  }, [engine, settings]);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingContext =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (isTypingContext || event.repeat) return;

      const key = event.key.toLowerCase();
      if (key === 'k') {
        if (!isPlaying || !engine || isSpectating) return;
        event.preventDefault();
        engine.player.takeDamage(engine.player.maxHealth + engine.player.maxShield + 999, engine.player.id);
        playSelect();
        return;
      }

      if (key === 'o') {
        event.preventDefault();
        setShowAlmanac(true);
        playSelect();
        return;
      }

      if (key === 'p') {
        if (!isPlaying) return;
        event.preventDefault();
        setSettings((prev) => ({ ...prev, showLeaderboard: !prev.showLeaderboard }));
        playSelect();
        return;
      }

      if (key === 'b') {
        if (!isPlaying || !engine || isSpectating || !gameState?.rebirthEligible) return;
        event.preventDefault();
        engine.triggerRebirthSelection();
        playSelect();
        return;
      }

      if (key === 'm') {
        event.preventDefault();
        setSettings((prev) => {
          const currentlyMuted = prev.volume <= 0.0001 && prev.musicVolume <= 0.0001;
          if (currentlyMuted) {
            const restore = lastUnmutedVolumesRef.current;
            return {
              ...prev,
              volume: Math.max(0.02, restore.volume || DEFAULT_SETTINGS.volume),
              musicVolume: Math.max(0.02, restore.musicVolume || DEFAULT_SETTINGS.musicVolume),
            };
          }

          lastUnmutedVolumesRef.current = {
            volume: prev.volume,
            musicVolume: prev.musicVolume,
          };
          return { ...prev, volume: 0, musicVolume: 0 };
        });
        playSelect();
        return;
      }

      if (!isSpectating || !engine) return;

      if (key === 'escape') {
        event.preventDefault();
        playSelect();
        engine.exitSpectateMode();
        setIsPlaying(false);
        setIsSpectating(false);
        hideTT();
        return;
      }

      if (key === 'arrowright' || key === 'd') {
        event.preventDefault();
        playSelect();
        engine.cycleSpectateTarget(1);
        return;
      }

      if (key === 'arrowleft' || key === 'a') {
        event.preventDefault();
        playSelect();
        engine.cycleSpectateTarget(-1);
      }
    };

    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, [engine, gameState?.rebirthEligible, isPlaying, isSpectating, playSelect]);

  const showTT = (label: string, desc?: string) => {
    setTooltip({ label, desc, visible: true });
    playHover();
  };

  const hideTT = () => setTooltip(prev => ({ ...prev, visible: false }));

  async function hydrateSupportRank(nextUser: User): Promise<User> {
    try {
      const rank = await BackendService.getSupporterRank(nextUser.token);
      return { ...nextUser, supporterRank: rank };
    } catch {
      return nextUser;
    }
  }

  const handleGameOver = useCallback(async (stats: { 
    score: number, 
    level: number, 
    classType: TankClass, 
    kills: number, 
    eliteKills: number, 
    transformations: number,
    eliteSkinsKilled?: TankClass[] 
  }) => {
    engine?.setAttractMode(true);
    
    if (user) {
        suppressNextCreditToastRef.current = true;
        // Prepare session stats to add
        const sessionStats: Partial<UserStats> = {
            totalScore: stats.score,
            totalKills: stats.kills,
            totalDeaths: 1,
            maxLevel: stats.level,
            eliteKills: stats.eliteKills,
            transformations: stats.transformations,
            totalGames: 1
        };
        
        // Calculate dynamic reward: 1 Credit/100 score + 10/kill + 100/elite kill
        const currencyReward = Math.floor(stats.score / 100) + (stats.kills * 10) + (stats.eliteKills * 100);
        
        const result = await BackendService.updateUserStats(
            user.username, 
            sessionStats, 
            currencyReward, 
            stats.eliteSkinsKilled || []
        );
        if (result && result.user) {
            setUser(await hydrateSupportRank(result.user));
            setLastDeathReport({
              moneyEarned: result.currencyEarned,
              unlockedAchievements: result.newlyUnlocked?.length || 0,
              unlockedQuests: result.newlyUnlockedQuests?.length || 0,
            });
            if (result.newlyUnlocked && result.newlyUnlocked.length > 0) {
                setNewlyUnlocked(result.newlyUnlocked);
                setShowAchievementPopup(true);
                engine?.sound.playAchievement();
            }
        }

        // Submit highscore to Firestore global leaderboard
        if (stats.score > 0) {
            const callsign = (playerName || '').trim() || user.username;
            await BackendService.submitHighScore(callsign, stats.score, stats.level, stats.classType, user.token);
        }
    }
  }, [user, engine, playerName]);

  const handleStartGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (engine) {
        if ((gameMode === GameMode.TEAMS || gameMode === GameMode.DOMINION) && !engine.canJoinTeam(selectedTeam)) {
            engine.addNotification("TEAM UNBALANCED - CHOOSE OTHER SIDE", "#ff4444");
            return;
        }
        silenceMenuMusic();
        engine.sound.enable();
        engine.sound.playUIClick();
        engine.setPlayerName(playerName || 'GUEST_PILOT');
        engine.setGameMode(gameMode);
        engine.setPlayerSkin(user?.equippedItem || 'default', user?.supporterRank || 'standard');
        engine.setPlayerColor(activeColor);
        engine.setPlayerTeam(selectedTeam);
        engine.setAttractMode(false);
        engine.resetPlayer(false);
        setLastDeathReport(null);
        setIsPlaying(true);
        setIsSpectating(false);
        hideTT();
    }
  };

  const handleCopyUpdateLog = useCallback(async (text: string, label: string, exportRef?: React.RefObject<HTMLTextAreaElement | null>) => {
    if (!text.trim()) {
      setOwnerCopyStatus('Nothing to copy yet.');
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setOwnerCopyStatus(`${label} copied. Paste it straight into Discord.`);
      return;
    } catch {
      const target = exportRef?.current;
      if (target) {
        target.focus();
        target.select();
        target.setSelectionRange(0, target.value.length);
      }

      try {
        const copied = document.execCommand('copy');
        if (copied) {
          setOwnerCopyStatus(`${label} copied using compatibility mode. Paste it straight into Discord.`);
        } else {
          setOwnerCopyStatus(`${label} selected below. Press Ctrl+C, then paste it into Discord.`);
        }
      } catch {
        setOwnerCopyStatus(`${label} selected below. Press Ctrl+C, then paste it into Discord.`);
      }
    }
  }, []);

  const handleSpectate = () => {
    if (engine) {
        silenceMenuMusic();
        engine.sound.enable();
        engine.sound.playUIClick();
        engine.setGameMode(gameMode);
        engine.enterSpectateMode();
        setIsPlaying(true);
        setIsSpectating(true);
        hideTT();
    }
  };

  const exitSpectate = useCallback(() => {
    playClick();
    engine?.exitSpectateMode();
    setIsPlaying(false);
    setIsSpectating(false);
    hideTT();
  }, [engine, playClick]);

  const handleMouseMoveApp = (e: React.MouseEvent) => { 
    if (!isPlaying) {
        setMenuMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const teamCounts = engine?.getTeamCounts() || { [Team.BLUE]: 0, [Team.RED]: 0, [Team.GREEN]: 0, [Team.PURPLE]: 0, [Team.NONE]: 0 };

  return (
    <div onMouseMove={handleMouseMoveApp} className="relative w-full h-full overflow-hidden bg-[#010101] font-ubuntu selection:bg-cyan-500 selection:text-black cursor-none">
      <CustomCursor isPlaying={isPlaying} />
      <div className="hex-grid" />
      <div className="scanline" />
      <GameCanvas onStateUpdate={setGameState} onEngineInit={setEngine} onGameOver={handleGameOver} gameMode={gameMode} settings={settings} />

      <AnimatePresence>
        {creditToast && (
          <motion.div
            key={creditToast.id}
            initial={{ opacity: 0, x: 24, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 18, y: 8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="pointer-events-none absolute right-4 top-4 z-[320] w-[min(92vw,360px)] sm:right-6 sm:top-6"
          >
            <div
              role="status"
              aria-live="polite"
              onClick={() => handleCreditToastClick(creditToast)}
              className="pointer-events-auto cursor-pointer overflow-hidden rounded-[1.4rem] border border-amber-300/16 bg-[linear-gradient(145deg,rgba(7,16,28,0.96),rgba(6,12,22,0.98))] shadow-[0_24px_80px_rgba(0,0,0,0.52)] backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 hover:border-amber-300/26"
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/60 to-transparent" />
              <div className="absolute inset-y-0 left-0 w-1 bg-[linear-gradient(180deg,#f59e0b,#facc15)]" />
              <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-amber-300/10 blur-3xl" />

              <div className="relative flex items-start gap-4 px-4 py-4 sm:px-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-300/18 bg-[radial-gradient(circle_at_30%_30%,rgba(255,215,100,0.28),rgba(255,159,28,0.08))]">
                  <svg className="h-7 w-7 text-amber-300" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                    <circle cx="12" cy="12" r="8.5" fill="url(#credit-toast-gain)" />
                    <path d="M12 8v8M8.25 12h7.5" stroke="#3b2500" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    <defs>
                      <linearGradient id="credit-toast-gain" x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#FDE68A" />
                        <stop offset="1" stopColor="#F59E0B" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.26em] text-amber-100/66">Credits Added</div>
                    <div className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-white/46">
                      Click to copy balance
                    </div>
                  </div>

                  <motion.div
                    className="mt-2 flex items-end justify-between gap-4"
                    initial={{ opacity: 0.85, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                  >
                    <div className="min-w-0">
                      <div className="text-[clamp(1.45rem,3vw,2rem)] font-black tracking-tight text-amber-300">
                        +{creditToast.amount.toLocaleString()}
                      </div>
                      <div className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-white/42">
                        Command reserve updated
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-[9px] font-black uppercase tracking-[0.16em] text-white/36">New Balance</div>
                      <div className="mt-1 text-lg font-black text-white">{creditToast.total.toLocaleString()}</div>
                    </div>
                  </motion.div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <motion.div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#f59e0b,#facc15,#fde68a)] shadow-[0_0_18px_rgba(250,204,21,0.3)]"
                        initial={{ width: '12%' }}
                        animate={{ width: '100%' }}
                        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                    <div className="min-w-[62px] text-right text-xs font-bold uppercase tracking-[0.12em] text-white/58">
                      {creditCopiedId === creditToast.id ? 'Copied' : 'Ready'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {isPlaying && gameState && !isSpectating && (
        <OverlayErrorBoundary onExit={() => { setIsPlaying(false); engine?.setAttractMode(true); }}>
          <UIOverlay
            gameState={gameState}
            onUpgradeStat={(s) => engine?.upgradeStat(engine.player, s)}
            onUpgradeClass={(c) => engine?.upgradeClass(c)}
            onUpgradeSector={(sector) => engine?.upgradeSecondarySector(sector)}
            onRestart={() => { setLastDeathReport(null); engine?.resetPlayer(true); }}
            onExit={() => { setIsPlaying(false); engine?.setAttractMode(true); }}
            onSpectateKiller={() => {
              const targetId = gameState.deathKiller?.spectateTargetId;
              if (!engine || targetId == null) return;
              const locked = engine.spectateEntityById(targetId);
              if (!locked) return;
              playSelect();
              setIsPlaying(true);
              setIsSpectating(true);
              hideTT();
            }}
            highScores={displayHighScores}
            playHover={playHover}
            engine={engine}
            settings={settings}
            deathReport={lastDeathReport}
          />
        </OverlayErrorBoundary>
      )}

      {isPlaying && isSpectating && (
        <div className="absolute inset-x-0 bottom-10 z-50 flex flex-col items-center gap-5 animate-in fade-in slide-in-from-bottom-8 duration-700 pointer-events-none">
            <div className="min-w-[300px] max-w-[min(92vw,560px)] rounded-[2rem] border border-cyan-400/16 bg-[linear-gradient(180deg,rgba(4,10,18,0.92),rgba(2,6,12,0.96))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.72)] backdrop-blur-2xl pointer-events-auto">
                <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.32em] text-cyan-300/75">Spectate Mode</div>
                        <div className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-white/36">
                            {engine?.spectateTarget ? 'Locked to live bot feed' : 'No bots available to spectate'}
                        </div>
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-white/50">
                        Arrows / A D
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => { playClick(); engine?.cycleSpectateTarget(-1); }}
                        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-white/40 transition-all hover:bg-white/10 hover:text-cyan-400 active:scale-90"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    
                    <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.28em]">Observed Unit</span>
                        <h3 className="mt-1 truncate text-2xl font-black uppercase tracking-tight text-white">
                            {engine?.spectateTarget?.name || 'Scanning Grid'}
                        </h3>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-white/52">
                                LVL {engine?.spectateTarget?.level || '--'}
                            </div>
                            <div className="rounded-full border border-cyan-400/18 bg-cyan-400/8 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-cyan-200/86">
                                {engine?.spectateTarget?.classType || 'Awaiting Target'}
                            </div>
                            {engine?.spectateTarget?.team !== undefined && (
                              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-white/45">
                                Team {engine?.spectateTarget?.team}
                              </div>
                            )}
                        </div>
                    </div>

                    <button 
                        onClick={() => { playClick(); engine?.cycleSpectateTarget(1); }}
                        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-white/40 transition-all hover:bg-white/10 hover:text-cyan-400 active:scale-90"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>
            </div>

            <button 
                onClick={exitSpectate}
                className="rounded-2xl border border-white/10 bg-white/5 px-8 py-3 text-[11px] font-black uppercase tracking-[0.3em] text-white/55 transition-all hover:bg-white/10 hover:text-white pointer-events-auto"
            >
                Return To Command
            </button>
        </div>
      )}

      {/* Main Menu Tooltip Layer */}
      {!isPlaying && menuBootPhase === 'ready' && (
          <TacticalTooltip 
            label={tooltip.label} 
            desc={tooltip.desc} 
            visible={tooltip.visible} 
            x={menuMousePos.x} 
            y={menuMousePos.y} 
          />
      )}

      {!isPlaying && menuBootPhase === 'ready' && (
        <MainMenu 
          isPlaying={isPlaying}
          bootPhase={menuBootPhase}
          playerName={playerName}
          setPlayerName={setPlayerName}
          user={user}
          setUser={setUser}
          highScores={displayHighScores}
          gameMode={gameMode}
          setGameMode={setGameMode}
          selectedTeam={selectedTeam}
          setSelectedTeam={setSelectedTeam}
          handleStartGame={handleStartGame}
          handleSpectate={handleSpectate}
          spectateAvailable={engine?.hasSpectateTargets() ?? false}
          musicSnapshot={menuMusicSnapshot}
          showTT={showTT}
          hideTT={hideTT}
          playClick={playClick}
          playHover={playHover}
          playSelect={playSelect}
          setShowLogin={setShowLogin}
          setShowSettings={setShowSettings}
          setShowAlmanac={setShowAlmanac}
          setShowShop={setShowShop}
          setShowUpdateHistory={setShowUpdateHistory}
          setShowAchievements={setShowAchievements}
          setShowSupport={setShowSupport}
          updateLog={UPDATE_LOG}
          parallax={parallax}
          activeColor={activeColor}
          teamCounts={teamCounts}
          canJoinTeam={(t) => engine?.canJoinTeam(t) ?? true}
        />
      )}

      <AnimatePresence>
        {!isPlaying && (menuBootPhase === 'unlocking' || menuBootPhase === 'revealing') && (
          <motion.div
            key={`menu-boot-loading-${menuBootPhase}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 z-[90] overflow-hidden bg-[radial-gradient(circle_at_50%_24%,rgba(34,211,238,0.14),transparent_24%),radial-gradient(circle_at_50%_78%,rgba(96,165,250,0.08),transparent_34%),linear-gradient(180deg,rgba(2,8,20,0.96),rgba(1,5,14,0.99))]"
          >
            <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:44px_44px]" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_22%,transparent_78%,rgba(255,255,255,0.02))]" />
            <div className="absolute inset-0 flex items-center justify-center px-6 py-8">
              <div className="w-full max-w-[860px] overflow-hidden rounded-[2.2rem] border border-cyan-300/16 bg-[linear-gradient(180deg,rgba(5,18,34,0.82),rgba(2,9,20,0.92))] shadow-[0_30px_120px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent" />
                <div className="grid gap-0 lg:grid-cols-[minmax(280px,0.42fr)_minmax(0,0.58fr)]">
                  <div className="relative border-b border-cyan-300/8 px-8 py-8 lg:border-b-0 lg:border-r">
                    <div className="pointer-events-none absolute right-6 top-6 h-28 w-28 rounded-full bg-cyan-400/10 blur-3xl" />
                    <div className="text-[10px] font-black uppercase tracking-[0.34em] text-cyan-200/74">
                      {menuBootPhase === 'unlocking' ? 'System Bootstrap' : 'Command Deck Render'}
                    </div>
                    <h2 className="mt-4 text-[clamp(2rem,4vw,3.3rem)] font-black uppercase leading-[0.95] tracking-[0.1em] text-white">
                      {menuBootPhase === 'unlocking' ? 'Loading Systems' : 'Menu Uplink Ready'}
                    </h2>
                    <p className="mt-4 max-w-[24rem] text-[0.98rem] leading-7 text-cyan-100/60">
                      {menuBootPhase === 'unlocking'
                        ? 'Waking the audio core, sampling live frequency bands, and calibrating the interface shell.'
                        : 'Command deck assets are locked in. Final display checks are clearing before full control is handed over.'}
                    </p>

                    <div className="mt-7 grid gap-3">
                      {[
                        { label: 'Audio Core', value: menuBootPhase === 'unlocking' ? 'Active' : 'Stable' },
                        { label: 'Visualizer Sync', value: menuMusicSnapshot?.paused ? 'Waiting' : 'Live' },
                        { label: 'Interface Status', value: menuBootPhase === 'unlocking' ? 'Compiling' : 'Deploying' },
                      ].map((item, index) => (
                        <div key={item.label} className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/44">{item.label}</div>
                          <div className="flex items-center gap-2">
                            <motion.span
                              className="h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,0.85)]"
                              animate={{ opacity: [0.45, 1, 0.45], scale: [1, 1.14, 1] }}
                              transition={{ duration: 1 + index * 0.15, repeat: Infinity, ease: 'easeInOut' }}
                            />
                            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/82">{item.value}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="relative px-8 py-8">
                    <div className="rounded-[1.8rem] border border-cyan-300/12 bg-black/18 p-6">
                      <div className="mb-6 flex items-center justify-center">
                        <div className="relative flex h-[176px] w-[176px] items-center justify-center">
                          <motion.div
                            aria-hidden="true"
                            className="absolute inset-0 rounded-full border border-cyan-300/10"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                            style={{ borderTopColor: 'rgba(103,232,249,0.55)', borderRightColor: 'rgba(103,232,249,0.2)' }}
                          />
                          <motion.div
                            aria-hidden="true"
                            className="absolute inset-[14px] rounded-full border border-amber-300/10"
                            animate={{ rotate: -360 }}
                            transition={{ duration: 7.4, repeat: Infinity, ease: 'linear' }}
                            style={{ borderLeftColor: 'rgba(251,191,36,0.5)', borderBottomColor: 'rgba(251,191,36,0.18)' }}
                          />
                          <motion.div
                            aria-hidden="true"
                            className="absolute inset-[32px] rounded-full border border-violet-300/12"
                            animate={{ rotate: 360, scale: [1, 1.02, 1] }}
                            transition={{ rotate: { duration: 5.2, repeat: Infinity, ease: 'linear' }, scale: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' } }}
                            style={{ borderTopColor: 'rgba(167,139,250,0.46)' }}
                          />
                          <div className="absolute inset-[46px] rounded-full bg-[radial-gradient(circle,rgba(8,25,42,0.96),rgba(2,10,22,0.98))] shadow-[inset_0_0_48px_rgba(0,0,0,0.52)]" />
                          <motion.div
                            className="absolute inset-[64px] rounded-full"
                            animate={{ scale: [0.96, 1.06, 0.96], opacity: [0.55, 0.9, 0.55] }}
                            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                            style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.28), rgba(167,139,250,0.12) 55%, transparent 76%)' }}
                          />
                          <motion.div
                            className="relative h-4 w-4 rounded-full bg-cyan-300 shadow-[0_0_28px_rgba(103,232,249,0.95)]"
                            animate={{ scale: [1, 1.22, 1], opacity: [0.72, 1, 0.72] }}
                            transition={{ duration: 1.05, repeat: Infinity, ease: 'easeInOut' }}
                          />
                        </div>
                      </div>

                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300/68">Initialization Progress</div>
                          <div className="mt-2 text-sm leading-6 text-white/54">{menuBootLoadLabel}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/34">Completion</div>
                          <div className="mt-1 text-2xl font-black text-white">{Math.round(menuBootLoadProgress * 100)}%</div>
                        </div>
                      </div>

                      <div className="mt-6 overflow-hidden rounded-full border border-cyan-300/12 bg-white/[0.04] p-1">
                        <div className="relative h-4 overflow-hidden rounded-full bg-[linear-gradient(180deg,rgba(6,18,32,0.8),rgba(4,12,24,0.92))]">
                          <motion.div
                            className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,#22d3ee,#2dd4bf_48%,#a78bfa_100%)] shadow-[0_0_22px_rgba(34,211,238,0.34)]"
                            animate={{ width: `${Math.max(8, Math.round(menuBootLoadProgress * 100))}%` }}
                            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                          >
                            <motion.div
                              className="absolute inset-y-0 right-0 w-20 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.45),transparent)]"
                              animate={{ x: ['-130%', '220%'] }}
                              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                            />
                          </motion.div>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-10 gap-1.5">
                        {Array.from({ length: 10 }, (_, index) => {
                          const active = index / 10 < menuBootLoadProgress;
                          return (
                            <motion.div
                              key={`boot-segment-${index}`}
                              className="h-2 rounded-full"
                              animate={{
                                opacity: active ? [0.68, 1, 0.82] : 0.18,
                                scaleY: active ? [1, 1.12, 1] : 1,
                              }}
                              transition={{
                                duration: 0.9,
                                repeat: active ? Infinity : 0,
                                ease: 'easeInOut',
                                delay: index * 0.03,
                              }}
                              style={{
                                background: active
                                  ? index > 7
                                    ? 'linear-gradient(90deg, rgba(167,139,250,0.95), rgba(96,165,250,0.72))'
                                    : index > 4
                                      ? 'linear-gradient(90deg, rgba(45,212,191,0.95), rgba(34,211,238,0.72))'
                                      : 'linear-gradient(90deg, rgba(255,213,79,0.95), rgba(45,212,191,0.72))'
                                  : 'rgba(255,255,255,0.08)',
                              }}
                            />
                          );
                        })}
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        {[
                          { label: 'Signal', value: menuMusicSnapshot?.sectionLabel ?? 'Idle' },
                          { label: 'Energy', value: `${Math.round((menuMusicSnapshot?.energy ?? 0.28) * 100)}%` },
                          { label: 'Phase', value: menuBootPhase === 'unlocking' ? 'Stage 1/2' : 'Stage 2/2' },
                        ].map((item) => (
                          <div key={item.label} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                            <div className="text-[9px] font-black uppercase tracking-[0.18em] text-white/40">{item.label}</div>
                            <div className="mt-2 text-sm font-black uppercase tracking-[0.08em] text-white/84">{item.value}</div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-6">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200/70">Live Spectrum Feed</div>
                          <div className="text-[9px] font-black uppercase tracking-[0.16em] text-white/32">Reactive</div>
                        </div>
                        <div className="flex h-[88px] items-end gap-1.5">
                          {(menuMusicSnapshot?.bars?.slice(0, 18) ?? new Array(18).fill(0.22)).map((value, index) => (
                            <motion.div
                              key={`boot-loading-bar-${index}`}
                              className="flex-1 rounded-t-full"
                              animate={{
                                height: `${16 + Math.max(0.14, value) * 70}px`,
                                opacity: [0.42, 0.88, 0.42],
                              }}
                              transition={{
                                duration: 0.9 + index * 0.04,
                                repeat: Infinity,
                                ease: 'easeInOut',
                              }}
                              style={{
                                background: index % 4 === 0
                                  ? 'linear-gradient(180deg, rgba(255,213,79,0.98), rgba(34,211,238,0.2))'
                                  : index % 2 === 0
                                    ? 'linear-gradient(180deg, rgba(34,211,238,0.95), rgba(45,212,191,0.22))'
                                    : 'linear-gradient(180deg, rgba(167,139,250,0.92), rgba(96,165,250,0.18))',
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!isPlaying && menuBootOverlayVisible && (
          <ClickToPlayGate activating={menuBootUnlocking} onActivate={handleMenuBootOverlayActivate} />
        )}
      </AnimatePresence>

        {/* Modals */}
        {showLogin && <LoginModal onClose={() => setShowLogin(false)} onLoginSuccess={(u) => {
          hydrateSupportRank(u).then(setUser).catch(() => setUser(u));
          setPlayerName(prev => prev.trim() ? prev : u.username);
        }} darkMode={settings.darkMode} />}
        {showShop && <ShopModal user={user} onClose={() => setShowShop(false)} onUpdateUser={(u) => {
          hydrateSupportRank(u).then(setUser).catch(() => setUser(u));
        }} darkMode={settings.darkMode} playSound={playClick} />}
        {showAlmanac && <AlmanacModal onClose={() => setShowAlmanac(false)} darkMode={settings.darkMode} playSound={playClick} />}
        {showAchievements && <AchievementsModal user={user} onClose={() => setShowAchievements(false)} darkMode={settings.darkMode} playSound={playSelect} playHover={playHover} />}
        {showSettings && <SettingsModal settings={settings} setSettings={setSettings} onClose={() => setShowSettings(false)} playSound={playClick} onVolumeChange={(v) => engine?.sound.setVolume(v)} />}
        
        {showAchievementPopup && <AchievementPopup achievements={newlyUnlocked} onClose={() => setShowAchievementPopup(false)} />}
        
        {showUpdateHistory && (
            <div
              className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/88 p-6 backdrop-blur-[24px] animate-in fade-in duration-200"
              onClick={() => setShowUpdateHistory(false)}
            >
                <div
                  className="relative flex h-[88vh] w-full max-w-[1100px] flex-col overflow-hidden rounded-[2rem] border border-cyan-400/18 bg-[linear-gradient(180deg,#07111d,#040913)] shadow-[0_30px_120px_rgba(0,0,0,0.82)] animate-in zoom-in-95 duration-200"
                  onClick={e => e.stopPropagation()}
                >
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/55 to-transparent" />
                    <textarea
                      ref={archiveCopyFallbackRef}
                      readOnly
                      value={fullArchiveClipboardText}
                      aria-hidden="true"
                      tabIndex={-1}
                      className="pointer-events-none absolute left-[-9999px] top-0 h-px w-px opacity-0"
                    />
                    <textarea
                      ref={selectedReleaseExportRef}
                      readOnly
                      value={selectedUpdateClipboardText}
                      aria-hidden="true"
                      tabIndex={-1}
                      className="pointer-events-none absolute left-[-9999px] top-0 h-px w-px opacity-0"
                    />
                    <textarea
                      ref={fullArchiveExportRef}
                      readOnly
                      value={fullArchiveClipboardText}
                      aria-hidden="true"
                      tabIndex={-1}
                      className="pointer-events-none absolute left-[-9999px] top-0 h-px w-px opacity-0"
                    />

                    <div className="flex items-start justify-between gap-6 border-b border-white/8 bg-[linear-gradient(180deg,rgba(9,18,30,0.94),rgba(6,12,22,0.9))] px-8 py-7">
                        <div className="min-w-0">
                            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-300/76">Update Log</div>
                            <h2 className="mt-2 text-3xl font-black tracking-tight text-white">Latest VEXTOR Changes</h2>
                            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-white/56">
                              Straight patch notes, less noise. Pick a release on the left, read the full briefing on the right, and copy the context when you want to post it somewhere else.
                            </p>
                        </div>
                        <button
                          onClick={() => setShowUpdateHistory(false)}
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/62 transition hover:bg-white/[0.1] hover:text-white"
                          aria-label="Close update log"
                        >
                          <span className="text-lg font-black leading-none">×</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-3 border-b border-white/8 bg-white/[0.02] px-8 py-4">
                        <div className="min-w-0 flex-1">
                            <input
                              value={updateSearch}
                              onChange={(event) => setUpdateSearch(event.target.value)}
                              placeholder="Search version, title, feature, or tag..."
                              className="w-full rounded-2xl border border-white/10 bg-[#06101b] px-4 py-3 text-[14px] font-semibold text-white outline-none placeholder:text-white/28 focus:border-cyan-300/35"
                            />
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            <button
                              onClick={() => handleCopyUpdateLog(selectedUpdateClipboardText, 'Selected release', selectedReleaseExportRef)}
                              className="rounded-xl border border-amber-300/24 bg-amber-400/12 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-amber-100 transition hover:bg-amber-400/18"
                            >
                              Copy Selected
                            </button>
                            <button
                              onClick={() => handleCopyUpdateLog(fullArchiveClipboardText, 'Full update log', fullArchiveExportRef)}
                              className="rounded-xl border border-cyan-300/22 bg-cyan-400/10 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100 transition hover:bg-cyan-400/16"
                            >
                              Copy Full Log
                            </button>
                        </div>
                    </div>

                    <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)]">
                        <aside className="custom-scrollbar min-h-0 overflow-y-auto border-r border-white/8 bg-[linear-gradient(180deg,rgba(5,11,20,0.94),rgba(4,8,16,0.98))] p-5">
                            <div className="mb-3 flex items-center justify-between gap-3 px-1">
                                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-white/42">
                                  {filteredUpdateLog.length} release{filteredUpdateLog.length === 1 ? '' : 's'}
                                </div>
                                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-200/48">
                                  Desktop archive
                                </div>
                            </div>

                            <div className="space-y-2.5">
                                {filteredUpdateLog.length > 0 ? filteredUpdateLog.map((item, idx) => {
                                  const active = item.id === selectedUpdate?.id;
                                  return (
                                    <button
                                      key={`nav-${item.id}`}
                                      onClick={() => setSelectedUpdateId(item.id)}
                                      className={`w-full rounded-[1.2rem] border px-4 py-3.5 text-left transition-all ${
                                        active
                                          ? 'border-cyan-400/38 bg-cyan-500/[0.09] shadow-[0_0_0_1px_rgba(34,211,238,0.08)]'
                                          : 'border-white/8 bg-white/[0.025] hover:border-white/14 hover:bg-white/[0.05]'
                                      }`}
                                    >
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] ${
                                          active ? 'border-cyan-300/22 bg-cyan-400/10 text-cyan-200' : 'border-white/10 bg-white/[0.03] text-white/46'
                                        }`}>
                                          {item.id}
                                        </span>
                                        {idx === 0 && (
                                          <span className="rounded-full border border-amber-300/18 bg-amber-400/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-amber-200">
                                            Latest
                                          </span>
                                        )}
                                      </div>
                                      <div className={`mt-3 text-[15px] font-black leading-6 ${active ? 'text-white' : 'text-white/84'}`}>
                                        {item.title}
                                      </div>
                                      <div className="mt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white/34">
                                        {item.date}
                                      </div>
                                    </button>
                                  );
                                }) : (
                                  <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.025] px-4 py-5 text-sm leading-6 text-white/54">
                                    Nothing matched this search. Try a release id, title, feature, or tag.
                                  </div>
                                )}
                            </div>
                        </aside>

                        <section className="custom-scrollbar min-h-0 overflow-y-auto px-8 py-7">
                            {selectedUpdate ? (
                              <div className="mx-auto max-w-[720px]">
                                  <div className="border-b border-white/8 pb-6">
                                      <div className="flex flex-wrap items-center gap-2">
                                          <span className="rounded-full border border-cyan-300/22 bg-cyan-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">
                                            {selectedUpdate.id}
                                          </span>
                                          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/68">
                                            {selectedUpdate.theme ?? 'Update'}
                                          </span>
                                          <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/38">
                                            {selectedUpdate.date}
                                          </span>
                                      </div>
                                      <h3 className="mt-4 text-[2.35rem] font-black leading-[1.05] tracking-tight text-white">
                                        {selectedUpdate.title}
                                      </h3>
                                      <p className="mt-4 text-[15px] leading-8 text-white/70">
                                        {selectedUpdate.content}
                                      </p>
                                      {(selectedUpdate.tags?.length ?? 0) > 0 && (
                                        <div className="mt-5 flex flex-wrap gap-2">
                                          {(selectedUpdate.tags ?? []).map((tag) => (
                                            <span
                                              key={`${selectedUpdate.id}-tag-${tag}`}
                                              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/58"
                                            >
                                              {tag}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                  </div>

                                  <div className="mt-6 space-y-4">
                                      {(selectedUpdate.sections ?? []).map((section, index) => (
                                        <article
                                          key={`${selectedUpdate.id}-${section.label}`}
                                          className="rounded-[1.35rem] border border-white/8 bg-white/[0.025] px-5 py-5"
                                        >
                                            <div className="flex items-center justify-between gap-3 border-b border-white/7 pb-3">
                                                <div className="flex items-center gap-3">
                                                    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-cyan-300/22 bg-cyan-400/10 text-[10px] font-black text-cyan-200">
                                                      {index + 1}
                                                    </span>
                                                    <h4 className="text-[16px] font-black uppercase tracking-[0.06em] text-white">
                                                      {section.label}
                                                    </h4>
                                                </div>
                                                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/32">
                                                  {section.items.length} notes
                                                </span>
                                            </div>
                                            <ul className="mt-4 space-y-3">
                                                {section.items.map((line) => (
                                                  <li key={line} className="flex items-start gap-3 text-[15px] leading-7 text-white/74">
                                                      <span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.4)]" />
                                                      <span>{line}</span>
                                                  </li>
                                                ))}
                                            </ul>
                                        </article>
                                      ))}
                                  </div>

                                  <div className="mt-6 rounded-[1.2rem] border border-white/8 bg-black/18 px-4 py-3 text-sm leading-6 text-white/68">
                                    {ownerCopyStatus || 'Copy the selected release or the full log whenever you want the full patch-note context ready to paste.'}
                                  </div>
                              </div>
                            ) : (
                              <div className="mx-auto flex h-full max-w-[620px] items-center justify-center">
                                  <div className="w-full rounded-[1.5rem] border border-white/8 bg-white/[0.025] px-6 py-8 text-center">
                                      <div className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200/58">No Release Loaded</div>
                                      <div className="mt-3 text-2xl font-black text-white">Nothing to show right now.</div>
                                      <p className="mt-3 text-[15px] leading-7 text-white/56">
                                        Try a different search or clear the current filter to bring the archive back.
                                      </p>
                                  </div>
                              </div>
                            )}
                        </section>
                    </div>
                </div>
            </div>
        )}
        {showSupport && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-[28px] animate-in fade-in duration-300 p-4" onClick={() => setShowSupport(false)}>
                <div
                  className="w-full max-w-5xl overflow-hidden rounded-[2.25rem] border border-cyan-400/20 bg-[#030814] shadow-[0_30px_120px_rgba(0,0,0,0.82)]"
                  onClick={e => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-[linear-gradient(135deg,rgba(6,12,28,0.96),rgba(9,20,36,0.92))] px-6 py-5 md:px-8">
                        <div className="flex items-center gap-4">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 shadow-[0_0_30px_rgba(34,211,238,0.12)]">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m5-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-[0.32em] text-cyan-300/70">Community Terminal</div>
                                <h2 className="mt-1 text-2xl md:text-3xl font-black uppercase tracking-[0.06em] text-white">Need Help Or Company?</h2>
                            </div>
                        </div>
                        <button
                          onClick={() => setShowSupport(false)}
                          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-white/55 transition hover:bg-white/[0.08] hover:text-white"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                    </div>

                    <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
                        <section className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_42%),linear-gradient(180deg,rgba(4,12,24,0.96),rgba(4,8,18,0.98))] px-6 py-6 md:px-8 lg:border-b-0 lg:border-r">
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200">
                                  Discord Help Hub
                                </span>
                                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/55">
                                  Talk, ask, connect
                                </span>
                            </div>

                            <div className="mt-6 grid gap-4 sm:grid-cols-3">
                                <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.035] p-4">
                                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">Live Support</div>
                                    <div className="mt-2 text-3xl font-black text-white">Discord</div>
                                    <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white/35">Fastest place to reach me</div>
                                </div>
                                <div className="rounded-[1.4rem] border border-cyan-300/25 bg-cyan-300/10 p-4">
                                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200">Best For</div>
                                    <div className="mt-2 text-2xl font-black text-white">Help + Community</div>
                                    <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white/50">Questions, bugs, and people to talk to</div>
                                </div>
                                <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.035] p-4">
                                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">Availability</div>
                                    <div className="mt-2 text-lg font-black text-white">Open</div>
                                    <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white/35">Jump in whenever you need it</div>
                                </div>
                            </div>

                            <div className="mt-6 rounded-[1.6rem] border border-white/10 bg-black/25 p-5">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <div className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-300/70">Terminal Brief</div>
                                        <h3 className="mt-2 text-xl font-black text-white">A direct line when someone needs help.</h3>
                                    </div>
                                    <div className="hidden md:flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/45">
                                        Community first
                                    </div>
                                </div>
                                <div className="mt-4 grid gap-3 md:grid-cols-3">
                                    {[
                                      { title: 'Ask For Help', body: 'If something feels broken, confusing, or frustrating, Discord is the quickest place to ask.' },
                                      { title: 'Find People', body: 'Players who want someone to talk to or queue with can jump into the community server.' },
                                      { title: 'Stay Updated', body: 'Important fixes, changes, and direct responses can all be shared there in one place.' }
                                    ].map((item) => (
                                      <div key={item.title} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                                          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/42">{item.title}</div>
                                          <p className="mt-2 text-sm leading-6 text-white/68">{item.body}</p>
                                      </div>
                                    ))}
                                </div>
                            </div>
                        </section>

                        <aside className="bg-[linear-gradient(180deg,rgba(8,10,18,0.98),rgba(5,7,14,0.98))] px-6 py-6 md:px-8">
                            <div className="rounded-[1.75rem] border border-cyan-300/18 bg-white/[0.03] p-5">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300/65">Discord Relay</div>
                                        <h3 className="mt-2 text-lg font-black text-white">Open the community server</h3>
                                    </div>
                                    <div className="rounded-full border border-emerald-300/20 bg-emerald-400/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">
                                      Available
                                    </div>
                                </div>

                                <div className="mt-5 rounded-[1.2rem] border border-white/10 bg-white/[0.03] px-4 py-3">
                                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">What you can use it for</div>
                                    <p className="mt-2 text-sm leading-6 text-white/72">
                                      Need support, want to report a bug, or just want people to talk to? The Discord server is the main place to reach out.
                                    </p>
                                </div>

                                <div className="mt-5 rounded-[1.35rem] border border-white/10 bg-black/20 p-4">
                                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/42">Quick reasons to join</div>
                                    <div className="mt-3 space-y-2">
                                      {[
                                        { title: 'Bug Help', note: 'Get answers or report issues fast', accent: '#67e8f9' },
                                        { title: 'Community', note: 'Talk with players and hang out', accent: '#34d399' },
                                        { title: 'Updates', note: 'See what is changing and when', accent: '#a78bfa' },
                                      ].map((item, idx) => (
                                          <div key={item.title} className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
                                              <div className="flex items-center gap-3">
                                                  <span className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-black text-black" style={{ background: item.accent }}>
                                                    {idx + 1}
                                                  </span>
                                                  <div>
                                                      <div className="text-sm font-black text-white">{item.title}</div>
                                                      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">{item.note}</div>
                                                  </div>
                                              </div>
                                              <span className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: item.accent }}>
                                                Live
                                              </span>
                                          </div>
                                      ))}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                                <a
                                  href="https://discord.gg/CSwJKCs4kW"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-center rounded-[1.25rem] border border-cyan-300/25 bg-cyan-500/85 px-5 py-4 text-center text-[11px] font-black uppercase tracking-[0.28em] text-white transition hover:bg-cyan-400"
                                >
                                  Open Discord Help Hub
                                </a>
                                <button
                                  onClick={() => setShowSupport(false)}
                                  className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] px-5 py-4 text-[11px] font-black uppercase tracking-[0.28em] text-white/55 transition hover:bg-white/[0.08] hover:text-white"
                                >
                                  Close Terminal
                                </button>
                            </div>
                        </aside>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default App;
