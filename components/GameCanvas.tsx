
import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../services/GameEngine';
import { GameMode, GameSettings, GameState, StatType, TankClass } from '../types';

interface GameCanvasProps {
  onStateUpdate: (state: GameState) => void;
  onEngineInit: (engine: GameEngine) => void;
  onGameOver: (stats: { score: number, level: number, classType: TankClass, kills: number, eliteKills: number, transformations: number, eliteSkinsKilled?: TankClass[] }) => void;
  gameMode: GameMode;
  settings: GameSettings;
}

const KEY_TO_STAT_INDEX: Record<string, number> = {
  '1': 0,
  '2': 1,
  '3': 2,
  '4': 3,
  '5': 4,
  '6': 5,
  '7': 6,
  '8': 7,
  '9': 8,
  '0': 9,
  End: 0,
  ArrowDown: 1,
  PageDown: 2,
  ArrowLeft: 3,
  Clear: 4,
  ArrowRight: 5,
  Home: 6,
  ArrowUp: 7,
  PageUp: 8,
  Insert: 9,
};

const CODE_TO_STAT_INDEX: Record<string, number> = {
  Digit1: 0,
  Digit2: 1,
  Digit3: 2,
  Digit4: 3,
  Digit5: 4,
  Digit6: 5,
  Digit7: 6,
  Digit8: 7,
  Digit9: 8,
  Digit0: 9,
  Numpad1: 0,
  Numpad2: 1,
  Numpad3: 2,
  Numpad4: 3,
  Numpad5: 4,
  Numpad6: 5,
  Numpad7: 6,
  Numpad8: 7,
  Numpad9: 8,
  Numpad0: 9,
};

const STANDARD_STAT_ORDER: StatType[] = [
  StatType.REGEN,
  StatType.MAX_HEALTH,
  StatType.BODY_DAMAGE,
  StatType.BULLET_SPEED,
  StatType.BULLET_PENETRATION,
  StatType.BULLET_DAMAGE,
  StatType.RELOAD,
  StatType.MOVEMENT_SPEED,
  StatType.BULLET_SPREAD,
  StatType.MAX_SHIELD,
];

const PACIFIST_STAT_ORDER: StatType[] = [
  StatType.REGEN,
  StatType.MAX_HEALTH,
  StatType.BODY_DAMAGE,
  StatType.HEALING_RADIUS,
  StatType.HEALING_EFFICIENCY,
  StatType.HEALING_BURST,
  StatType.SUPPORT_XP_MULT,
  StatType.MOVEMENT_SPEED,
  StatType.BULLET_SPREAD,
  StatType.MAX_SHIELD,
];

const DRAINING_STAT_ORDER: StatType[] = [
  StatType.REGEN,
  StatType.MAX_HEALTH,
  StatType.BODY_DAMAGE,
  StatType.DRAIN_RADIUS,
  StatType.DRAIN_EFFICIENCY,
  StatType.DRAIN_LIFESTEAL,
  StatType.DRAIN_BURST,
  StatType.MOVEMENT_SPEED,
  StatType.BULLET_SPREAD,
  StatType.MAX_SHIELD,
];

const isPacifistClass = (tankClass: TankClass) =>
  tankClass === TankClass.PACIFIST_TRAINEE ||
  tankClass === TankClass.NURSE ||
  tankClass === TankClass.DOCTOR ||
  tankClass === TankClass.PLAGUE_DOCTOR;

const isDrainingClass = (tankClass: TankClass) =>
  tankClass === TankClass.DRAINER_TRAINEE ||
  tankClass === TankClass.LEECH ||
  tankClass === TankClass.VAMPIRE ||
  tankClass === TankClass.REAPER;

const getStatOrderForClass = (tankClass: TankClass): StatType[] => {
  if (isPacifistClass(tankClass)) return PACIFIST_STAT_ORDER;
  if (isDrainingClass(tankClass)) return DRAINING_STAT_ORDER;
  return STANDARD_STAT_ORDER;
};

