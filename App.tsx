
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
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

const DEFAULT_SETTINGS: GameSettings = {
    volume: 0.15,
    musicVolume: 0.1,
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
  const [showSupport, setShowSupport] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  
  const [newlyUnlocked, setNewlyUnlocked] = useState<Achievement[]>([]);
  const [showAchievementPopup, setShowAchievementPopup] = useState(false);
  
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.FFA);
  const [selectedTeam, setSelectedTeam] = useState<Team>(Team.BLUE);
  const [isSpectating, setIsSpectating] = useState(false);
  const [menuMousePos, setMenuMousePos] = useState({ x: 0, y: 0 });

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

  const playHover = useCallback(() => engine?.sound.playUIHover(), [engine]);
  const playClick = useCallback(() => engine?.sound.playUIClick(), [engine]);

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
      BackendService.getSession().then(res => {
          if (res.success && res.user) {
              setUser(res.user);
              // Keep player's custom in-game callsign if they already set one.
              setPlayerName(prev => prev.trim() ? prev : res.user!.username);
          }
      });
  }, []);

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

  const showTT = (label: string, desc?: string) => {
    setTooltip({ label, desc, visible: true });
    playHover();
  };

  const hideTT = () => setTooltip(prev => ({ ...prev, visible: false }));

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
            setUser(result.user);
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
        if (gameMode === GameMode.TEAMS && !engine.canJoinTeam(selectedTeam)) {
            engine.addNotification("TEAM UNBALANCED - CHOOSE OTHER SIDE", "#ff4444");
            return;
        }
        engine.sound.enable();
        engine.sound.playUIClick();
        engine.setPlayerName(playerName || 'GUEST_PILOT');
        engine.setGameMode(gameMode);
        engine.setPlayerColor(activeColor);
        engine.setPlayerTeam(selectedTeam);
        engine.setAttractMode(false);
        engine.resetPlayer(false);
        setIsPlaying(true);
        setIsSpectating(false);
        hideTT();
    }
  };

  const handleSpectate = () => {
    if (engine) {
        engine.sound.enable();
        engine.sound.playUIClick();
        engine.setGameMode(gameMode);
        engine.setAttractMode(true);
        engine.cycleSpectateTarget(0); // Pick first available
        setIsPlaying(true);
        setIsSpectating(true);
        hideTT();
    }
  };

  const handleMouseMoveApp = (e: React.MouseEvent) => { 
    if (!isPlaying) {
        setMenuMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const teamCounts = engine?.getTeamCounts() || { [Team.BLUE]: 0, [Team.RED]: 0, [Team.NONE]: 0 };

  return (
    <div onMouseMove={handleMouseMoveApp} className="relative w-full h-full overflow-hidden bg-[#010101] font-ubuntu selection:bg-cyan-500 selection:text-black cursor-none">
      <CustomCursor isPlaying={isPlaying} />
      <div className="hex-grid" />
      <div className="scanline" />
      <GameCanvas onStateUpdate={setGameState} onEngineInit={setEngine} onGameOver={handleGameOver} gameMode={gameMode} settings={settings} />
      
      {isPlaying && gameState && !isSpectating && (
        <OverlayErrorBoundary onExit={() => { setIsPlaying(false); engine?.setAttractMode(true); }}>
          <UIOverlay gameState={gameState} onUpgradeStat={(s) => engine?.upgradeStat(engine.player, s)} onUpgradeClass={(c) => engine?.upgradeClass(c)} onRestart={() => engine?.resetPlayer(true)} onExit={() => { setIsPlaying(false); engine?.setAttractMode(true); }} highScores={displayHighScores} playHover={playHover} engine={engine} settings={settings} />
        </OverlayErrorBoundary>
      )}

      {isPlaying && isSpectating && (
        <div className="absolute inset-x-0 bottom-12 z-50 flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700 pointer-events-none">
            <div className="flex items-center gap-8 p-6 rounded-[2.5rem] bg-black/80 border border-white/10 backdrop-blur-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] pointer-events-auto">
                <button 
                    onClick={() => { playClick(); engine?.cycleSpectateTarget(-1); }}
                    className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-cyan-400 transition-all active:scale-90 group"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                </button>
                
                <div className="flex flex-col items-center min-w-[240px]">
                    <span className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.4em] mb-1 italic">Spectating_Unit</span>
                    <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase truncate max-w-[200px]">
                        {engine?.spectateTarget?.name || 'SEARCHING_SIGNAL...'}
                    </h3>
                    <div className="flex items-center gap-3 mt-2">
                        <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-bold text-white/40 uppercase tracking-widest">
                            LVL_{engine?.spectateTarget?.level || 1}
                        </div>
                        <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-bold text-white/40 uppercase tracking-widest">
                            {engine?.spectateTarget?.classType || 'BASIC'}
                        </div>
                    </div>
                </div>

                <button 
                    onClick={() => { playClick(); engine?.cycleSpectateTarget(1); }}
                    className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-cyan-400 transition-all active:scale-90 group"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
            </div>

            <button 
                onClick={() => { playClick(); setIsPlaying(false); setIsSpectating(false); engine?.setAttractMode(true); }}
                className="px-10 py-4 rounded-2xl bg-white/5 border border-white/10 text-xs font-black text-white/40 hover:text-white hover:bg-white/10 transition-all uppercase tracking-[0.4em] italic pointer-events-auto"
            >
                Return_To_Command
            </button>
        </div>
      )}

      {/* Main Menu Tooltip Layer */}
      {!isPlaying && (
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
        showTT={showTT}
        hideTT={hideTT}
        playClick={playClick}
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

        {/* Modals */}
        {showLogin && <LoginModal onClose={() => setShowLogin(false)} onLoginSuccess={(u) => {
          setUser(u);
          setPlayerName(prev => prev.trim() ? prev : u.username);
        }} darkMode={settings.darkMode} />}
        {showShop && <ShopModal user={user} onClose={() => setShowShop(false)} onUpdateUser={setUser} darkMode={settings.darkMode} playSound={playClick} />}
        {showAlmanac && <AlmanacModal onClose={() => setShowAlmanac(false)} darkMode={settings.darkMode} playSound={playClick} />}
        {showAchievements && <AchievementsModal user={user} onClose={() => setShowAchievements(false)} darkMode={settings.darkMode} playSound={playClick} />}
        {showSettings && <SettingsModal settings={settings} setSettings={setSettings} onClose={() => setShowSettings(false)} playSound={playClick} onVolumeChange={(v) => engine?.sound.setVolume(v)} />}
        
        {showAchievementPopup && <AchievementPopup achievements={newlyUnlocked} onClose={() => setShowAchievementPopup(false)} />}
        
        {showUpdateHistory && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-[28px] animate-in fade-in duration-200 p-4 md:p-8" onClick={() => setShowUpdateHistory(false)}>
                <div className="w-full max-w-5xl max-h-[84vh] flex flex-col rounded-[2rem] bg-[#040812] border border-cyan-400/20 shadow-[0_24px_100px_rgba(0,0,0,0.88)] relative overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
                    <div className="grid grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)] h-full">
                        <aside className="border-b md:border-b-0 md:border-r border-white/10 bg-black/35 p-6 md:p-7 space-y-5">
                            <div>
                                <span className="text-[10px] font-black text-cyan-300/80 uppercase tracking-[0.3em]">Intelligence Archive</span>
                                <h2 className="mt-2 text-2xl font-black text-white uppercase tracking-tight">Data Logs</h2>
                                <p className="mt-2 text-[11px] text-white/45 uppercase tracking-wider leading-relaxed">Operational updates, balance passes, and system changes.</p>
                            </div>
                            <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1 custom-scrollbar">
                                {UPDATE_LOG.map((item) => (
                                    <div key={`nav-${item.id}`} className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
                                        <div className="text-[9px] font-black text-cyan-300 uppercase tracking-[0.2em]">{item.id}</div>
                                        <div className="text-[10px] font-bold text-white/75 uppercase tracking-wide mt-1 truncate">{item.title}</div>
                                    </div>
                                ))}
                            </div>
                            <button onClick={() => setShowUpdateHistory(false)} className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 text-[11px] font-black uppercase tracking-[0.2em] transition">
                                Close Terminal
                            </button>
                        </aside>

                        <section className="flex flex-col min-h-0">
                            <div className="px-6 md:px-8 py-5 border-b border-white/10 bg-cyan-500/[0.04] flex items-center justify-between gap-4 shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                                    <span className="text-[10px] font-black text-cyan-300 uppercase tracking-[0.3em]">Patch Stream</span>
                                </div>
                                <span className="text-[10px] text-white/35 font-bold uppercase tracking-[0.2em]">{UPDATE_LOG.length} entries</span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-4 custom-scrollbar">
                                {UPDATE_LOG.map((item, idx) => (
                                    <article
                                        key={item.id}
                                        className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 md:p-6 hover:border-cyan-400/40 hover:bg-cyan-500/[0.04] transition-all"
                                        style={{ animationDelay: `${idx * 30}ms` }}
                                    >
                                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3">
                                            <div className="flex items-center gap-2.5">
                                                <span className="px-2.5 py-1 rounded-md bg-cyan-400/10 border border-cyan-400/30 text-cyan-300 text-[10px] font-black uppercase tracking-[0.2em]">{item.id}</span>
                                                <h3 className="text-base md:text-lg font-black text-white uppercase tracking-wide">{item.title}</h3>
                                            </div>
                                            <span className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">{item.date}</span>
                                        </div>
                                        <p className="text-sm text-white/65 leading-relaxed">{item.content}</p>
                                    </article>
                                ))}
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        )}

        {showSupport && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/95 backdrop-blur-[40px] animate-in fade-in duration-300 p-4" onClick={() => setShowSupport(false)}>
                <div className="w-full max-w-xl rounded-[3.5rem] bg-[#030303] border border-white/10 p-10 md:p-14 text-center shadow-[0_0_100px_rgba(0,0,0,1)]" onClick={e => e.stopPropagation()}>
                    <div className="w-24 h-24 rounded-full bg-cyan-500/10 border-2 border-cyan-500/20 flex items-center justify-center mx-auto mb-10 group shadow-2xl">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-cyan-500 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-6">Tactical_Report</h2>
                    <p className="text-white/40 text-[11px] font-bold uppercase tracking-widest leading-relaxed mb-10">Detected a fracture in the matrix? Link with central command on Discord for immediate intervention.</p>
                    <div className="flex flex-col gap-4">
                        <a href="https://discord.gg/CSwJKCs4kW" target="_blank" rel="noopener noreferrer" className="w-full py-5 rounded-2xl bg-cyan-600 text-white font-black text-xs uppercase tracking-[0.4em] italic shadow-2xl hover:bg-cyan-500 transition-all">ESTABLISH_DISCORD_LINK</a>
                        <button onClick={() => setShowSupport(false)} className="w-full py-5 rounded-2xl bg-white/5 border border-white/10 text-white/40 font-black text-xs uppercase tracking-[0.3em] italic hover:text-white transition-all">CLOSE_FREQUENCY</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default App;
