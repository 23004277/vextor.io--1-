
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

const SUPPORT_RANK_META: Record<User['supporterRank'], { label: string; accent: string; glow: string; tone: string }> = {
  standard: { label: 'Standard', accent: '#67e8f9', glow: 'rgba(103,232,249,0.16)', tone: 'Field access' },
  rank1: { label: 'Sovereign', accent: '#fbbf24', glow: 'rgba(251,191,36,0.2)', tone: 'Primary resonance' },
  rank2: { label: 'Elite', accent: '#a78bfa', glow: 'rgba(167,139,250,0.18)', tone: 'Command resonance' },
  rank3: { label: 'Patron', accent: '#34d399', glow: 'rgba(52,211,153,0.18)', tone: 'Support resonance' },
};

const SUPPORT_OPTIONS = [5, 25, 100] as const;

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
  const [supportTxnBusy, setSupportTxnBusy] = useState(false);
  const [supportTxnMsg, setSupportTxnMsg] = useState<string>('');
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
  const [menuBootUnlocked, setMenuBootUnlocked] = useState(false);
  const [menuBootOverlayVisible, setMenuBootOverlayVisible] = useState(true);
  const [menuBootUnlocking, setMenuBootUnlocking] = useState(false);
  const [menuMousePos, setMenuMousePos] = useState({ x: 0, y: 0 });
  const lastUnmutedVolumesRef = useRef<{ volume: number; musicVolume: number }>({
    volume: DEFAULT_SETTINGS.volume,
    musicVolume: DEFAULT_SETTINGS.musicVolume,
  });
  const menuMusicRef = useRef<BackgroundMusic | null>(null);
  const isPlayingRef = useRef(false);
  const menuBootFadeTimeoutRef = useRef<number | null>(null);
  const previousCurrencyRef = useRef<number | null>(null);
  const currencyHydratedRef = useRef(false);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const silenceMenuMusic = useCallback(() => {
    const music = menuMusicRef.current;
    if (!music) return;
    music.pauseImmediately();
    setMenuMusicSnapshot(music.getVisualizerFrame());
  }, []);

  const unlockMenuBoot = useCallback(async () => {
    if (menuBootUnlocked || menuBootUnlocking || isPlayingRef.current) return;

    setMenuBootUnlocking(true);
    try {
      engine?.sound.enable();
      const music = menuMusicRef.current;
      if (music) {
        try {
          await music.resume();
        } catch {
          // Fail silently so the menu never gets stuck behind the unlock gate.
        }
        setMenuMusicSnapshot(music.getVisualizerFrame());
      }
    } finally {
      setMenuBootUnlocked(true);
      if (menuBootFadeTimeoutRef.current != null) {
        window.clearTimeout(menuBootFadeTimeoutRef.current);
      }
      menuBootFadeTimeoutRef.current = window.setTimeout(() => {
        setMenuBootOverlayVisible(false);
        menuBootFadeTimeoutRef.current = null;
      }, 420);
      setMenuBootUnlocking(false);
    }
  }, [engine, menuBootUnlocked, menuBootUnlocking]);

  const handleMenuBootOverlayActivate = useCallback(() => {
    if (menuBootUnlocked || menuBootUnlocking || isPlayingRef.current) return;
    void unlockMenuBoot();
  }, [menuBootUnlocked, menuBootUnlocking, unlockMenuBoot]);

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

  const supportRankMeta = useMemo(() => {
    const rank = user?.supporterRank || 'standard';
    return SUPPORT_RANK_META[rank];
  }, [user?.supporterRank]);

  const supportStatusText = useMemo(() => {
    if (!user) return 'Sign in to track backing and activate supporter resonance.';
    if (supportTxnBusy) return 'Processing uplink transaction...';
    if (supportTxnMsg) return supportTxnMsg;
    return `Live supporter standing: ${supportRankMeta.label}. Top 3 backing totals receive active skin resonance.`;
  }, [supportRankMeta.label, supportTxnBusy, supportTxnMsg, user]);

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
    if (typeof window === 'undefined' || isPlaying || !menuBootUnlocked) return;
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
  }, [isPlaying, menuBootUnlocked]);

  useEffect(() => {
    const music = menuMusicRef.current;
    if (!music) return;
    music.setVolume(settings.musicVolume);
  }, [settings.musicVolume]);

  useEffect(() => {
    const music = menuMusicRef.current;
    if (!music) return;

    if (isPlaying || !menuBootUnlocked) {
      silenceMenuMusic();
      return;
    }

    music.resume().catch(() => undefined);
  }, [isPlaying, menuBootUnlocked, silenceMenuMusic]);

  useEffect(() => {
    return () => {
      if (menuBootFadeTimeoutRef.current != null) {
        window.clearTimeout(menuBootFadeTimeoutRef.current);
      }
    };
  }, []);

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
      setCreditToast({
        id: Date.now(),
        amount: gain,
        total: currentCurrency,
      });
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

  const handleSupportAction = useCallback(async (amount: number) => {
    if (!user || supportTxnBusy) return;
    setSupportTxnBusy(true);
    setSupportTxnMsg('');
    const res = await BackendService.addSupportContribution(amount);
    if (res.success && res.user) {
      const hydrated = await hydrateSupportRank(res.user);
      setUser(hydrated);
      setSupportTxnMsg(`Support uplink confirmed (+${amount}). Total backing: ${hydrated.supportTotal}.`);
    } else {
      setSupportTxnMsg(res.error || 'Support uplink failed.');
    }
    setSupportTxnBusy(false);
  }, [user, supportTxnBusy]);

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
            initial={{ opacity: 0, y: -28, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -18, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            className="absolute top-5 left-1/2 z-[320] -translate-x-1/2"
          >
            <div
              role="status"
              aria-live="polite"
              onClick={() => handleCreditToastClick(creditToast)}
              className="min-w-[260px] cursor-pointer rounded-2xl border border-amber-300/35 bg-[linear-gradient(135deg,rgba(24,18,6,0.96),rgba(54,40,10,0.94))] px-4 py-3 shadow-[0_20px_60px_rgba(255,140,0,0.06)] hover:scale-[1.01] transition-transform duration-160 pointer-events-auto flex items-center gap-3"
            >
              <div className="flex-shrink-0 scale-95">
                <svg className="h-10 w-10 text-amber-400 drop-shadow-[0_6px_18px_rgba(255,160,50,0.12)]" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <circle cx="12" cy="12" r="9" fill="url(#g)" />
                  <defs>
                    <linearGradient id="g" x1="0" x2="1">
                      <stop offset="0" stopColor="#FFC857" />
                      <stop offset="1" stopColor="#FF9F1C" />
                    </linearGradient>
                  </defs>
                  <path d="M12 8.5v7M9.25 11.25h5.5" stroke="#4b2e00" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200/70">Credit Uplink</div>
                <motion.div className="mt-1 flex items-baseline gap-3" initial={{ scale: 0.96 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
                  <div className="text-2xl font-black tracking-tight text-amber-300">+{creditToast.amount.toLocaleString()} Credits</div>
                  <div className="text-sm font-black text-white/60">-</div>
                  <div className="text-sm font-black text-white/80">{creditToast.total.toLocaleString()}</div>
                </motion.div>
              </div>

              <div className="flex-shrink-0 text-right">
                <div className="text-[9px] font-black uppercase tracking-[0.18em] text-white/40">Balance</div>
                <div className="mt-1 text-sm font-black text-white flex items-center justify-end gap-2">
                  {creditCopiedId === creditToast.id ? (
                    <span className="text-xs font-bold text-emerald-300">Copied</span>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <rect x="9" y="9" width="11" height="11" rx="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {isPlaying && gameState && !isSpectating && (
        <OverlayErrorBoundary onExit={() => { setIsPlaying(false); engine?.setAttractMode(true); }}>
          <UIOverlay gameState={gameState} onUpgradeStat={(s) => engine?.upgradeStat(engine.player, s)} onUpgradeClass={(c) => engine?.upgradeClass(c)} onUpgradeSector={(sector) => engine?.upgradeSecondarySector(sector)} onRestart={() => { setLastDeathReport(null); engine?.resetPlayer(true); }} onExit={() => { setIsPlaying(false); engine?.setAttractMode(true); }} highScores={displayHighScores} playHover={playHover} engine={engine} settings={settings} deathReport={lastDeathReport} />
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
      {!isPlaying && menuBootUnlocked && (
          <TacticalTooltip 
            label={tooltip.label} 
            desc={tooltip.desc} 
            visible={tooltip.visible} 
            x={menuMousePos.x} 
            y={menuMousePos.y} 
          />
      )}

      <MainMenu 
        isPlaying={isPlaying}
        bootUnlocked={menuBootUnlocked}
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
                                <div className="text-[10px] font-black uppercase tracking-[0.32em] text-cyan-300/70">Support Terminal</div>
                                <h2 className="mt-1 text-2xl md:text-3xl font-black uppercase tracking-[0.06em] text-white">Command Backing</h2>
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
                                  Live Rank: {supportRankMeta.label}
                                </span>
                                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/55">
                                  {supportRankMeta.tone}
                                </span>
                            </div>

                            <div className="mt-6 grid gap-4 sm:grid-cols-3">
                                <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.035] p-4">
                                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">Backing Total</div>
                                    <div className="mt-2 text-3xl font-black text-white">{(user?.supportTotal || 0).toLocaleString()}</div>
                                    <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white/35">Points committed</div>
                                </div>
                                <div className="rounded-[1.4rem] border p-4" style={{ borderColor: `${supportRankMeta.accent}40`, background: supportRankMeta.glow }}>
                                    <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: `${supportRankMeta.accent}` }}>Active Resonance</div>
                                    <div className="mt-2 text-2xl font-black text-white">{supportRankMeta.label}</div>
                                    <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white/50">Skin blend tier</div>
                                </div>
                                <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.035] p-4">
                                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">Network Status</div>
                                    <div className="mt-2 text-lg font-black text-white">{user ? 'Linked' : 'Offline'}</div>
                                    <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white/35">{user ? 'Account recognised' : 'Sign in required'}</div>
                                </div>
                            </div>

                            <div className="mt-6 rounded-[1.6rem] border border-white/10 bg-black/25 p-5">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <div className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-300/70">Terminal Brief</div>
                                        <h3 className="mt-2 text-xl font-black text-white">Keep development active and visible.</h3>
                                    </div>
                                    <div className="hidden md:flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/45">
                                        Top 3 = live rank holders
                                    </div>
                                </div>
                                <div className="mt-4 grid gap-3 md:grid-cols-3">
                                    {[
                                      { title: 'Resonance', body: 'Top supporters receive rank-based skin blending tied to their live standing.' },
                                      { title: 'Visibility', body: 'Backing totals contribute to the active supporter leaderboard and recognition systems.' },
                                      { title: 'Continuity', body: 'Your backing total stays on the account and updates the moment the uplink confirms.' }
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
                                        <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300/65">Contribution Uplink</div>
                                        <h3 className="mt-2 text-lg font-black text-white">Choose a backing packet</h3>
                                    </div>
                                    <div className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${supportTxnBusy ? 'bg-amber-400/14 text-amber-200 border border-amber-300/20' : 'bg-emerald-400/12 text-emerald-200 border border-emerald-300/20'}`}>
                                      {supportTxnBusy ? 'Processing' : 'Ready'}
                                    </div>
                                </div>

                                <div className="mt-5 grid grid-cols-3 gap-3">
                                    {SUPPORT_OPTIONS.map((amt) => (
                                      <button
                                        key={amt}
                                        onClick={() => handleSupportAction(amt)}
                                        disabled={!user || supportTxnBusy}
                                        className="group rounded-[1.15rem] border border-cyan-300/25 bg-cyan-400/[0.06] px-3 py-4 text-left transition-all hover:border-cyan-200/40 hover:bg-cyan-400/[0.12] disabled:cursor-not-allowed disabled:opacity-40"
                                      >
                                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/60">Packet</div>
                                        <div className="mt-2 text-2xl font-black text-white">+{amt}</div>
                                        <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35 group-hover:text-white/55">Backing pts</div>
                                      </button>
                                    ))}
                                </div>

                                <div className={`mt-5 rounded-[1.2rem] border px-4 py-3 ${supportTxnMsg ? 'border-cyan-300/20 bg-cyan-300/10' : 'border-white/10 bg-white/[0.03]'}`}>
                                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Uplink Status</div>
                                    <p className="mt-2 text-sm leading-6 text-white/72">{supportStatusText}</p>
                                </div>

                                <div className="mt-5 rounded-[1.35rem] border border-white/10 bg-black/20 p-4">
                                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/42">Live Rank Ladder</div>
                                    <div className="mt-3 space-y-2">
                                      {(['rank1', 'rank2', 'rank3'] as const).map((rankKey, idx) => {
                                        const meta = SUPPORT_RANK_META[rankKey];
                                        return (
                                          <div key={rankKey} className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
                                              <div className="flex items-center gap-3">
                                                  <span className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-black text-black" style={{ background: meta.accent }}>
                                                    {idx + 1}
                                                  </span>
                                                  <div>
                                                      <div className="text-sm font-black text-white">{meta.label}</div>
                                                      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">{meta.tone}</div>
                                                  </div>
                                              </div>
                                              <span className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: meta.accent }}>
                                                Top {idx + 1}
                                              </span>
                                          </div>
                                        );
                                      })}
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
                                  Open Discord Relay
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