const GameCanvas: React.FC<GameCanvasProps> = ({ onStateUpdate, onEngineInit, onGameOver, gameMode, settings }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const onGameOverRef = useRef(onGameOver);
  const onStateUpdateRef = useRef(onStateUpdate);
  const settingsRef = useRef(settings);

  // Keep refs in sync with props
  useEffect(() => {
    onGameOverRef.current = onGameOver;
  }, [onGameOver]);

  useEffect(() => {
    onStateUpdateRef.current = onStateUpdate;
  }, [onStateUpdate]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Update engine mode when prop changes
  useEffect(() => {
      if (engineRef.current) {
          engineRef.current.setGameMode(gameMode);
      }
  }, [gameMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let teardown: (() => void) | undefined;

    const boot = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const engine = new GameEngine(
      canvas,
      (state) => onStateUpdateRef.current(state), 
      (stats) => onGameOverRef.current(stats), 
      gameMode,
      settingsRef.current
      );
      engineRef.current = engine;
      onEngineInit(engine);
      engine.start();
    
    // Try to unlock audio context immediately (might fail due to autoplay policy)
      if (engine.sound) {
        engine.sound.resume().catch(() => {
            // Expected failure if no interaction yet
        });
      }

    // Input Handling
    const keys = new Set<string>();
    let mouseDown = false;
    let mouseRightDown = false;
    let mousePos = { x: 0, y: 0 };
    let activeUpgradeHotkey: string | null = null;
    let statHoldDelayTimer: ReturnType<typeof setTimeout> | null = null;
    let statHoldRepeatTimer: ReturnType<typeof setInterval> | null = null;
    
    // Generic Audio Unlocker - Runs on any interaction
    const unlockAudio = () => {
        if (engine.sound && engine.sound.ctx.state === 'suspended') {
            engine.sound.resume();
        }
    };

    // Global listener for unlocking audio on first click anywhere
    document.addEventListener('click', unlockAudio, { once: true });
    document.addEventListener('keydown', unlockAudio, { once: true });

    const stopStatHold = () => {
      activeUpgradeHotkey = null;
      if (statHoldDelayTimer) {
        clearTimeout(statHoldDelayTimer);
        statHoldDelayTimer = null;
      }
      if (statHoldRepeatTimer) {
        clearInterval(statHoldRepeatTimer);
        statHoldRepeatTimer = null;
      }
    };

    const tryUpgradeByIndex = (statIndex: number) => {
      const currentOrder = getStatOrderForClass(engine.player.classType);
      const statToUpgrade = currentOrder[statIndex];
      if (!statToUpgrade) return false;

      const beforePoints = engine.player.availableStatPoints;
      const beforeValue = engine.player.stats[statToUpgrade] ?? 0;
      if (beforePoints <= 0 || beforeValue >= 8) return false;

      engine.upgradeStat(engine.player, statToUpgrade);

      const afterPoints = engine.player.availableStatPoints;
      const afterValue = engine.player.stats[statToUpgrade] ?? 0;
      return afterPoints < beforePoints || afterValue > beforeValue;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent repeat for toggles
      if (!e.repeat) {
          if (e.key.toLowerCase() === 'e') engine.toggleAutoFire();
          if (e.key.toLowerCase() === 'c') engine.toggleAutoSpin();
      }

      // Handle Stat Upgrades
      const statIndex = KEY_TO_STAT_INDEX[e.key] ?? CODE_TO_STAT_INDEX[e.code];
      if (statIndex !== undefined) {
        e.preventDefault();
        const hotkeyId = e.code || e.key;

        if (!e.repeat) {
          if (activeUpgradeHotkey && activeUpgradeHotkey !== hotkeyId) {
            stopStatHold();
          }

          tryUpgradeByIndex(statIndex);
          activeUpgradeHotkey = hotkeyId;

          // After initial press, continuously allocate while held.
          statHoldDelayTimer = setTimeout(() => {
            if (activeUpgradeHotkey !== hotkeyId) return;
            statHoldRepeatTimer = setInterval(() => {
              if (activeUpgradeHotkey !== hotkeyId) {
                stopStatHold();
                return;
              }
              const upgraded = tryUpgradeByIndex(statIndex);
              if (!upgraded) stopStatHold();
            }, 50);
          }, 300);
        }
      }

      keys.add(e.key);
      engine.handleInput(keys, mousePos, mouseDown, mouseRightDown);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const hotkeyId = e.code || e.key;
      if (activeUpgradeHotkey === hotkeyId) {
        stopStatHold();
      }
      keys.delete(e.key);
      engine.handleInput(keys, mousePos, mouseDown, mouseRightDown);
    };
    const handleWindowBlur = () => {
      stopStatHold();
      keys.clear();
      mouseDown = false;
      mouseRightDown = false;
      engine.handleInput(keys, mousePos, mouseDown, mouseRightDown);
    };
    const handleMouseMove = (e: MouseEvent) => {
      mousePos = { x: e.clientX, y: e.clientY };
      engine.handleInput(keys, mousePos, mouseDown, mouseRightDown);
    };
    const handleMouseDown = (e: MouseEvent) => {
      // Special check for spawn tools
      if (e.button === 0) {
          if (engine.primedSpawn) {
              engine.executePrimedSpawn(e.clientX, e.clientY);
              return;
          }
          mouseDown = true;
      } else if (e.button === 2) {
          mouseRightDown = true;
      }
      engine.handleInput(keys, mousePos, mouseDown, mouseRightDown);
    };
    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) mouseDown = false;
      else if (e.button === 2) mouseRightDown = false;
      engine.handleInput(keys, mousePos, mouseDown, mouseRightDown);
    };
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
      const handleResize = () => {
       canvas.width = window.innerWidth;
       canvas.height = window.innerHeight;
      };

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mousedown', handleMouseDown);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('contextmenu', handleContextMenu);
      window.addEventListener('resize', handleResize);
      window.addEventListener('blur', handleWindowBlur);

      teardown = () => {
        stopStatHold();
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mousedown', handleMouseDown);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('contextmenu', handleContextMenu);
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('blur', handleWindowBlur);
        document.removeEventListener('click', unlockAudio);
        document.removeEventListener('keydown', unlockAudio);
        engine.stop();
      };
    };
    boot();

    return () => {
      teardown?.();
      engineRef.current = null;
    };
  }, []);

  return <canvas ref={canvasRef} className="block w-full h-full cursor-crosshair" />;
};

export default GameCanvas;
