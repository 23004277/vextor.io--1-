
import { TankClass } from '../types';
import type { BossRushTelegraphType } from './bossRush/BossRushTypes';

export type AudioSpatialOptions = {
  onScreen?: boolean;
  distanceNorm?: number; // 0 (near) .. 1 (far)
  pan?: number; // -1..1
  important?: boolean; // critical gameplay cue
};

interface SoundProfile {
  baseFreq: number;
  sweepDepth: number;
  duration: number;
  amplitude: number;
  waveType: OscillatorType;
  attackTime: number;
  noiseIntensity: number;
  noiseDecay: number;
  metalResonance: number;
  addSub: boolean;
}

const DEFAULT_SOUND_PROFILE: SoundProfile = {
  baseFreq: 200,
  sweepDepth: 0.1,
  duration: 0.2,
  amplitude: 0.4,
  waveType: 'triangle',
  attackTime: 0.008,
  noiseIntensity: 0.6,
  noiseDecay: 0.08,
  metalResonance: 600,
  addSub: true
};

type BossRushBossAudioKey =
  | 'gatekeeper'
  | 'splitter'
  | 'reactor'
  | 'executioner'
  | 'grand_singularity'
  | string;

type BossRushAbilitySoundPhase = 'cast' | 'warning' | 'charge' | 'impact' | 'tail';
type BossRushAbilitySoundScale = 'light' | 'standard' | 'major' | 'ultimate' | 'passive';
type BossRushAbilitySoundFamily =
  | 'projectile'
  | 'lane'
  | 'grid'
  | 'circle'
  | 'square'
  | 'ring'
  | 'cone'
  | 'arc'
  | 'cleave'
  | 'dash'
  | 'gravity'
  | 'corrupt'
  | 'hazard'
  | 'ultimate';

type BossRushAbilitySoundProfile = {
  base: number;
  accent: number;
  sub: number;
  filter: number;
  wave: OscillatorType;
  accentWave: OscillatorType;
  noiseColor: 'lowpass' | 'highpass' | 'bandpass';
  bite: number;
  weight: number;
  shimmer: number;
};

export class SoundEngine {
  ctx: AudioContext;
  masterGain: GainNode;
  noiseBuffer: AudioBuffer | null = null;
  volume: number = 0.15;
  muteGameSounds: boolean = false;
  private enabled: boolean = false;
  private readonly masterLoudnessBoost = 2.35;
  private readonly bossRushLoudnessBoost = 1.32;

  // Throttle tracking to prevent audio clipping during high fire rates
  private lastPlayed: Record<string, number> = {};
  private rapidFireState: Record<string, { lastAt: number; streak: number }> = {};

  constructor() {
    const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    this.ctx = new AudioContextClass();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.getEffectiveMasterGain(this.volume);

    // Add a master limiter to prevent clipping when many sounds play simultaneously
    const limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.setValueAtTime(-1, this.ctx.currentTime);
    limiter.knee.setValueAtTime(40, this.ctx.currentTime);
    limiter.ratio.setValueAtTime(12, this.ctx.currentTime);
    limiter.attack.setValueAtTime(0, this.ctx.currentTime);
    limiter.release.setValueAtTime(0.25, this.ctx.currentTime);

    this.masterGain.connect(limiter);
    limiter.connect(this.ctx.destination);

    this.noiseBuffer = this.createNoiseBuffer();
  }

  private throttle(key: string, cooldownMs: number): boolean {
    const now = Date.now();
    if (this.lastPlayed[key] && now - this.lastPlayed[key] < cooldownMs) {
      return false;
    }
    this.lastPlayed[key] = now;
    return true;
  }

  async resume() {
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  enable() {
    this.enabled = true;
    this.resume();
  }

  setVolume(value: number) {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.getEffectiveMasterGain(this.volume), this.ctx.currentTime, 0.05);
    }
  }

  private getEffectiveMasterGain(volume: number): number {
    // Lift overall loudness so "max volume" is truly audible on low-output devices.
    // We keep a limiter on the master chain to reduce clipping risk.
    return Math.max(0, Math.min(2.5, volume * this.masterLoudnessBoost));
  }

  // Small helper: random factor around 1.0
  private jitter(center = 1, amount = 0.1) {
    return center * (1 - amount + Math.random() * amount * 2);
  }

  private semitoneFactor(semitones: number) {
    return Math.pow(2, semitones / 12);
  }

  private chooseBossPitchFlavor(awakened = false) {
    const flavors = awakened
      ? [-5, -2, 0, 3, 7]
      : [-7, -3, 0, 4, 8];
    return this.semitoneFactor(flavors[Math.floor(Math.random() * flavors.length)]);
  }

  // Global pitch variance per synthesized voice so tones naturally swing high/low.
  private createOscillatorVoice(): OscillatorNode {
    const osc = this.ctx.createOscillator();
    const detuneCents = (Math.random() * 2 - 1) * 260;
    osc.detune.setValueAtTime(detuneCents, this.ctx.currentTime);
    return osc;
  }

  // Small helper: create a panned gain node
  private createPannedGain(
    panRange = 0.4,
    panOverride?: number,
    lowpassHz?: number
  ): { gain: GainNode; panNode: StereoPannerNode; filter?: BiquadFilterNode } {
    const gain = this.ctx.createGain();
    const panNode = this.ctx.createStereoPanner();
    panNode.pan.value = typeof panOverride === 'number'
      ? Math.max(-1, Math.min(1, panOverride))
      : (Math.random() - 0.5) * panRange;
    let filter: BiquadFilterNode | undefined;
    if (lowpassHz && lowpassHz > 0) {
      filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(lowpassHz, this.ctx.currentTime);
      gain.connect(filter);
      filter.connect(panNode);
    } else {
      gain.connect(panNode);
    }
    panNode.connect(this.masterGain);
    return { gain, panNode, filter };
  }

  private getSpatialMix(options?: AudioSpatialOptions) {
    const onScreen = options?.onScreen ?? true;
    const important = options?.important ?? false;
    const distanceNorm = Math.max(0, Math.min(1, options?.distanceNorm ?? 0));
    let gainMul = 1.0;
    let panRange = 0.4;
    let lowpassHz: number | undefined = undefined;
    let throttleMul = 1.0;

    if (!onScreen) {
      const distAtten = 1 - (distanceNorm * 0.78);
      gainMul = Math.max(important ? 0.18 : 0.08, distAtten * (important ? 0.65 : 0.42));
      panRange = 0.18;
      lowpassHz = important ? 2400 : 1700;
      throttleMul = important ? 1.35 : 2.5;
      if (distanceNorm > 0.85 && !important) {
        gainMul *= 0.55;
        throttleMul *= 1.5;
      }
    }

    return {
      gainMul,
      panRange,
      lowpassHz,
      throttleMul,
      pan: options?.pan
    };
  }

  private shouldPlaySound(options?: AudioSpatialOptions, isGameplaySound: boolean = true): boolean {
    if (!isGameplaySound) return true; // UI and meta sounds bypass visibility gating.
    if (!options) return true; // Backward-compatible default when no spatial context is provided.
    if (options.onScreen) return true;
    return !!options.important;
  }

  playRoar(options?: AudioSpatialOptions) {
    if (!this.enabled || this.muteGameSounds) return;
    this.resume();
    if (this.volume <= 0.001) return;
    if (!this.shouldPlaySound(options, true)) return;
    const t = this.ctx.currentTime;
    const duration = 2.2; 
    const spatial = this.getSpatialMix(options);

    // --- LAYER 1: THE SUB-SLAM (Chest punch) ---
    {
        const osc = this.createOscillatorVoice();
        const { gain: g } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(50, t);
        osc.frequency.exponentialRampToValueAtTime(15, t + 0.6);
        
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(1.0 * spatial.gainMul, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        
        osc.connect(g);
        osc.start(t);
        osc.stop(t + 0.6);
    }

    // --- LAYER 2: THE "GRIT" (Mechanical Rattle) ---
    {
        const osc1 = this.createOscillatorVoice();
        const osc2 = this.createOscillatorVoice();
        const { gain: g } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
        const lp = this.ctx.createBiquadFilter();
        
        osc1.type = 'sawtooth';
        osc2.type = 'sawtooth';
        osc1.frequency.setValueAtTime(90, t);
        osc2.frequency.setValueAtTime(88, t);
        osc1.frequency.exponentialRampToValueAtTime(25, t + duration);
        osc2.frequency.exponentialRampToValueAtTime(24, t + duration);

        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(1200, t);
        lp.frequency.exponentialRampToValueAtTime(80, t + duration);

        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.6 * spatial.gainMul, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, t + duration);

        osc1.connect(lp);
        osc2.connect(lp);
        lp.connect(g);
        osc1.start(t);
        osc2.start(t);
        osc1.stop(t + duration);
        osc2.stop(t + duration);
    }

    // --- LAYER 3: THE "NULL" EXHALE (Heavy Steam) ---
    if (this.noiseBuffer) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const { gain: g } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
        const bp = this.ctx.createBiquadFilter();

        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(3000, t);
        bp.frequency.exponentialRampToValueAtTime(100, t + duration);
        bp.Q.setValueAtTime(0.5, t);
        bp.Q.linearRampToValueAtTime(4.0, t + duration);

        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.4 * spatial.gainMul, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, t + duration);

        src.connect(bp);
        bp.connect(g);
        src.start(t);
        src.stop(t + duration);
    }
  }

  private getSoundProfile(type: TankClass): SoundProfile {
    const profiles: Partial<Record<TankClass, SoundProfile>> = {
      [TankClass.SNIPER]: { baseFreq: 440, sweepDepth: 0.02, duration: 0.45, amplitude: 0.55, waveType: 'sawtooth', attackTime: 0.008, noiseIntensity: 1.0, noiseDecay: 0.15, metalResonance: 1500, addSub: true },
      [TankClass.TRAPPER]: { baseFreq: 168, sweepDepth: 0.08, duration: 0.32, amplitude: 0.42, waveType: 'triangle', attackTime: 0.01, noiseIntensity: 0.82, noiseDecay: 0.14, metalResonance: 980, addSub: true },
      [TankClass.DUAL_TRAPPER]: { baseFreq: 176, sweepDepth: 0.1, duration: 0.3, amplitude: 0.4, waveType: 'triangle', attackTime: 0.01, noiseIntensity: 0.78, noiseDecay: 0.13, metalResonance: 1020, addSub: true },
      [TankClass.MACHINE_GUN_TRAPPER]: { baseFreq: 150, sweepDepth: 0.22, duration: 0.14, amplitude: 0.32, waveType: 'square', attackTime: 0.005, noiseIntensity: 0.64, noiseDecay: 0.08, metalResonance: 760, addSub: true },
      [TankClass.OCTO_TRAPPER]: { baseFreq: 160, sweepDepth: 0.06, duration: 0.34, amplitude: 0.4, waveType: 'triangle', attackTime: 0.009, noiseIntensity: 0.9, noiseDecay: 0.16, metalResonance: 1120, addSub: true },
      [TankClass.TRIPLE_TRAPPER]: { baseFreq: 184, sweepDepth: 0.12, duration: 0.24, amplitude: 0.36, waveType: 'triangle', attackTime: 0.008, noiseIntensity: 0.72, noiseDecay: 0.11, metalResonance: 920, addSub: true },
      [TankClass.ASSASSIN]: { baseFreq: 460, sweepDepth: 0.02, duration: 0.4, amplitude: 0.5, waveType: 'sawtooth', attackTime: 0.008, noiseIntensity: 0.9, noiseDecay: 0.12, metalResonance: 1200, addSub: true },
      [TankClass.RANGER]: { baseFreq: 420, sweepDepth: 0.01, duration: 0.5, amplitude: 0.6, waveType: 'sawtooth', attackTime: 0.01, noiseIntensity: 1.1, noiseDecay: 0.2, metalResonance: 1800, addSub: true },
      [TankClass.STALKER]: { baseFreq: 400, sweepDepth: 0.01, duration: 0.5, amplitude: 0.6, waveType: 'sawtooth', attackTime: 0.01, noiseIntensity: 1.1, noiseDecay: 0.2, metalResonance: 1800, addSub: true },
      [TankClass.MACHINE_GUN]: { baseFreq: 125, sweepDepth: 0.22, duration: 0.11, amplitude: 0.34, waveType: 'square', attackTime: 0.004, noiseIntensity: 0.72, noiseDecay: 0.055, metalResonance: 520, addSub: true },
      [TankClass.SPRAYER]: { baseFreq: 130, sweepDepth: 0.35, duration: 0.1, amplitude: 0.25, waveType: 'square', attackTime: 0.005, noiseIntensity: 0.4, noiseDecay: 0.03, metalResonance: 300, addSub: true },
      [TankClass.STREAMLINER]: { baseFreq: 280, sweepDepth: 0.5, duration: 0.08, amplitude: 0.2, waveType: 'triangle', attackTime: 0.005, noiseIntensity: 0.3, noiseDecay: 0.03, metalResonance: 0, addSub: false },
      [TankClass.GUNNER]: { baseFreq: 210, sweepDepth: 0.36, duration: 0.11, amplitude: 0.31, waveType: 'square', attackTime: 0.003, noiseIntensity: 0.62, noiseDecay: 0.06, metalResonance: 560, addSub: true },
      [TankClass.AUTO_GUNNER]: { baseFreq: 295, sweepDepth: 0.5, duration: 0.075, amplitude: 0.2, waveType: 'triangle', attackTime: 0.003, noiseIntensity: 0.34, noiseDecay: 0.03, metalResonance: 680, addSub: false },
      [TankClass.TRIPLE_TANK]: { baseFreq: 230, sweepDepth: 0.42, duration: 0.095, amplitude: 0.24, waveType: 'triangle', attackTime: 0.004, noiseIntensity: 0.45, noiseDecay: 0.04, metalResonance: 520, addSub: true },
      [TankClass.OVERSEER]: { baseFreq: 315, sweepDepth: 0.6, duration: 0.07, amplitude: 0.22, waveType: 'triangle', attackTime: 0.003, noiseIntensity: 0.26, noiseDecay: 0.03, metalResonance: 1200, addSub: false },
      [TankClass.OVERLORD]: { baseFreq: 250, sweepDepth: 0.48, duration: 0.1, amplitude: 0.32, waveType: 'sawtooth', attackTime: 0.004, noiseIntensity: 0.4, noiseDecay: 0.05, metalResonance: 980, addSub: true },
      [TankClass.MANAGER]: { baseFreq: 190, sweepDepth: 0.5, duration: 0.09, amplitude: 0.24, waveType: 'sine', attackTime: 0.005, noiseIntensity: 0.2, noiseDecay: 0.035, metalResonance: 700, addSub: false },
      [TankClass.DESTROYER]: { baseFreq: 65, sweepDepth: 0.05, duration: 0.9, amplitude: 0.9, waveType: 'sine', attackTime: 0.03, noiseIntensity: 1.8, noiseDecay: 0.6, metalResonance: 150, addSub: true },
      [TankClass.HYBRID]: { baseFreq: 74, sweepDepth: 0.06, duration: 0.82, amplitude: 0.88, waveType: 'sine', attackTime: 0.02, noiseIntensity: 1.8, noiseDecay: 0.58, metalResonance: 260, addSub: true },
      [TankClass.ANNIHILATOR]: { baseFreq: 60, sweepDepth: 0.04, duration: 1.0, amplitude: 1.0, waveType: 'sine', attackTime: 0.04, noiseIntensity: 2.0, noiseDecay: 0.7, metalResonance: 100, addSub: true },
      [TankClass.HUNTER]: { baseFreq: 380, sweepDepth: 0.2, duration: 0.3, amplitude: 0.45, waveType: 'sawtooth', attackTime: 0.008, noiseIntensity: 0.7, noiseDecay: 0.1, metalResonance: 800, addSub: true },
      [TankClass.X_HUNTER]: { baseFreq: 360, sweepDepth: 0.25, duration: 0.35, amplitude: 0.5, waveType: 'sawtooth', attackTime: 0.008, noiseIntensity: 0.8, noiseDecay: 0.12, metalResonance: 900, addSub: true },
      [TankClass.COLOSSAL]: { baseFreq: 64, sweepDepth: 0.042, duration: 0.82, amplitude: 0.94, waveType: 'sine', attackTime: 0.024, noiseIntensity: 1.72, noiseDecay: 0.56, metalResonance: 180, addSub: true },
      [TankClass.LEVIATHAN]: { baseFreq: 88, sweepDepth: 0.09, duration: 0.66, amplitude: 0.86, waveType: 'sawtooth', attackTime: 0.016, noiseIntensity: 1.4, noiseDecay: 0.4, metalResonance: 360, addSub: true },
      [TankClass.WARLORD]: { baseFreq: 78, sweepDepth: 0.062, duration: 0.72, amplitude: 0.9, waveType: 'triangle', attackTime: 0.017, noiseIntensity: 1.58, noiseDecay: 0.5, metalResonance: 280, addSub: true },
      [TankClass.CELESTIAL]: { baseFreq: 132, sweepDepth: 0.13, duration: 0.58, amplitude: 0.78, waveType: 'triangle', attackTime: 0.011, noiseIntensity: 1.06, noiseDecay: 0.32, metalResonance: 1120, addSub: false },
      [TankClass.OBLITERATOR]: { baseFreq: 60, sweepDepth: 0.038, duration: 0.98, amplitude: 1.0, waveType: 'sawtooth', attackTime: 0.022, noiseIntensity: 2.3, noiseDecay: 0.74, metalResonance: 150, addSub: true },
    };
    return profiles[type] ?? DEFAULT_SOUND_PROFILE;
  }

  playShoot(type: TankClass = TankClass.BASIC, options?: AudioSpatialOptions) {
    if (!this.enabled || this.muteGameSounds) return;
    this.resume();
    if (this.volume <= 0.001) return;
    if (!this.shouldPlaySound(options, true)) return;

    const spatial = this.getSpatialMix(options);
    const isRebirthClass =
      type === TankClass.COLOSSAL ||
      type === TankClass.LEVIATHAN ||
      type === TankClass.WARLORD ||
      type === TankClass.CELESTIAL ||
      type === TankClass.OBLITERATOR;
    const minCooldownBase = isRebirthClass
      ? 56
      : (type === TankClass.STREAMLINER || type === TankClass.GUNNER)
      ? 22
      : (type === TankClass.OVERSEER || type === TankClass.OVERLORD || type === TankClass.MANAGER ? 30 : 38);
    const minCooldown = Math.round(minCooldownBase * spatial.throttleMul);
    if (!this.throttle(`shoot-${type}`, minCooldown)) return;
    if (isRebirthClass) {
      const rebirthBusCooldown = Math.round(28 * spatial.throttleMul);
      if (!this.throttle('shoot-rebirth-bus', rebirthBusCooldown)) return;
    }

    const t = this.ctx.currentTime;
    const profile = this.getSoundProfile(type);
    
    const nowMs = Date.now();
    const rapidKey = `rf-${type}`;
    const prevRapid = this.rapidFireState[rapidKey];
    const rapidThreshold = type === TankClass.MACHINE_GUN ? 140 : 95;
    const streak = (prevRapid && nowMs - prevRapid.lastAt < rapidThreshold)
      ? Math.min(18, prevRapid.streak + 1)
      : 0;
    this.rapidFireState[rapidKey] = { lastAt: nowMs, streak };
    const isRapidFireClass = type === TankClass.MACHINE_GUN || type === TankClass.GUNNER || type === TankClass.AUTO_GUNNER || type === TankClass.STREAMLINER || type === TankClass.SPRAYER;

    // Add more variation (machine gun pitch climbs subtly with sustained fire)
    const basePitchVariance = type === TankClass.MACHINE_GUN
      ? 0.93 + Math.random() * 0.12
      : type === TankClass.GUNNER
      ? 0.91 + Math.random() * 0.16
      : 0.95 + Math.random() * 0.1;
    const sustainedPitchLift = (type === TankClass.MACHINE_GUN || type === TankClass.GUNNER) ? Math.min(0.14, streak * 0.008) : 0;
    const pitchVariance = basePitchVariance * (1 + sustainedPitchLift);
    const finalBaseFreq = profile.baseFreq * pitchVariance;
    const ampRand = profile.amplitude * this.jitter(1, 0.15);
    const durationRand = profile.duration * this.jitter(1, 0.1);

    // --- LAYER 1: MECHANICAL CLICK (Firing Pin) ---
    {
      const pinOsc = this.createOscillatorVoice();
      const { gain: pinG } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
      pinOsc.type = 'square';
      pinOsc.frequency.setValueAtTime(finalBaseFreq * 4, t);
      pinG.gain.setValueAtTime(0, t);
      pinG.gain.linearRampToValueAtTime(ampRand * 0.4 * spatial.gainMul, t + 0.001);
      pinG.gain.linearRampToValueAtTime(0, t + 0.005);
      pinOsc.connect(pinG);
      pinOsc.start(t);
      pinOsc.stop(t + 0.01);
    }

    // Rapid-fire rotor/mechanical loop layer
    if (isRapidFireClass) {
      const rotor = this.createOscillatorVoice();
      const { gain: rotorGain } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
      rotor.type = 'square';
      const rpm = Math.min(1, streak / 16);
      rotor.frequency.setValueAtTime(55 + rpm * 95 + Math.random() * 8, t);
      rotor.frequency.linearRampToValueAtTime(85 + rpm * 130, t + 0.03);
      rotorGain.gain.setValueAtTime(0, t);
      rotorGain.gain.linearRampToValueAtTime((0.03 + rpm * 0.05) * spatial.gainMul, t + 0.003);
      rotorGain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
      rotor.connect(rotorGain);
      rotor.start(t);
      rotor.stop(t + 0.05);
    }

    // --- LAYER 2: BORE BLAST (The main tone) ---
    {
      const bodyOsc = this.createOscillatorVoice();
      const { gain: bodyGain } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
      bodyOsc.type = profile.waveType;
      bodyOsc.frequency.setValueAtTime(finalBaseFreq, t);
      bodyOsc.frequency.exponentialRampToValueAtTime(
        Math.max(20, finalBaseFreq * profile.sweepDepth),
        t + durationRand
      );

      bodyGain.gain.setValueAtTime(0, t);
      bodyGain.gain.linearRampToValueAtTime(ampRand * spatial.gainMul, t + profile.attackTime);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, t + durationRand);

      bodyOsc.connect(bodyGain);
      bodyOsc.start(t);
      bodyOsc.stop(t + durationRand + 0.1);
    }

    // --- LAYER 3: MUZZLE SMOKE & METAL RING ---
    if (this.noiseBuffer) {
      const noiseSrc = this.ctx.createBufferSource();
      noiseSrc.buffer = this.noiseBuffer;
      const { gain: noiseGain } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
      
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(finalBaseFreq * 2, t);
      bp.Q.value = profile.metalResonance > 0 ? 8 : 1;

      if (profile.metalResonance > 0) {
          bp.frequency.exponentialRampToValueAtTime(profile.metalResonance * pitchVariance, t + 0.1);
      }

      noiseGain.gain.setValueAtTime(0, t);
      noiseGain.gain.linearRampToValueAtTime(ampRand * profile.noiseIntensity * spatial.gainMul, t + 0.005);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + profile.noiseDecay);

      noiseSrc.connect(bp);
      bp.connect(noiseGain);
      noiseSrc.start(t);
      noiseSrc.stop(t + profile.noiseDecay + 0.1);
    }

    // --- LAYER 4: SUB-THUMP ---
    if (profile.addSub) {
      const sub = this.createOscillatorVoice();
      const { gain: subG } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
      sub.type = 'sine';
      sub.frequency.setValueAtTime(45 * pitchVariance, t);
      sub.frequency.exponentialRampToValueAtTime(20, t + 0.1);
      
      subG.gain.setValueAtTime(0, t);
      subG.gain.linearRampToValueAtTime(ampRand * 0.5 * spatial.gainMul, t + 0.01);
      subG.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      
      sub.connect(subG);
      sub.start(t);
      sub.stop(t + 0.15);
    }

    // --- LAYER 5: MACHINE GUN SERVO WHINE (sustained fire identity) ---
    if (type === TankClass.MACHINE_GUN && streak > 3) {
      const servo = this.createOscillatorVoice();
      const { gain: servoGain } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
      servo.type = 'triangle';
      const lift = Math.min(1, streak / 14);
      servo.frequency.setValueAtTime(220 + lift * 90, t);
      servo.frequency.linearRampToValueAtTime(260 + lift * 140, t + 0.06);
      servoGain.gain.setValueAtTime(0, t);
      servoGain.gain.linearRampToValueAtTime((0.045 + lift * 0.04) * spatial.gainMul, t + 0.008);
      servoGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      servo.connect(servoGain);
      servo.start(t);
      servo.stop(t + 0.09);
    }

    if (type === TankClass.GUNNER) {
      const coreHum = this.createOscillatorVoice();
      const { gain: humGain } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
      coreHum.type = 'sine';
      const lift = Math.min(1, streak / 14);
      coreHum.frequency.setValueAtTime(92 + lift * 28, t);
      coreHum.frequency.linearRampToValueAtTime(110 + lift * 36, t + 0.05);
      humGain.gain.setValueAtTime(0, t);
      humGain.gain.linearRampToValueAtTime((0.05 + lift * 0.04) * spatial.gainMul, t + 0.006);
      humGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      coreHum.connect(humGain);
      coreHum.start(t);
      coreHum.stop(t + 0.085);
    }

    // Distinct turret chatter layer for Auto-Gunner secondary fire
    if (type === TankClass.AUTO_GUNNER) {
      const tracker = this.createOscillatorVoice();
      const { gain: trackerGain } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
      tracker.type = 'square';
      tracker.frequency.setValueAtTime(320 + Math.random() * 70, t);
      tracker.frequency.linearRampToValueAtTime(250 + Math.random() * 40, t + 0.03);
      trackerGain.gain.setValueAtTime(0, t);
      trackerGain.gain.linearRampToValueAtTime(0.06 * spatial.gainMul, t + 0.003);
      trackerGain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
      tracker.connect(trackerGain);
      tracker.start(t);
      tracker.stop(t + 0.05);

      const staticHum = this.createOscillatorVoice();
      const { gain: staticGain } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
      staticHum.type = 'triangle';
      staticHum.frequency.setValueAtTime(180 + Math.random() * 30, t);
      staticHum.frequency.linearRampToValueAtTime(220 + Math.random() * 40, t + 0.04);
      staticGain.gain.setValueAtTime(0, t);
      staticGain.gain.linearRampToValueAtTime(0.04 * spatial.gainMul, t + 0.004);
      staticGain.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
      staticHum.connect(staticGain);
      staticHum.start(t);
      staticHum.stop(t + 0.06);
    }

    // Hybrid fusion layer: telemetry chirp blended with heavy blast
    if (type === TankClass.HYBRID) {
      const chirp = this.createOscillatorVoice();
      const { gain: chirpGain } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
      chirp.type = 'triangle';
      chirp.frequency.setValueAtTime(380 + Math.random() * 40, t);
      chirp.frequency.exponentialRampToValueAtTime(620 + Math.random() * 40, t + 0.03);
      chirpGain.gain.setValueAtTime(0, t);
      chirpGain.gain.linearRampToValueAtTime(0.06 * spatial.gainMul, t + 0.004);
      chirpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      chirp.connect(chirpGain);
      chirp.start(t);
      chirp.stop(t + 0.06);
    }

    // Annihilator pressure crack layer
    if (type === TankClass.ANNIHILATOR) {
      const crack = this.createOscillatorVoice();
      const { gain: crackGain } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
      crack.type = 'sawtooth';
      crack.frequency.setValueAtTime(190, t);
      crack.frequency.exponentialRampToValueAtTime(70, t + 0.09);
      crackGain.gain.setValueAtTime(0, t);
      crackGain.gain.linearRampToValueAtTime(0.18 * spatial.gainMul, t + 0.008);
      crackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      crack.connect(crackGain);
      crack.start(t);
      crack.stop(t + 0.12);
    }

    // Rebirth identity layer: class-unique spectral signature above main blast.
    if (isRebirthClass) {
      const sig = this.createOscillatorVoice();
      const { gain: sigGain } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
      sig.type = (type === TankClass.CELESTIAL || type === TankClass.OBLITERATOR) ? 'triangle' : 'sawtooth';
      const base =
        type === TankClass.COLOSSAL ? 115 :
        type === TankClass.LEVIATHAN ? 150 :
        type === TankClass.WARLORD ? 128 :
        type === TankClass.OBLITERATOR ? 102 : 190;
      sig.frequency.setValueAtTime(base + Math.random() * 18, t);
      sig.frequency.exponentialRampToValueAtTime(base * 0.55, t + 0.11);
      sigGain.gain.setValueAtTime(0, t);
      sigGain.gain.linearRampToValueAtTime(0.09 * spatial.gainMul, t + 0.006);
      sigGain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      sig.connect(sigGain);
      sig.start(t);
      sig.stop(t + 0.14);
    }

    if (type === TankClass.OBLITERATOR) {
      const crack = this.createOscillatorVoice();
      const { gain: crackGain } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
      crack.type = 'square';
      crack.frequency.setValueAtTime(96 + Math.random() * 14, t);
      crack.frequency.exponentialRampToValueAtTime(34, t + 0.18);
      crackGain.gain.setValueAtTime(0, t);
      crackGain.gain.linearRampToValueAtTime(0.14 * spatial.gainMul, t + 0.01);
      crackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      crack.connect(crackGain);
      crack.start(t);
      crack.stop(t + 0.22);
    }
  }

  playRestorationAura(options?: AudioSpatialOptions) {
    if (!this.enabled || this.muteGameSounds) return;
    this.resume();
    if (this.volume <= 0.001) return;
    if (!this.shouldPlaySound(options, true)) return;
    const spatial = this.getSpatialMix(options);
    if (!this.throttle('restoration-aura', Math.round(180 * spatial.throttleMul))) return;
    const t = this.ctx.currentTime;
    const osc = this.createOscillatorVoice();
    const { gain } = this.createPannedGain(spatial.panRange * 0.8, spatial.pan, spatial.lowpassHz);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420 + Math.random() * 30, t);
    osc.frequency.linearRampToValueAtTime(520 + Math.random() * 40, t + 0.09);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.06 * spatial.gainMul, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  playBloodDrainTick(options?: AudioSpatialOptions) {
    if (!this.enabled || this.muteGameSounds) return;
    this.resume();
    if (this.volume <= 0.001) return;
    if (!this.shouldPlaySound(options, true)) return;
    const spatial = this.getSpatialMix(options);
    if (!this.throttle('blood-drain', Math.round(90 * spatial.throttleMul))) return;
    const t = this.ctx.currentTime;
    const osc = this.createOscillatorVoice();
    const { gain } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(170 + Math.random() * 60, t);
    osc.frequency.exponentialRampToValueAtTime(75, t + 0.07);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.1 * spatial.gainMul, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  playBloodBurst(options?: AudioSpatialOptions) {
    if (!this.enabled || this.muteGameSounds) return;
    this.resume();
    if (this.volume <= 0.001) return;
    if (!this.shouldPlaySound(options, true)) return;
    const spatial = this.getSpatialMix(options);
    if (!this.throttle('blood-burst', Math.round(350 * spatial.throttleMul))) return;
    const t = this.ctx.currentTime;
    const body = this.createOscillatorVoice();
    const hiss = this.createOscillatorVoice();
    const snap = this.createOscillatorVoice();
    const { gain } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
    const colorFilter = this.ctx.createBiquadFilter();
    colorFilter.type = 'bandpass';
    colorFilter.frequency.setValueAtTime(620, t);
    colorFilter.Q.setValueAtTime(1.2, t);

    body.type = 'sawtooth';
    body.frequency.setValueAtTime(132, t);
    body.frequency.exponentialRampToValueAtTime(68, t + 0.11);
    body.frequency.exponentialRampToValueAtTime(34, t + 0.3);

    hiss.type = 'triangle';
    hiss.frequency.setValueAtTime(760, t);
    hiss.frequency.exponentialRampToValueAtTime(210, t + 0.16);

    snap.type = 'square';
    snap.frequency.setValueAtTime(1180, t);
    snap.frequency.exponentialRampToValueAtTime(320, t + 0.045);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.22 * spatial.gainMul, t + 0.012);
    gain.gain.linearRampToValueAtTime(0.16 * spatial.gainMul, t + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.34);

    body.connect(colorFilter);
    hiss.connect(colorFilter);
    snap.connect(colorFilter);
    colorFilter.connect(gain);

    body.start(t);
    hiss.start(t);
    snap.start(t);
    body.stop(t + 0.34);
    hiss.stop(t + 0.18);
    snap.stop(t + 0.06);

    if (this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.setValueAtTime(900, t);
      const { gain: noiseGain } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
      noiseGain.gain.setValueAtTime(0, t);
      noiseGain.gain.linearRampToValueAtTime(0.1 * spatial.gainMul, t + 0.01);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      src.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      src.start(t);
      src.stop(t + 0.16);
    }
  }

  playBossRushRoar(
    options?: AudioSpatialOptions,
    bossKey: 'gatekeeper' | 'splitter' | 'reactor' | 'executioner' | 'grand_singularity' = 'gatekeeper',
    awakened = false
  ) {
    if (!this.enabled || this.muteGameSounds) return;
    this.resume();
    if (this.volume <= 0.001) return;
    if (!this.shouldPlaySound(options, true)) return;

    const spatial = this.getSpatialMix(options);
    const bossGainBoost = this.bossRushLoudnessBoost;
    if (!this.throttle(`boss-rush-roar-${bossKey}-${awakened ? 'awakened' : 'base'}`, Math.round((awakened ? 420 : 560) * spatial.throttleMul))) return;

    const t = this.ctx.currentTime;
    const sub = this.createOscillatorVoice();
    const main = this.createOscillatorVoice();
    const edge = this.createOscillatorVoice();
    const { gain } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
    const filter = this.ctx.createBiquadFilter();
    filter.type = bossKey === 'splitter' || bossKey === 'grand_singularity' ? 'bandpass' : 'lowpass';

    let duration = awakened ? 1.48 : 1.2;
    let subStart = 46;
    let subEnd = 18;
    let mainStart = 118;
    let mainEnd = 36;
    let edgeStart = 244;
    let edgeEnd = 88;
    let peak = awakened ? 0.34 : 0.26;
    let mainWave: OscillatorType = 'sawtooth';
    let edgeWave: OscillatorType = 'triangle';
    let filterStart = 980;
    let filterEnd = 120;

    if (bossKey === 'gatekeeper') {
      duration = awakened ? 1.35 : 1.12;
      subStart = 38; subEnd = 16;
      mainStart = 96; mainEnd = 30;
      edgeStart = 186; edgeEnd = 62;
      peak = awakened ? 0.32 : 0.24;
      mainWave = 'square';
      edgeWave = 'square';
      filterStart = 820;
    } else if (bossKey === 'splitter') {
      duration = awakened ? 1.12 : 0.96;
      subStart = 54; subEnd = 26;
      mainStart = 164; mainEnd = 68;
      edgeStart = 426; edgeEnd = 164;
      peak = awakened ? 0.28 : 0.22;
      mainWave = 'triangle';
      edgeWave = 'sine';
      filterStart = 1580;
      filterEnd = 260;
    } else if (bossKey === 'reactor') {
      duration = awakened ? 1.44 : 1.18;
      subStart = 44; subEnd = 18;
      mainStart = 136; mainEnd = 42;
      edgeStart = 322; edgeEnd = 104;
      peak = awakened ? 0.36 : 0.27;
      mainWave = 'sawtooth';
      edgeWave = 'triangle';
      filterStart = 1240;
    } else if (bossKey === 'executioner') {
      duration = awakened ? 1.5 : 1.24;
      subStart = 34; subEnd = 14;
      mainStart = 88; mainEnd = 24;
      edgeStart = 148; edgeEnd = 48;
      peak = awakened ? 0.37 : 0.29;
      mainWave = 'square';
      edgeWave = 'square';
      filterStart = 760;
    } else if (bossKey === 'grand_singularity') {
      duration = awakened ? 1.62 : 1.28;
      subStart = 40; subEnd = 12;
      mainStart = 126; mainEnd = 28;
      edgeStart = 278; edgeEnd = 74;
      peak = awakened ? 0.35 : 0.25;
      mainWave = 'triangle';
      edgeWave = 'sine';
      filterStart = 1460;
      filterEnd = 180;
    }

    sub.type = 'sine';
    main.type = mainWave;
    edge.type = edgeWave;
    sub.frequency.setValueAtTime(subStart * this.jitter(1, 0.04), t);
    sub.frequency.exponentialRampToValueAtTime(subEnd * this.jitter(1, 0.04), t + duration * 0.88);
    main.frequency.setValueAtTime(mainStart * this.jitter(1, 0.05), t);
    main.frequency.exponentialRampToValueAtTime(mainEnd * this.jitter(1, 0.06), t + duration * 0.84);
    edge.frequency.setValueAtTime(edgeStart * this.jitter(1, 0.07), t + 0.01);
    edge.frequency.exponentialRampToValueAtTime(edgeEnd * this.jitter(1, 0.06), t + duration * 0.68);
    filter.frequency.setValueAtTime(filterStart * this.jitter(1, 0.1), t);
    filter.frequency.exponentialRampToValueAtTime(filterEnd * this.jitter(1, 0.08), t + duration);
    filter.Q.setValueAtTime((bossKey === 'splitter' || bossKey === 'grand_singularity' ? 3.8 : 1.4) * this.jitter(1, 0.15), t);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak * spatial.gainMul * bossGainBoost, t + 0.02);
    gain.gain.linearRampToValueAtTime(peak * 0.62 * spatial.gainMul * bossGainBoost, t + duration * 0.18);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    sub.connect(filter);
    main.connect(filter);
    edge.connect(filter);
    filter.connect(gain);
    sub.start(t);
    main.start(t);
    edge.start(t);
    sub.stop(t + duration + 0.03);
    main.stop(t + duration + 0.03);
    edge.stop(t + duration * 0.78);

    if (this.noiseBuffer && (bossKey === 'reactor' || bossKey === 'executioner' || bossKey === 'grand_singularity')) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = bossKey === 'reactor' ? 'bandpass' : 'highpass';
      noiseFilter.frequency.setValueAtTime(bossKey === 'reactor' ? 960 : bossKey === 'executioner' ? 720 : 1180, t);
      const { gain: noiseGain } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
      noiseGain.gain.setValueAtTime(0, t);
      noiseGain.gain.linearRampToValueAtTime((awakened ? 0.11 : 0.075) * spatial.gainMul * bossGainBoost, t + 0.015);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration * 0.48);
      src.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      src.start(t);
      src.stop(t + duration * 0.52);
    }
  }

  playBossRushAura(
    options?: AudioSpatialOptions,
    bossKey: 'gatekeeper' | 'splitter' | 'reactor' | 'executioner' | 'grand_singularity' = 'gatekeeper',
    awakened = false
  ) {
    if (!this.enabled || this.muteGameSounds) return;
    this.resume();
    if (this.volume <= 0.001) return;
    if (!this.shouldPlaySound(options, true)) return;
    const spatial = this.getSpatialMix(options);
    const bossGainBoost = this.bossRushLoudnessBoost * 1.08;
    const throttleKey = `boss-rush-aura-${bossKey}-${awakened ? 'awakened' : 'base'}`;
    if (!this.throttle(throttleKey, Math.round((awakened ? 220 : 320) * spatial.throttleMul))) return;

    const t = this.ctx.currentTime;
    const oscA = this.createOscillatorVoice();
    const oscB = this.createOscillatorVoice();
    const ghost = this.createOscillatorVoice();
    const { gain } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    const pitchFlavor = this.chooseBossPitchFlavor(awakened);
    const contourFlavor = Math.random() < 0.5 ? this.semitoneFactor(-5) : this.semitoneFactor(4);
    const duration = (awakened ? 0.34 : 0.28) * this.jitter(1, 0.18);

    let startA = 104;
    let endA = 64;
    let startB = 192;
    let endB = 132;
    let peak = awakened ? 0.11 : 0.075;
    let waveA: OscillatorType = 'sawtooth';
    let waveB: OscillatorType = 'square';
    let waveGhost: OscillatorType = 'triangle';
    let center = 380;

    if (bossKey === 'gatekeeper') {
      startA = awakened ? 92 : 108;
      endA = awakened ? 54 : 66;
      startB = awakened ? 176 : 198;
      endB = awakened ? 110 : 138;
      peak = awakened ? 0.125 : 0.084;
      waveA = 'square';
      waveB = 'sawtooth';
      center = 340;
    } else if (bossKey === 'splitter') {
      startA = awakened ? 214 : 242;
      endA = awakened ? 136 : 158;
      startB = awakened ? 428 : 476;
      endB = awakened ? 248 : 292;
      peak = awakened ? 0.102 : 0.07;
      waveA = 'triangle';
      waveB = 'triangle';
      waveGhost = 'sine';
      center = 880;
    } else if (bossKey === 'reactor') {
      startA = awakened ? 138 : 164;
      endA = awakened ? 74 : 92;
      startB = awakened ? 262 : 304;
      endB = awakened ? 142 : 176;
      peak = awakened ? 0.132 : 0.09;
      waveA = 'sawtooth';
      waveB = 'triangle';
      waveGhost = 'square';
      center = 560;
    } else if (bossKey === 'executioner') {
      startA = awakened ? 82 : 98;
      endA = awakened ? 42 : 56;
      startB = awakened ? 148 : 176;
      endB = awakened ? 84 : 108;
      peak = awakened ? 0.136 : 0.094;
      waveA = 'square';
      waveB = 'square';
      waveGhost = 'sawtooth';
      center = 260;
    } else if (bossKey === 'grand_singularity') {
      startA = awakened ? 156 : 182;
      endA = awakened ? 88 : 106;
      startB = awakened ? 318 : 362;
      endB = awakened ? 176 : 208;
      peak = awakened ? 0.116 : 0.082;
      waveA = 'sine';
      waveB = 'triangle';
      waveGhost = 'sine';
      center = 620;
    }

    oscA.type = waveA;
    oscB.type = waveB;
    ghost.type = waveGhost;
    oscA.frequency.setValueAtTime(startA * pitchFlavor * this.jitter(1, 0.045), t);
    oscA.frequency.exponentialRampToValueAtTime(endA * contourFlavor * this.jitter(1, 0.03), t + duration * 0.82);
    oscB.frequency.setValueAtTime(startB * pitchFlavor * this.jitter(1, 0.05), t);
    oscB.frequency.exponentialRampToValueAtTime(endB * contourFlavor * this.jitter(1, 0.035), t + duration * 0.84);
    ghost.frequency.setValueAtTime((startA * 0.5 + endB * 0.35) * pitchFlavor * this.jitter(1, 0.05), t);
    ghost.frequency.exponentialRampToValueAtTime((endA * 0.7 + endB * 0.2) * contourFlavor * this.jitter(1, 0.04), t + duration);
    bp.frequency.setValueAtTime(center * this.jitter(1, 0.12), t);
    bp.frequency.linearRampToValueAtTime(center * this.jitter(1, awakened ? 0.2 : 0.14), t + duration * 0.55);
    bp.Q.setValueAtTime((awakened ? 2.8 : 2.1) * this.jitter(1, 0.18), t);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak * spatial.gainMul * bossGainBoost, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    oscA.connect(bp);
    oscB.connect(bp);
    ghost.connect(bp);
    bp.connect(gain);
    oscA.start(t);
    oscB.start(t);
    ghost.start(t);
    oscA.stop(t + duration + 0.02);
    oscB.stop(t + duration + 0.02);
    ghost.stop(t + duration + 0.03);

    if (this.noiseBuffer && (bossKey === 'reactor' || bossKey === 'grand_singularity')) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const color = this.ctx.createBiquadFilter();
      color.type = bossKey === 'reactor' ? 'bandpass' : 'highpass';
      color.frequency.setValueAtTime(bossKey === 'reactor' ? 720 : 1440, t);
      const { gain: noiseGain } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
      noiseGain.gain.setValueAtTime(0, t);
      noiseGain.gain.linearRampToValueAtTime((awakened ? 0.05 : 0.028) * spatial.gainMul * bossGainBoost, t + 0.014);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration * 0.45);
      src.connect(color);
      color.connect(noiseGain);
      src.start(t);
      src.stop(t + duration * 0.48);
    }
  }

  playBossRushTransformation(
    options?: AudioSpatialOptions,
    bossKey: 'gatekeeper' | 'splitter' | 'reactor' | 'executioner' | 'grand_singularity' = 'gatekeeper'
  ) {
    if (!this.enabled || this.muteGameSounds) return;
    this.resume();
    if (this.volume <= 0.001) return;
    if (!this.shouldPlaySound(options, true)) return;
    const spatial = this.getSpatialMix(options);
    const bossGainBoost = this.bossRushLoudnessBoost * 1.16;
    if (!this.throttle(`boss-rush-transform-${bossKey}`, Math.round(1350 * spatial.throttleMul))) return;

    const t = this.ctx.currentTime;
    const rise = this.createOscillatorVoice();
    const body = this.createOscillatorVoice();
    const scream = this.createOscillatorVoice();
    const sub = this.createOscillatorVoice();
    const { gain } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
    const filter = this.ctx.createBiquadFilter();
    const shimmer = this.ctx.createBiquadFilter();

    let duration = 2.45;
    let riseStart = 64;
    let riseEnd = 280;
    let bodyStart = 112;
    let bodyEnd = 66;
    let screamStart = 220;
    let screamEnd = 540;
    let subStart = 28;
    let subEnd = 16;
    let peak = 0.26;
    let bodyWave: OscillatorType = 'sawtooth';
    let screamWave: OscillatorType = 'triangle';
    let filterStart = 520;
    let filterEnd = 2400;
    let shimmerStart = 1800;

    if (bossKey === 'gatekeeper') {
      duration = 2.2;
      riseStart = 58; riseEnd = 246;
      bodyStart = 86; bodyEnd = 52;
      screamStart = 168; screamEnd = 388;
      peak = 0.24;
      bodyWave = 'square';
      screamWave = 'square';
      filterStart = 440;
      filterEnd = 1680;
      shimmerStart = 1320;
    } else if (bossKey === 'splitter') {
      duration = 2.05;
      riseStart = 118; riseEnd = 412;
      bodyStart = 184; bodyEnd = 92;
      screamStart = 320; screamEnd = 920;
      peak = 0.22;
      bodyWave = 'triangle';
      screamWave = 'sine';
      filterStart = 920;
      filterEnd = 3200;
      shimmerStart = 2600;
    } else if (bossKey === 'reactor') {
      duration = 2.55;
      riseStart = 76; riseEnd = 334;
      bodyStart = 122; bodyEnd = 74;
      screamStart = 242; screamEnd = 720;
      peak = 0.29;
      bodyWave = 'sawtooth';
      screamWave = 'triangle';
      filterStart = 620;
      filterEnd = 2860;
      shimmerStart = 2200;
    } else if (bossKey === 'executioner') {
      duration = 2.34;
      riseStart = 54; riseEnd = 264;
      bodyStart = 78; bodyEnd = 40;
      screamStart = 144; screamEnd = 468;
      peak = 0.27;
      bodyWave = 'square';
      screamWave = 'sawtooth';
      filterStart = 360;
      filterEnd = 1960;
      shimmerStart = 1480;
    } else if (bossKey === 'grand_singularity') {
      duration = 2.8;
      riseStart = 82; riseEnd = 198;
      bodyStart = 128; bodyEnd = 38;
      screamStart = 286; screamEnd = 680;
      peak = 0.25;
      bodyWave = 'triangle';
      screamWave = 'sine';
      filterStart = 760;
      filterEnd = 2480;
      shimmerStart = 3400;
    }

    rise.type = 'triangle';
    body.type = bodyWave;
    scream.type = screamWave;
    sub.type = 'sine';

    rise.frequency.setValueAtTime(riseStart * this.jitter(1, 0.05), t);
    rise.frequency.exponentialRampToValueAtTime(riseEnd * this.jitter(1, 0.06), t + duration * 0.72);
    body.frequency.setValueAtTime(bodyStart * this.jitter(1, 0.04), t + 0.03);
    body.frequency.exponentialRampToValueAtTime(bodyEnd * this.jitter(1, 0.05), t + duration);
    scream.frequency.setValueAtTime(screamStart * this.jitter(1, 0.06), t + duration * 0.26);
    scream.frequency.exponentialRampToValueAtTime(screamEnd * this.jitter(1, 0.08), t + duration * 0.78);
    sub.frequency.setValueAtTime(subStart * this.jitter(1, 0.04), t);
    sub.frequency.exponentialRampToValueAtTime(subEnd * this.jitter(1, 0.04), t + duration);

    filter.type = bossKey === 'splitter' || bossKey === 'grand_singularity' ? 'bandpass' : 'lowpass';
    filter.frequency.setValueAtTime(filterStart * this.jitter(1, 0.08), t);
    filter.frequency.exponentialRampToValueAtTime(filterEnd * this.jitter(1, 0.1), t + duration * 0.78);
    filter.Q.setValueAtTime((bossKey === 'splitter' ? 4.2 : bossKey === 'grand_singularity' ? 3.6 : 1.9) * this.jitter(1, 0.18), t);

    shimmer.type = 'highpass';
    shimmer.frequency.setValueAtTime(shimmerStart * this.jitter(1, 0.1), t);
    shimmer.Q.setValueAtTime(0.8, t);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak * 0.42 * spatial.gainMul * bossGainBoost, t + duration * 0.18);
    gain.gain.linearRampToValueAtTime(peak * spatial.gainMul * bossGainBoost, t + duration * 0.56);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    sub.connect(filter);
    body.connect(filter);
    rise.connect(filter);
    scream.connect(shimmer);
    filter.connect(gain);
    shimmer.connect(gain);

    sub.start(t);
    rise.start(t);
    body.start(t + 0.02);
    scream.start(t + duration * 0.18);
    sub.stop(t + duration + 0.04);
    rise.stop(t + duration * 0.78);
    body.stop(t + duration + 0.04);
    scream.stop(t + duration * 0.82);

    if (this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const color = this.ctx.createBiquadFilter();
      color.type = bossKey === 'reactor' ? 'bandpass' : bossKey === 'grand_singularity' ? 'highpass' : 'lowpass';
      color.frequency.setValueAtTime(
        bossKey === 'reactor' ? 1180 :
        bossKey === 'splitter' ? 2400 :
        bossKey === 'executioner' ? 860 :
        bossKey === 'grand_singularity' ? 2100 : 720,
        t
      );
      const { gain: noiseGain } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
      noiseGain.gain.setValueAtTime(0, t);
      noiseGain.gain.linearRampToValueAtTime(0.06 * spatial.gainMul * bossGainBoost, t + 0.03);
      noiseGain.gain.linearRampToValueAtTime(0.11 * spatial.gainMul * bossGainBoost, t + duration * 0.42);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration * 0.9);
      src.connect(color);
      color.connect(noiseGain);
      src.start(t);
      src.stop(t + duration * 0.92);
    }
  }

  playBossRushCinematicOpen(
    options?: AudioSpatialOptions,
    bossKey: 'gatekeeper' | 'splitter' | 'reactor' | 'executioner' | 'grand_singularity' = 'gatekeeper',
    mode: 'intro' | 'awakening' | 'transformation' = 'intro'
  ) {
    if (!this.enabled || this.muteGameSounds) return;
    this.resume();
    if (this.volume <= 0.001) return;
    if (!this.shouldPlaySound(options, true)) return;
    const spatial = this.getSpatialMix(options);
    if (!this.throttle(`boss-rush-cinematic-open-${bossKey}-${mode}`, Math.round(900 * spatial.throttleMul))) return;

    const t = this.ctx.currentTime;
    const lead = this.createOscillatorVoice();
    const body = this.createOscillatorVoice();
    const sub = this.createOscillatorVoice();
    const { gain } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
    const filter = this.ctx.createBiquadFilter();
    filter.type = bossKey === 'splitter' || bossKey === 'grand_singularity' ? 'bandpass' : 'lowpass';

    let duration = mode === 'intro' ? 0.42 : mode === 'awakening' ? 0.58 : 0.7;
    let peak = mode === 'intro' ? 0.12 : mode === 'awakening' ? 0.16 : 0.18;
    let leadStart = 240;
    let leadEnd = 118;
    let bodyStart = 132;
    let bodyEnd = 72;
    let subStart = 42;
    let subEnd = 24;
    let leadWave: OscillatorType = 'triangle';
    let bodyWave: OscillatorType = 'sawtooth';

    if (bossKey === 'gatekeeper') {
      leadStart = 190; leadEnd = 112; bodyStart = 88; bodyEnd = 46; subStart = 34; subEnd = 18;
      leadWave = 'square'; bodyWave = 'square';
    } else if (bossKey === 'splitter') {
      leadStart = 420; leadEnd = 184; bodyStart = 206; bodyEnd = 104; subStart = 52; subEnd = 24;
      leadWave = 'triangle'; bodyWave = 'triangle';
    } else if (bossKey === 'reactor') {
      leadStart = 286; leadEnd = 136; bodyStart = 148; bodyEnd = 80; subStart = 40; subEnd = 20;
      leadWave = 'sawtooth'; bodyWave = 'sawtooth';
    } else if (bossKey === 'executioner') {
      leadStart = 160; leadEnd = 82; bodyStart = 78; bodyEnd = 38; subStart = 30; subEnd = 15;
      leadWave = 'square'; bodyWave = 'square';
    } else if (bossKey === 'grand_singularity') {
      leadStart = 318; leadEnd = 96; bodyStart = 118; bodyEnd = 36; subStart = 28; subEnd = 12;
      leadWave = 'sine'; bodyWave = 'triangle';
    }

    lead.type = leadWave;
    body.type = bodyWave;
    sub.type = 'sine';
    lead.frequency.setValueAtTime(leadStart * this.jitter(1, 0.05), t);
    lead.frequency.exponentialRampToValueAtTime(leadEnd * this.jitter(1, 0.06), t + duration * 0.88);
    body.frequency.setValueAtTime(bodyStart * this.jitter(1, 0.05), t + 0.01);
    body.frequency.exponentialRampToValueAtTime(bodyEnd * this.jitter(1, 0.05), t + duration);
    sub.frequency.setValueAtTime(subStart * this.jitter(1, 0.04), t);
    sub.frequency.exponentialRampToValueAtTime(subEnd * this.jitter(1, 0.04), t + duration * 0.92);
    filter.frequency.setValueAtTime((mode === 'intro' ? 980 : mode === 'awakening' ? 1180 : 1440) * this.jitter(1, 0.12), t);
    filter.frequency.exponentialRampToValueAtTime((bossKey === 'executioner' ? 140 : 220) * this.jitter(1, 0.08), t + duration);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak * spatial.gainMul * this.bossRushLoudnessBoost, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    lead.connect(filter);
    body.connect(filter);
    sub.connect(filter);
    filter.connect(gain);
    lead.start(t);
    body.start(t + 0.005);
    sub.start(t);
    lead.stop(t + duration + 0.03);
    body.stop(t + duration + 0.03);
    sub.stop(t + duration + 0.03);
  }

  playBossRushAwaken(
    options?: AudioSpatialOptions,
    bossKey: 'gatekeeper' | 'splitter' | 'reactor' | 'executioner' | 'grand_singularity' = 'gatekeeper'
  ) {
    if (!this.enabled || this.muteGameSounds) return;
    this.resume();
    if (this.volume <= 0.001) return;
    if (!this.shouldPlaySound(options, true)) return;
    const spatial = this.getSpatialMix(options);
    const bossGainBoost = this.bossRushLoudnessBoost * 1.12;
    if (!this.throttle(`boss-rush-awaken-${bossKey}`, Math.round(700 * spatial.throttleMul))) return;

    const t = this.ctx.currentTime;
    const osc = this.createOscillatorVoice();
    const sub = this.createOscillatorVoice();
    const top = this.createOscillatorVoice();
    const { gain } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const pitchFlavor = this.chooseBossPitchFlavor(true);
    const duration = 0.68 * this.jitter(1, 0.15);

    let start = 280;
    let end = 110;
    let subStart = 64;
    let subEnd = 28;
    let wave: OscillatorType = 'sawtooth';
    let peak = 0.18;

    if (bossKey === 'gatekeeper') {
      start = 246;
      end = 84;
      subStart = 54;
      subEnd = 20;
      wave = 'square';
      peak = 0.17;
    } else if (bossKey === 'splitter') {
      start = 482;
      end = 148;
      subStart = 76;
      subEnd = 36;
      wave = 'triangle';
      peak = 0.145;
    } else if (bossKey === 'reactor') {
      start = 326;
      end = 96;
      subStart = 68;
      subEnd = 24;
      wave = 'sawtooth';
      peak = 0.19;
    } else if (bossKey === 'executioner') {
      start = 212;
      end = 58;
      subStart = 48;
      subEnd = 16;
      wave = 'square';
      peak = 0.2;
    } else if (bossKey === 'grand_singularity') {
      start = 372;
      end = 88;
      subStart = 58;
      subEnd = 18;
      wave = 'triangle';
      peak = 0.175;
    }

    osc.type = wave;
    sub.type = 'sine';
    top.type = bossKey === 'grand_singularity' ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(start * pitchFlavor * this.jitter(1, 0.06), t);
    osc.frequency.exponentialRampToValueAtTime(end * this.semitoneFactor(Math.random() < 0.5 ? -4 : 3) * this.jitter(1, 0.05), t + duration * 0.8);
    sub.frequency.setValueAtTime(subStart * this.jitter(1, 0.04), t);
    sub.frequency.exponentialRampToValueAtTime(subEnd * this.jitter(1, 0.05), t + duration * 0.88);
    top.frequency.setValueAtTime(start * 1.85 * this.jitter(1, 0.08), t + 0.01);
    top.frequency.exponentialRampToValueAtTime(end * 0.92 * this.jitter(1, 0.07), t + duration * 0.62);
    filter.frequency.setValueAtTime(1200 * this.jitter(1, 0.12), t);
    filter.frequency.exponentialRampToValueAtTime(120, t + duration * 0.88);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak * spatial.gainMul * bossGainBoost, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(filter);
    sub.connect(filter);
    top.connect(filter);
    filter.connect(gain);
    osc.start(t);
    sub.start(t);
    top.start(t + 0.01);
    osc.stop(t + duration + 0.02);
    sub.stop(t + duration + 0.02);
    top.stop(t + duration * 0.72);
  }

  playBossRushDefeat(
    options?: AudioSpatialOptions,
    bossKey: 'gatekeeper' | 'splitter' | 'reactor' | 'executioner' | 'grand_singularity' = 'gatekeeper'
  ) {
    if (!this.enabled || this.muteGameSounds) return;
    this.resume();
    if (this.volume <= 0.001) return;
    if (!this.shouldPlaySound(options, true)) return;
    const spatial = this.getSpatialMix(options);
    if (!this.throttle(`boss-rush-defeat-${bossKey}`, Math.round(1100 * spatial.throttleMul))) return;

    const t = this.ctx.currentTime;
    const body = this.createOscillatorVoice();
    const sub = this.createOscillatorVoice();
    const tail = this.createOscillatorVoice();
    const { gain } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
    const filter = this.ctx.createBiquadFilter();
    filter.type = bossKey === 'splitter' || bossKey === 'grand_singularity' ? 'bandpass' : 'lowpass';

    let duration = 1.05;
    let peak = 0.22;
    let start = 180;
    let end = 44;
    let subStart = 44;
    let subEnd = 12;
    let tailStart = 360;
    let tailEnd = 96;
    let wave: OscillatorType = 'sawtooth';

    if (bossKey === 'gatekeeper') {
      start = 132; end = 26; tailStart = 210; tailEnd = 58; wave = 'square';
    } else if (bossKey === 'splitter') {
      start = 268; end = 82; tailStart = 520; tailEnd = 184; duration = 0.88; peak = 0.18; wave = 'triangle';
    } else if (bossKey === 'reactor') {
      start = 224; end = 52; tailStart = 412; tailEnd = 108; duration = 1.12; peak = 0.24; wave = 'sawtooth';
    } else if (bossKey === 'executioner') {
      start = 118; end = 22; tailStart = 180; tailEnd = 44; duration = 0.94; peak = 0.23; wave = 'square';
    } else if (bossKey === 'grand_singularity') {
      start = 206; end = 18; tailStart = 286; tailEnd = 38; duration = 1.22; peak = 0.21; wave = 'triangle';
    }

    body.type = wave;
    sub.type = 'sine';
    tail.type = bossKey === 'grand_singularity' ? 'sine' : 'triangle';
    body.frequency.setValueAtTime(start * this.jitter(1, 0.05), t);
    body.frequency.exponentialRampToValueAtTime(end * this.jitter(1, 0.06), t + duration);
    sub.frequency.setValueAtTime(subStart * this.jitter(1, 0.03), t);
    sub.frequency.exponentialRampToValueAtTime(subEnd * this.jitter(1, 0.04), t + duration * 0.94);
    tail.frequency.setValueAtTime(tailStart * this.jitter(1, 0.08), t + 0.02);
    tail.frequency.exponentialRampToValueAtTime(tailEnd * this.jitter(1, 0.06), t + duration * 0.68);
    filter.frequency.setValueAtTime((bossKey === 'executioner' ? 720 : 1180) * this.jitter(1, 0.12), t);
    filter.frequency.exponentialRampToValueAtTime(70, t + duration);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak * spatial.gainMul * this.bossRushLoudnessBoost, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    body.connect(filter);
    sub.connect(filter);
    tail.connect(filter);
    filter.connect(gain);
    body.start(t);
    sub.start(t);
    tail.start(t + 0.01);
    body.stop(t + duration + 0.02);
    sub.stop(t + duration + 0.02);
    tail.stop(t + duration * 0.72);
  }

  playBossRushIntermission(
    options?: AudioSpatialOptions,
    urgency: 'countdown' | 'arrival' | 'victory' = 'countdown'
  ) {
    if (!this.enabled || this.muteGameSounds) return;
    this.resume();
    if (this.volume <= 0.001) return;
    if (!this.shouldPlaySound(options, false)) return;
    if (!this.throttle(`boss-rush-intermission-${urgency}`, urgency === 'countdown' ? 420 : 900)) return;

    const t = this.ctx.currentTime;
    const oscA = this.createOscillatorVoice();
    const oscB = this.createOscillatorVoice();
    const { gain } = this.createPannedGain(0.12, options?.pan);
    const startA = urgency === 'victory' ? 740 : urgency === 'arrival' ? 520 : 360;
    const endA = urgency === 'victory' ? 1040 : urgency === 'arrival' ? 760 : 520;
    const startB = urgency === 'victory' ? 1120 : urgency === 'arrival' ? 820 : 560;
    const endB = urgency === 'victory' ? 1480 : urgency === 'arrival' ? 1160 : 760;
    const peak = urgency === 'victory' ? 0.16 : urgency === 'arrival' ? 0.14 : 0.09;
    const duration = urgency === 'countdown' ? 0.16 : 0.24;

    oscA.type = urgency === 'countdown' ? 'triangle' : 'sine';
    oscB.type = urgency === 'countdown' ? 'square' : 'triangle';
    oscA.frequency.setValueAtTime(startA, t);
    oscA.frequency.exponentialRampToValueAtTime(endA, t + duration);
    oscB.frequency.setValueAtTime(startB, t + 0.01);
    oscB.frequency.exponentialRampToValueAtTime(endB, t + duration * 0.9);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    oscA.connect(gain);
    oscB.connect(gain);
    oscA.start(t);
    oscB.start(t + 0.005);
    oscA.stop(t + duration + 0.02);
    oscB.stop(t + duration + 0.02);
  }

  playBossRushTelegraphSpawn(
    bossKey: BossRushBossAudioKey = 'gatekeeper',
    telegraphType: BossRushTelegraphType,
    options?: AudioSpatialOptions
  ) {
    if (!this.enabled || this.muteGameSounds) return;
    this.resume();
    if (this.volume <= 0.001) return;
    if (!this.shouldPlaySound(options, true)) return;

    const spatial = this.getSpatialMix(options);
    if (!this.throttle(`boss-rush-spawn-${bossKey}-${telegraphType}`, Math.round(84 * spatial.throttleMul))) return;

    const t = this.ctx.currentTime;
    const lead = this.createOscillatorVoice();
    const accent = this.createOscillatorVoice();
    const { gain } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
    const filter = this.ctx.createBiquadFilter();
    filter.type = telegraphType === 'red_circle_impact' || telegraphType === 'red_square_marker' ? 'bandpass' : 'highpass';

    let startA = 260;
    let endA = 420;
    let startB = 520;
    let endB = 760;
    let peak = 0.05;
    let duration = 0.09;
    let waveA: OscillatorType = 'triangle';
    let waveB: OscillatorType = 'sine';
    let filterStart = 1080;
    let filterEnd = 1880;

    if (bossKey === 'gatekeeper') {
      startA = 132; endA = 216; startB = 264; endB = 428; peak = 0.056; waveA = 'square'; waveB = 'triangle'; filterStart = 860; filterEnd = 1320;
    } else if (bossKey === 'splitter') {
      startA = 360; endA = 548; startB = 684; endB = 1040; peak = 0.046; waveA = 'triangle'; waveB = 'sine'; filterStart = 1380; filterEnd = 2280;
    } else if (bossKey === 'reactor') {
      startA = 210; endA = 338; startB = 452; endB = 702; peak = 0.058; waveA = 'sawtooth'; waveB = 'triangle'; filterStart = 920; filterEnd = 1740;
    } else if (bossKey === 'executioner') {
      startA = 148; endA = 252; startB = 298; endB = 462; peak = 0.06; waveA = 'square'; waveB = 'square'; filterStart = 780; filterEnd = 1260;
    } else if (bossKey === 'grand_singularity') {
      startA = 284; endA = 436; startB = 564; endB = 824; peak = 0.054; waveA = 'sine'; waveB = 'triangle'; filterStart = 1160; filterEnd = 2100;
    }

    const typeMul =
      telegraphType === 'straight_red_lane' ? 0.96 :
      telegraphType === 'wide_red_lane' ? 0.88 :
      telegraphType === 'red_square_marker' ? 1.14 :
      telegraphType === 'red_circle_impact' ? 1.1 :
      telegraphType === 'red_cone_sweep' ? 0.9 :
      telegraphType === 'cross_laser_warning' ? 0.78 :
      telegraphType === 'rotating_danger_arc' ? 0.84 :
      telegraphType === 'blood_crescent_pressure' ? 0.72 :
      1;

    lead.type = waveA;
    accent.type = waveB;
    lead.frequency.setValueAtTime(startA * typeMul * this.jitter(1, 0.05), t);
    lead.frequency.exponentialRampToValueAtTime(endA * this.jitter(1, 0.05), t + duration);
    accent.frequency.setValueAtTime(startB * typeMul * this.jitter(1, 0.06), t + 0.006);
    accent.frequency.exponentialRampToValueAtTime(endB * this.jitter(1, 0.05), t + duration * 0.88);
    filter.frequency.setValueAtTime(filterStart * this.jitter(1, 0.08), t);
    filter.frequency.linearRampToValueAtTime(filterEnd * this.jitter(1, 0.08), t + duration);
    filter.Q.setValueAtTime((telegraphType === 'cross_laser_warning' ? 6.4 : telegraphType === 'blood_crescent_pressure' ? 5.1 : 4.2) * this.jitter(1, 0.12), t);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak * spatial.gainMul * this.bossRushLoudnessBoost, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    lead.connect(filter);
    accent.connect(filter);
    filter.connect(gain);
    lead.start(t);
    accent.start(t + 0.004);
    lead.stop(t + duration + 0.02);
    accent.stop(t + duration + 0.02);

    if (this.noiseBuffer && telegraphType !== 'blood_crescent_pressure') {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const color = this.ctx.createBiquadFilter();
      color.type = telegraphType === 'red_circle_impact' || telegraphType === 'red_square_marker' ? 'bandpass' : 'highpass';
      color.frequency.setValueAtTime(
        telegraphType === 'cross_laser_warning' ? 2400 :
        telegraphType === 'wide_red_lane' ? 1800 :
        telegraphType === 'rotating_danger_arc' ? 2100 :
        1500,
        t
      );
      const { gain: noiseGain } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
      noiseGain.gain.setValueAtTime(0, t);
      noiseGain.gain.linearRampToValueAtTime(0.02 * spatial.gainMul * this.bossRushLoudnessBoost, t + 0.004);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration * 0.8);
      src.connect(color);
      color.connect(noiseGain);
      src.start(t);
      src.stop(t + duration * 0.84);
    }
  }

  playBossRushTelegraphCharge(
    bossKey: BossRushBossAudioKey = 'gatekeeper',
    telegraphType: BossRushTelegraphType,
    stage: number,
    options?: AudioSpatialOptions
  ) {
    if (!this.enabled || this.muteGameSounds) return;
    this.resume();
    if (this.volume <= 0.001) return;
    if (!this.shouldPlaySound(options, true)) return;

    const spatial = this.getSpatialMix(options);
    const bossGainBoost = this.bossRushLoudnessBoost;
    const cooldown = Math.round((stage === 0 ? 54 : stage === 1 ? 72 : 96) * spatial.throttleMul);
    if (!this.throttle(`boss-rush-charge-${bossKey}-${telegraphType}-${stage}`, cooldown)) return;

    const t = this.ctx.currentTime;
    const oscA = this.createOscillatorVoice();
    const oscB = this.createOscillatorVoice();
    const shimmer = this.createOscillatorVoice();
    const { gain } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';

    let startA = 280;
    let endA = 420;
    let startB = 124;
    let endB = 186;
    let filterStart = 920;
    let filterEnd = 1480;
    let peak = 0.064;
    let waveA: OscillatorType = 'triangle';
    let waveB: OscillatorType = 'sine';
    let duration = 0.11;

    if (bossKey === 'gatekeeper') {
      startA = 162;
      endA = 244;
      startB = 86;
      endB = 132;
      filterStart = 720;
      filterEnd = 1180;
      peak = 0.064;
      waveA = 'square';
      waveB = 'triangle';
      duration = telegraphType === 'wide_red_lane' || telegraphType === 'cross_laser_warning' ? 0.13 : 0.11;
    } else if (bossKey === 'splitter') {
      startA = 408;
      endA = 612;
      startB = 176;
      endB = 284;
      filterStart = 1220;
      filterEnd = 1980;
      peak = 0.05;
      waveA = 'triangle';
      waveB = 'sawtooth';
      duration = 0.1;
    } else if (bossKey === 'reactor') {
      startA = 236;
      endA = 396;
      startB = 120;
      endB = 214;
      filterStart = 940;
      filterEnd = 1720;
      peak = 0.068;
      waveA = 'sawtooth';
      waveB = 'triangle';
      duration = telegraphType === 'red_circle_impact' ? 0.145 : 0.118;
    } else if (bossKey === 'executioner') {
      startA = 198;
      endA = 286;
      startB = 96;
      endB = 154;
      filterStart = 820;
      filterEnd = 1320;
      peak = 0.066;
      waveA = 'square';
      waveB = 'sine';
      duration = telegraphType === 'red_cone_sweep' ? 0.14 : 0.12;
    } else if (bossKey === 'grand_singularity') {
      startA = 292;
      endA = 472;
      startB = 136;
      endB = 228;
      filterStart = 780;
      filterEnd = 1500;
      peak = 0.062;
      waveA = 'triangle';
      waveB = 'sine';
      duration = telegraphType === 'rotating_danger_arc' ? 0.15 : 0.12;
    }

    const stageLift = 1 + stage * 0.12;
    const typeMul =
      telegraphType === 'red_circle_impact' ? 0.92 :
      telegraphType === 'red_square_marker' ? 1.08 :
      telegraphType === 'blood_crescent_pressure' ? 0.76 :
      telegraphType === 'red_cone_sweep' ? 0.84 :
      telegraphType === 'cross_laser_warning' ? 0.78 :
      telegraphType === 'rotating_danger_arc' ? 0.74 :
      telegraphType === 'wide_red_lane' ? 0.82 :
      1;

    oscA.type = waveA;
    oscB.type = waveB;
    shimmer.type =
      telegraphType === 'cross_laser_warning' || telegraphType === 'wide_red_lane' ? 'square' :
      telegraphType === 'red_circle_impact' || telegraphType === 'red_square_marker' ? 'triangle' :
      telegraphType === 'blood_crescent_pressure' ? 'sine' :
      'sawtooth';
    oscA.frequency.setValueAtTime(startA * typeMul * this.jitter(1, 0.05), t);
    oscA.frequency.exponentialRampToValueAtTime(endA * stageLift * this.jitter(1, 0.05), t + duration);
    oscB.frequency.setValueAtTime(startB * this.jitter(1, 0.06), t);
    oscB.frequency.exponentialRampToValueAtTime(endB * stageLift * this.jitter(1, 0.05), t + duration * 0.86);
    shimmer.frequency.setValueAtTime(
      (telegraphType === 'cross_laser_warning' ? endA * 1.8 :
      telegraphType === 'rotating_danger_arc' ? endA * 1.55 :
      telegraphType === 'blood_crescent_pressure' ? startA * 1.2 :
      endB * 1.22) * this.jitter(1, 0.07),
      t + 0.01
    );
    shimmer.frequency.exponentialRampToValueAtTime(
      (telegraphType === 'red_circle_impact' ? endB * 0.9 : endA * 0.78) * this.jitter(1, 0.06),
      t + duration * 0.82
    );
    filter.frequency.setValueAtTime(filterStart * this.jitter(1, 0.08), t);
    filter.frequency.linearRampToValueAtTime(filterEnd * stageLift * this.jitter(1, 0.08), t + duration);
    filter.Q.setValueAtTime((telegraphType === 'cross_laser_warning' ? 5.8 : 4.2) * this.jitter(1, 0.12), t);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak * stageLift * spatial.gainMul * bossGainBoost, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    oscA.connect(filter);
    oscB.connect(filter);
    shimmer.connect(filter);
    filter.connect(gain);
    oscA.start(t);
    oscB.start(t);
    shimmer.start(t + 0.006);
    oscA.stop(t + duration + 0.02);
    oscB.stop(t + duration + 0.02);
    shimmer.stop(t + duration * 0.86);

    if (this.noiseBuffer && telegraphType !== 'blood_crescent_pressure') {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const color = this.ctx.createBiquadFilter();
      color.type = telegraphType === 'red_circle_impact' || telegraphType === 'red_square_marker' ? 'bandpass' : 'highpass';
      color.frequency.setValueAtTime(
        telegraphType === 'cross_laser_warning' ? 2600 :
        telegraphType === 'rotating_danger_arc' ? 2200 :
        telegraphType === 'wide_red_lane' ? 2100 :
        1700,
        t
      );
      const { gain: noiseGain } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
      noiseGain.gain.setValueAtTime(0, t);
      noiseGain.gain.linearRampToValueAtTime((0.014 + stage * 0.004) * spatial.gainMul * bossGainBoost, t + 0.006);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration * 0.78);
      src.connect(color);
      color.connect(noiseGain);
      src.start(t);
      src.stop(t + duration * 0.8);
    }
  }

  playBossRushTelegraphImpact(
    bossKey: BossRushBossAudioKey = 'gatekeeper',
    telegraphType: BossRushTelegraphType,
    options?: AudioSpatialOptions
  ) {
    if (!this.enabled || this.muteGameSounds) return;
    this.resume();
    if (this.volume <= 0.001) return;
    if (!this.shouldPlaySound(options, true)) return;

    const spatial = this.getSpatialMix(options);
    const bossGainBoost = this.bossRushLoudnessBoost;
    if (!this.throttle(`boss-rush-impact-${bossKey}-${telegraphType}`, Math.round(120 * spatial.throttleMul))) return;

    const t = this.ctx.currentTime;
    const osc = this.createOscillatorVoice();
    const sub = this.createOscillatorVoice();
    const crack = this.createOscillatorVoice();
    const { gain } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
    const lowpass = this.ctx.createBiquadFilter();
    lowpass.type = 'lowpass';

    let start = 172;
    let end = 58;
    let subStart = 68;
    let subEnd = 24;
    let peak = 0.12;
    let duration = 0.22;
    let wave: OscillatorType = 'sawtooth';

    if (bossKey === 'gatekeeper') {
      start = 148;
      end = 42;
      subStart = 54;
      subEnd = 18;
      peak = 0.128;
      wave = 'square';
    } else if (bossKey === 'splitter') {
      start = 262;
      end = 96;
      subStart = 88;
      subEnd = 34;
      peak = 0.1;
      wave = 'triangle';
      duration = 0.18;
    } else if (bossKey === 'reactor') {
      start = 214;
      end = 64;
      subStart = 74;
      subEnd = 26;
      peak = 0.134;
      wave = 'sawtooth';
      duration = 0.24;
    } else if (bossKey === 'executioner') {
      start = 134;
      end = 36;
      subStart = 48;
      subEnd = 16;
      peak = 0.138;
      wave = 'square';
      duration = 0.2;
    } else if (bossKey === 'grand_singularity') {
      start = 188;
      end = 52;
      subStart = 58;
      subEnd = 18;
      peak = 0.126;
      wave = 'triangle';
      duration = 0.26;
    }

    const typeBoost =
      telegraphType === 'cross_laser_warning' ? 1.18 :
      telegraphType === 'wide_red_lane' ? 1.12 :
      telegraphType === 'blood_crescent_pressure' ? 0.94 :
      telegraphType === 'red_circle_impact' ? 1.06 :
      telegraphType === 'rotating_danger_arc' ? 1.2 :
      1;

    osc.type = wave;
    sub.type = 'sine';
    crack.type =
      telegraphType === 'cross_laser_warning' ? 'square' :
      telegraphType === 'blood_crescent_pressure' ? 'triangle' :
      telegraphType === 'rotating_danger_arc' ? 'sine' :
      'sawtooth';
    osc.frequency.setValueAtTime(start * typeBoost * this.jitter(1, 0.05), t);
    osc.frequency.exponentialRampToValueAtTime(end * this.jitter(1, 0.06), t + duration);
    sub.frequency.setValueAtTime(subStart * this.jitter(1, 0.04), t);
    sub.frequency.exponentialRampToValueAtTime(subEnd * this.jitter(1, 0.05), t + duration * 0.92);
    crack.frequency.setValueAtTime(
      (telegraphType === 'cross_laser_warning' ? start * 2.8 :
      telegraphType === 'red_circle_impact' ? start * 2.2 :
      telegraphType === 'red_square_marker' ? start * 2.45 :
      telegraphType === 'blood_crescent_pressure' ? start * 1.42 :
      start * 1.9) * this.jitter(1, 0.08),
      t + 0.004
    );
    crack.frequency.exponentialRampToValueAtTime(
      (telegraphType === 'rotating_danger_arc' ? end * 1.4 : end * 0.92) * this.jitter(1, 0.07),
      t + duration * 0.52
    );
    lowpass.frequency.setValueAtTime((bossKey === 'splitter' ? 1600 : 980) * this.jitter(1, 0.12), t);
    lowpass.frequency.exponentialRampToValueAtTime(90, t + duration);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak * typeBoost * spatial.gainMul * bossGainBoost, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(lowpass);
    sub.connect(lowpass);
    crack.connect(lowpass);
    lowpass.connect(gain);
    osc.start(t);
    sub.start(t);
    crack.start(t + 0.002);
    osc.stop(t + duration + 0.02);
    sub.stop(t + duration + 0.02);
    crack.stop(t + duration * 0.56);

    if (this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const color = this.ctx.createBiquadFilter();
      color.type =
        telegraphType === 'red_circle_impact' || telegraphType === 'red_square_marker' ? 'bandpass' :
        telegraphType === 'blood_crescent_pressure' ? 'lowpass' :
        'highpass';
      color.frequency.setValueAtTime(
        telegraphType === 'cross_laser_warning' ? 2300 :
        telegraphType === 'wide_red_lane' ? 1800 :
        telegraphType === 'rotating_danger_arc' ? 1560 :
        telegraphType === 'blood_crescent_pressure' ? 920 :
        1380,
        t
      );
      const { gain: noiseGain } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
      noiseGain.gain.setValueAtTime(0, t);
      noiseGain.gain.linearRampToValueAtTime((telegraphType === 'cross_laser_warning' ? 0.05 : 0.034) * spatial.gainMul * bossGainBoost, t + 0.004);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration * 0.7);
      src.connect(color);
      color.connect(noiseGain);
      src.start(t);
      src.stop(t + duration * 0.74);
    }
  }

  playCelestialBoom(options?: AudioSpatialOptions) {
    if (!this.enabled || this.muteGameSounds) return;
    this.resume();
    if (this.volume <= 0.001) return;
    if (!this.shouldPlaySound(options, true)) return;
    const spatial = this.getSpatialMix(options);
    if (!this.throttle('celestial-boom', Math.round(220 * spatial.throttleMul))) return;
    this.playShoot(TankClass.ANNIHILATOR, options);
    const t = this.ctx.currentTime;
    const ring = this.createOscillatorVoice();
    const { gain } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
    ring.type = 'triangle';
    ring.frequency.setValueAtTime(115, t);
    ring.frequency.exponentialRampToValueAtTime(42, t + 0.18);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.12 * spatial.gainMul, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    ring.connect(gain);
    ring.start(t);
    ring.stop(t + 0.22);
  }

  private normalizeBossRushBossAudioKey(
    bossKey: BossRushBossAudioKey = 'gatekeeper'
  ): 'gatekeeper' | 'splitter' | 'reactor' | 'executioner' | 'grand_singularity' {
    if (bossKey === 'splitter' || bossKey === 'vanta_splitter') return 'splitter';
    if (bossKey === 'reactor' || bossKey === 'pyre_reactor') return 'reactor';
    if (bossKey === 'executioner' || bossKey === 'iron_executioner') return 'executioner';
    if (bossKey === 'grand_singularity' || bossKey === 'singularity') return 'grand_singularity';
    return 'gatekeeper';
  }

  private getBossRushAbilitySoundProfile(bossKey: BossRushBossAudioKey): BossRushAbilitySoundProfile {
    const key = this.normalizeBossRushBossAudioKey(bossKey);
    if (key === 'gatekeeper') {
      return {
        base: 118,
        accent: 238,
        sub: 42,
        filter: 760,
        wave: 'square',
        accentWave: 'square',
        noiseColor: 'bandpass',
        bite: 1.08,
        weight: 1.08,
        shimmer: 0.82
      };
    }
    if (key === 'splitter') {
      return {
        base: 268,
        accent: 536,
        sub: 62,
        filter: 1380,
        wave: 'triangle',
        accentWave: 'sine',
        noiseColor: 'highpass',
        bite: 1.2,
        weight: 0.82,
        shimmer: 1.42
      };
    }
    if (key === 'reactor') {
      return {
        base: 172,
        accent: 348,
        sub: 54,
        filter: 980,
        wave: 'sawtooth',
        accentWave: 'triangle',
        noiseColor: 'bandpass',
        bite: 1.0,
        weight: 1.18,
        shimmer: 0.96
      };
    }
    if (key === 'executioner') {
      return {
        base: 92,
        accent: 184,
        sub: 36,
        filter: 620,
        wave: 'square',
        accentWave: 'sawtooth',
        noiseColor: 'lowpass',
        bite: 1.26,
        weight: 1.28,
        shimmer: 0.68
      };
    }
    return {
      base: 154,
      accent: 432,
      sub: 30,
      filter: 1260,
      wave: 'triangle',
      accentWave: 'sine',
      noiseColor: 'bandpass',
      bite: 0.92,
      weight: 1.16,
      shimmer: 1.5
    };
  }

  private getBossRushAbilitySoundFamily(
    attackId?: string,
    telegraphType?: BossRushTelegraphType
  ): BossRushAbilitySoundFamily {
    const id = `${attackId ?? ''} ${String(telegraphType ?? '')}`.toLowerCase();
    if (id.includes('supernova') || id.includes('event_horizon') || id.includes('event horizon') || id.includes('gravity_grid') || id.includes('gravity grid')) return 'ultimate';
    if (id.includes('gravity') || id.includes('singularity') || id.includes('horizon')) return 'gravity';
    if (id.includes('corrupt') || id.includes('zigzag') || id.includes('cascade') || id.includes('vanta') || id.includes('tripwire')) return 'corrupt';
    if (id.includes('cleave') || id.includes('verdict') || id.includes('axe') || id.includes('execution') || id.includes('judgement') || id.includes('judgment')) return 'cleave';
    if (id.includes('grid') || id.includes('hash') || id.includes('crosshatch') || id.includes('lattice') || id.includes('maze') || id.includes('crossfire')) return 'grid';
    if (id.includes('ring') || id.includes('prison') || id.includes('orbit') || id.includes('seal') || id.includes('o core') || id.includes('_o')) return 'ring';
    if (id.includes('circle') || id.includes('starfall') || id.includes('minefield') || id.includes('impact') || id.includes('meltdown')) return 'circle';
    if (id.includes('square') || id.includes('checkerboard') || id.includes('quadrant') || id.includes('box')) return 'square';
    if (id.includes('cone') || id.includes('fan')) return 'cone';
    if (id.includes('arc') || id.includes('crescent') || id.includes('rotating')) return 'arc';
    if (id.includes('dash') || id.includes('pursuit')) return 'dash';
    if (id.includes('hazard') || id.includes('passive') || id.includes('volatile') || id.includes('core field')) return 'hazard';
    if (id.includes('lane') || id.includes('beam') || id.includes('laser') || id.includes('slam') || id.includes('line') || id.includes('x strike') || id.includes('z collapse')) return 'lane';
    return 'projectile';
  }

  private getBossRushAbilitySoundScale(
    attackId?: string,
    telegraphType?: BossRushTelegraphType,
    requested: BossRushAbilitySoundScale = 'standard'
  ): BossRushAbilitySoundScale {
    if (requested !== 'standard') return requested;
    const id = `${attackId ?? ''} ${String(telegraphType ?? '')}`.toLowerCase();
    if (id.includes('supernova') || id.includes('event_horizon') || id.includes('event horizon') || id.includes('ultimate')) return 'ultimate';
    if (id.includes('gravity_grid') || id.includes('cross maze') || id.includes('corrupted cascade') || id.includes('falling axes') || id.includes('rapid crosshatch') || id.includes('hash lock')) return 'major';
    if (id.includes('suppressive') || id.includes('volley')) return 'light';
    if (id.includes('passive') || id.includes('hazard')) return 'passive';
    return 'standard';
  }

  private getBossRushAbilityScaleMultiplier(scale: BossRushAbilitySoundScale): number {
    return scale === 'ultimate' ? 1.65 : scale === 'major' ? 1.28 : scale === 'passive' ? 0.72 : scale === 'light' ? 0.62 : 1;
  }

  private getBossRushAbilityFamilyMultiplier(family: BossRushAbilitySoundFamily): number {
    return family === 'ultimate' ? 1.35 :
      family === 'gravity' ? 1.16 :
      family === 'cleave' ? 1.18 :
      family === 'grid' ? 0.9 :
      family === 'corrupt' ? 0.84 :
      family === 'hazard' ? 0.72 :
      family === 'projectile' ? 0.58 :
      1;
  }

  private getBossRushAbilityThrottleMs(
    family: BossRushAbilitySoundFamily,
    phase: BossRushAbilitySoundPhase,
    scale: BossRushAbilitySoundScale,
    spatialThrottleMul: number
  ): number {
    let base = phase === 'cast' ? 120 : phase === 'warning' ? 104 : phase === 'charge' ? 168 : phase === 'tail' ? 240 : 170;
    if (family === 'grid' || family === 'circle' || family === 'hazard') base += 110;
    if (family === 'gravity' || family === 'ultimate') base += phase === 'impact' ? 180 : 120;
    if (scale === 'major') base += phase === 'impact' ? 120 : 80;
    if (family === 'ultimate' || scale === 'ultimate') base += phase === 'impact' ? 680 : 360;
    if (scale === 'passive') base += 220;
    return Math.round(base * spatialThrottleMul);
  }

  private getBossRushAbilityToneShape(
    family: BossRushAbilitySoundFamily,
    phase: BossRushAbilitySoundPhase
  ) {
    const phasePitch = phase === 'cast' ? 1.18 : phase === 'warning' ? 1.32 : phase === 'charge' ? 1.52 : phase === 'impact' ? 0.78 : 0.55;
    const phaseDuration = phase === 'cast' ? 0.18 : phase === 'warning' ? 0.13 : phase === 'charge' ? 0.16 : phase === 'impact' ? 0.34 : 0.46;
    const phasePeak = phase === 'cast' ? 0.078 : phase === 'warning' ? 0.058 : phase === 'charge' ? 0.048 : phase === 'impact' ? 0.145 : 0.068;
    const familyPitch =
      family === 'corrupt' ? 1.42 :
      family === 'grid' ? 1.18 :
      family === 'circle' || family === 'square' ? 1.05 :
      family === 'ring' ? 0.92 :
      family === 'cone' || family === 'arc' ? 0.86 :
      family === 'cleave' ? 0.68 :
      family === 'gravity' ? 0.58 :
      family === 'ultimate' ? 0.52 :
      family === 'hazard' ? 0.82 :
      1;
    const noise =
      family === 'hazard' ? 1.2 :
      family === 'grid' ? 0.7 :
      family === 'cleave' ? 1.1 :
      family === 'corrupt' ? 0.78 :
      family === 'gravity' ? 0.62 :
      family === 'circle' || family === 'square' ? 0.9 :
      0.82;
    return { phasePitch, phaseDuration, phasePeak, familyPitch, noise };
  }

  private playBossRushAbilitySignature(
    bossKey: BossRushBossAudioKey = 'gatekeeper',
    attackId: string = 'unknown',
    phase: BossRushAbilitySoundPhase = 'cast',
    options?: AudioSpatialOptions,
    telegraphType?: BossRushTelegraphType,
    requestedScale: BossRushAbilitySoundScale = 'standard'
  ) {
    if (!this.enabled || this.muteGameSounds) return;
    this.resume();
    if (this.volume <= 0.001) return;
    if (!this.shouldPlaySound(options, true)) return;

    const spatial = this.getSpatialMix(options);
    const key = this.normalizeBossRushBossAudioKey(bossKey);
    const family = this.getBossRushAbilitySoundFamily(attackId, telegraphType);
    const scale = this.getBossRushAbilitySoundScale(attackId, telegraphType, requestedScale);
    const throttleKey = `boss-ability-${key}-${family}-${phase}-${scale}`;
    if (!this.throttle(throttleKey, this.getBossRushAbilityThrottleMs(family, phase, scale, spatial.throttleMul))) return;

    const profile = this.getBossRushAbilitySoundProfile(key);
    const shape = this.getBossRushAbilityToneShape(family, phase);
    const scaleMul = this.getBossRushAbilityScaleMultiplier(scale);
    const familyMul = this.getBossRushAbilityFamilyMultiplier(family);
    const bossGainBoost = this.bossRushLoudnessBoost * (scale === 'ultimate' ? 1.08 : scale === 'major' ? 1.01 : 0.99);
    const t = this.ctx.currentTime;
    const duration = shape.phaseDuration * (scale === 'ultimate' ? 1.55 : scale === 'major' ? 1.22 : 1) * this.jitter(1, 0.13);
    const baseFreq = Math.max(18, profile.base * shape.phasePitch * shape.familyPitch * this.chooseBossPitchFlavor(scale === 'ultimate'));
    const accentFreq = Math.max(24, profile.accent * shape.phasePitch * shape.familyPitch * this.jitter(1, 0.08));
    const subFreq = Math.max(12, profile.sub * (phase === 'impact' || scale === 'ultimate' ? 0.78 : 1.05));

    // Layer 1: instant input/cast confirmation or impact transient.
    {
      const click = this.createOscillatorVoice();
      const { gain } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
      click.type = family === 'corrupt' || family === 'gravity' ? 'sine' : 'square';
      click.frequency.setValueAtTime(accentFreq * (phase === 'impact' ? 1.2 : 1.55), t);
      click.frequency.exponentialRampToValueAtTime(Math.max(18, baseFreq * 0.72), t + Math.min(0.08, duration * 0.45));
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.05 * profile.bite * scaleMul * spatial.gainMul * bossGainBoost, t + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.001, t + Math.min(0.1, duration * 0.55));
      click.connect(gain);
      click.start(t);
      click.stop(t + Math.min(0.12, duration * 0.7));
    }

    // Layer 2: boss identity body tone.
    {
      const body = this.createOscillatorVoice();
      const accent = this.createOscillatorVoice();
      const { gain } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
      const filter = this.ctx.createBiquadFilter();
      filter.type = key === 'splitter' || key === 'grand_singularity' ? 'bandpass' : 'lowpass';
      body.type = phase === 'impact' && key === 'executioner' ? 'square' : profile.wave;
      accent.type = profile.accentWave;
      body.frequency.setValueAtTime(baseFreq * this.jitter(1, 0.06), t);
      body.frequency.exponentialRampToValueAtTime(Math.max(18, baseFreq * (phase === 'impact' ? 0.32 : 0.68)) * this.jitter(1, 0.05), t + duration);
      accent.frequency.setValueAtTime(accentFreq * this.jitter(1, 0.07), t + 0.01);
      accent.frequency.exponentialRampToValueAtTime(Math.max(22, accentFreq * (phase === 'charge' ? 1.24 : 0.46)) * this.jitter(1, 0.06), t + duration * 0.8);
      filter.frequency.setValueAtTime(profile.filter * (phase === 'impact' ? 0.88 : 1.22) * this.jitter(1, 0.12), t);
      filter.frequency.exponentialRampToValueAtTime(Math.max(70, profile.filter * (phase === 'impact' ? 0.16 : 0.42)) * this.jitter(1, 0.1), t + duration);
      filter.Q.setValueAtTime((family === 'corrupt' || family === 'gravity' ? 4.2 : family === 'grid' ? 3.2 : 1.7) * this.jitter(1, 0.16), t);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(shape.phasePeak * profile.weight * familyMul * scaleMul * spatial.gainMul * bossGainBoost, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      body.connect(filter);
      accent.connect(filter);
      filter.connect(gain);
      body.start(t);
      accent.start(t + 0.008);
      body.stop(t + duration + 0.03);
      accent.stop(t + duration * 0.84);
    }

    // Layer 3: sub slam / gravity weight.
    if (phase === 'impact' || scale === 'major' || scale === 'ultimate' || family === 'gravity' || family === 'cleave') {
      const sub = this.createOscillatorVoice();
      const { gain } = this.createPannedGain(spatial.panRange * 0.65, spatial.pan, spatial.lowpassHz);
      sub.type = 'sine';
      sub.frequency.setValueAtTime(subFreq * this.jitter(1, 0.04), t);
      sub.frequency.exponentialRampToValueAtTime(Math.max(10, subFreq * (family === 'gravity' ? 0.28 : 0.42)) * this.jitter(1, 0.05), t + duration * 0.75);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.075 * profile.weight * scaleMul * spatial.gainMul * bossGainBoost, t + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration * 0.92);
      sub.connect(gain);
      sub.start(t);
      sub.stop(t + duration + 0.04);
    }

    // Layer 4: colored noise for fire, steel, corruption, and cosmic texture.
    if (this.noiseBuffer && phase !== 'charge') {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const color = this.ctx.createBiquadFilter();
      color.type =
        family === 'corrupt' || family === 'gravity' ? 'highpass' :
        family === 'cleave' || profile.noiseColor === 'lowpass' ? 'lowpass' :
        profile.noiseColor;
      color.frequency.setValueAtTime(
        family === 'corrupt' ? 2600 :
        family === 'gravity' ? 1900 :
        family === 'cleave' ? 760 :
        family === 'hazard' ? 1180 :
        profile.filter * 1.35,
        t
      );
      color.Q.setValueAtTime(family === 'corrupt' ? 3.6 : family === 'grid' ? 2.4 : 1.2, t);
      const { gain } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.035 * shape.noise * scaleMul * spatial.gainMul * bossGainBoost, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration * (phase === 'impact' ? 0.78 : 0.55));
      src.connect(color);
      color.connect(gain);
      src.start(t);
      src.stop(t + duration * 0.82);
    }

    // Layer 5: boss-specific flourish so bosses are recognisable by ear.
    if (phase === 'cast' || phase === 'impact') {
      this.playBossRushAbilityFlourish(key, family, phase, t, spatial, scaleMul * bossGainBoost);
    }
  }

  private playBossRushAbilityFlourish(
    bossKey: 'gatekeeper' | 'splitter' | 'reactor' | 'executioner' | 'grand_singularity',
    family: BossRushAbilitySoundFamily,
    phase: BossRushAbilitySoundPhase,
    startAt: number,
    spatial: { gainMul: number; panRange: number; lowpassHz?: number; throttleMul: number; pan?: number },
    gainMul: number
  ) {
    const t = startAt + (phase === 'impact' ? 0.012 : 0.0);
    if (bossKey === 'gatekeeper') {
      // Vault locks: stepped metal ticks and sealed impact.
      [0, 0.032, 0.064].forEach((offset, i) => {
        const tick = this.createOscillatorVoice();
        const { gain } = this.createPannedGain(spatial.panRange * 0.7, spatial.pan, spatial.lowpassHz);
        tick.type = 'square';
        tick.frequency.setValueAtTime((170 + i * 62) * this.jitter(1, 0.05), t + offset);
        tick.frequency.exponentialRampToValueAtTime(82 + i * 18, t + offset + 0.045);
        gain.gain.setValueAtTime(0, t + offset);
        gain.gain.linearRampToValueAtTime(0.028 * spatial.gainMul * gainMul, t + offset + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.07);
        tick.connect(gain);
        tick.start(t + offset);
        tick.stop(t + offset + 0.08);
      });
      return;
    }

    if (bossKey === 'splitter') {
      // Stereo blade split: two quick mirror-slices.
      [-0.52, 0.52].forEach((pan, i) => {
        const blade = this.createOscillatorVoice();
        const { gain } = this.createPannedGain(0.1, pan, spatial.lowpassHz);
        blade.type = 'triangle';
        blade.frequency.setValueAtTime((720 + i * 180) * this.jitter(1, 0.08), t + i * 0.018);
        blade.frequency.exponentialRampToValueAtTime((260 + i * 50) * this.jitter(1, 0.06), t + 0.08 + i * 0.018);
        gain.gain.setValueAtTime(0, t + i * 0.018);
        gain.gain.linearRampToValueAtTime(0.04 * spatial.gainMul * gainMul, t + 0.008 + i * 0.018);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1 + i * 0.018);
        blade.connect(gain);
        blade.start(t + i * 0.018);
        blade.stop(t + 0.12 + i * 0.018);
      });
      return;
    }

    if (bossKey === 'reactor') {
      // Furnace pressure valve and molten afterburn.
      const valve = this.createOscillatorVoice();
      const { gain } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
      valve.type = 'sawtooth';
      valve.frequency.setValueAtTime((family === 'ultimate' ? 86 : 146) * this.jitter(1, 0.06), t);
      valve.frequency.exponentialRampToValueAtTime(42, t + 0.16);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.055 * spatial.gainMul * gainMul, t + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      valve.connect(gain);
      valve.start(t);
      valve.stop(t + 0.2);
      return;
    }

    if (bossKey === 'executioner') {
      // Guillotine draw: low bell + blade scrape.
      const bell = this.createOscillatorVoice();
      const scrape = this.createOscillatorVoice();
      const { gain } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(680, t);
      filter.frequency.exponentialRampToValueAtTime(120, t + 0.22);
      bell.type = 'sine';
      scrape.type = 'square';
      bell.frequency.setValueAtTime(74 * this.jitter(1, 0.04), t);
      bell.frequency.exponentialRampToValueAtTime(48, t + 0.22);
      scrape.frequency.setValueAtTime(210 * this.jitter(1, 0.08), t + 0.02);
      scrape.frequency.exponentialRampToValueAtTime(62, t + 0.14);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.05 * spatial.gainMul * gainMul, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      bell.connect(filter);
      scrape.connect(filter);
      filter.connect(gain);
      bell.start(t);
      scrape.start(t + 0.015);
      bell.stop(t + 0.24);
      scrape.stop(t + 0.16);
      return;
    }

    // Grand Singularity: reverse-feeling cosmic pressure bend.
    const voidTone = this.createOscillatorVoice();
    const halo = this.createOscillatorVoice();
    const { gain } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(560 * this.jitter(1, 0.08), t);
    bp.frequency.exponentialRampToValueAtTime(1180 * this.jitter(1, 0.1), t + 0.2);
    bp.Q.setValueAtTime(4.8, t);
    voidTone.type = 'sine';
    halo.type = 'triangle';
    voidTone.frequency.setValueAtTime(42 * this.jitter(1, 0.04), t);
    voidTone.frequency.exponentialRampToValueAtTime(18, t + 0.22);
    halo.frequency.setValueAtTime(330 * this.jitter(1, 0.08), t + 0.012);
    halo.frequency.exponentialRampToValueAtTime(620 * this.jitter(1, 0.08), t + 0.18);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.044 * spatial.gainMul * gainMul, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    voidTone.connect(bp);
    halo.connect(bp);
    bp.connect(gain);
    voidTone.start(t);
    halo.start(t + 0.012);
    voidTone.stop(t + 0.24);
    halo.stop(t + 0.2);
  }

  playBossRushAbilityCast(
    bossKey: BossRushBossAudioKey = 'gatekeeper',
    attackId: string = 'unknown',
    options?: AudioSpatialOptions,
    scale: BossRushAbilitySoundScale = 'standard'
  ) {
    this.playBossRushAbilitySignature(bossKey, attackId, 'cast', options, undefined, scale);
  }

  playBossRushAbilityWarning(
    bossKey: BossRushBossAudioKey = 'gatekeeper',
    attackId: string = 'unknown',
    telegraphType?: BossRushTelegraphType,
    options?: AudioSpatialOptions,
    scale: BossRushAbilitySoundScale = 'standard'
  ) {
    this.playBossRushAbilitySignature(bossKey, attackId, 'warning', options, telegraphType, scale);
  }

  playBossRushAbilityChargeTick(
    bossKey: BossRushBossAudioKey = 'gatekeeper',
    attackId: string = 'unknown',
    telegraphType?: BossRushTelegraphType,
    stage = 0,
    options?: AudioSpatialOptions,
    scale: BossRushAbilitySoundScale = 'standard'
  ) {
    const safeStage = Math.max(0, Math.min(4, Math.floor(stage)));
    this.playBossRushAbilitySignature(bossKey, `${attackId}-charge-${safeStage}`, 'charge', options, telegraphType, scale);
  }

  playBossRushAbilityImpact(
    bossKey: BossRushBossAudioKey = 'gatekeeper',
    attackId: string = 'unknown',
    telegraphType?: BossRushTelegraphType,
    options?: AudioSpatialOptions,
    scale: BossRushAbilitySoundScale = 'standard'
  ) {
    this.playBossRushAbilitySignature(bossKey, attackId, 'impact', options, telegraphType, scale);
  }

  playBossRushAbilityTail(
    bossKey: BossRushBossAudioKey = 'gatekeeper',
    attackId: string = 'unknown',
    options?: AudioSpatialOptions,
    scale: BossRushAbilitySoundScale = 'standard'
  ) {
    this.playBossRushAbilitySignature(bossKey, attackId, 'tail', options, undefined, scale);
  }

  playBossRushPassiveHazardCue(
    bossKey: BossRushBossAudioKey = 'reactor',
    phase: 'spawn' | 'charge' | 'impact' = 'spawn',
    options?: AudioSpatialOptions
  ) {
    const attackId = phase === 'impact' ? 'passive_hazard_impact' : phase === 'charge' ? 'passive_hazard_charge' : 'passive_hazard_spawn';
    this.playBossRushAbilitySignature(
      bossKey,
      attackId,
      phase === 'impact' ? 'impact' : phase === 'charge' ? 'charge' : 'warning',
      options,
      'red_circle_impact',
      'passive'
    );
  }

  playSandboxBossAbilityCast(
    bossKey: BossRushBossAudioKey = 'gatekeeper',
    attackId: string = 'unknown',
    options?: AudioSpatialOptions,
    scale: BossRushAbilitySoundScale = 'standard'
  ) {
    this.playBossRushAbilityCast(bossKey, attackId, options, scale);
  }

  playSandboxBossAbilityImpact(
    bossKey: BossRushBossAudioKey = 'gatekeeper',
    attackId: string = 'unknown',
    telegraphType?: BossRushTelegraphType,
    options?: AudioSpatialOptions,
    scale: BossRushAbilitySoundScale = 'standard'
  ) {
    this.playBossRushAbilityImpact(bossKey, attackId, telegraphType, options, scale);
  }

  playBossDroneLaunch(options?: AudioSpatialOptions, sourceClass?: TankClass) {
    if (!this.enabled || this.muteGameSounds) return;
    this.resume();
    if (this.volume <= 0.001) return;
    if (!this.shouldPlaySound(options, true)) return;
    const spatial = this.getSpatialMix(options);
    if (!this.throttle('boss-drone-launch', Math.round(120 * spatial.throttleMul))) return;
    const t = this.ctx.currentTime;
    const whirr = this.createOscillatorVoice();
    const { gain } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
    const isColossal = sourceClass === TankClass.COLOSSAL;
    const isLeviathan = sourceClass === TankClass.LEVIATHAN;
    const isCelestial = sourceClass === TankClass.CELESTIAL;
    whirr.type = isCelestial ? 'triangle' : 'square';
    const startFreq = isColossal ? 240 : isLeviathan ? 330 : isCelestial ? 360 : 300;
    const endFreq = isColossal ? 430 : isLeviathan ? 590 : isCelestial ? 680 : 510;
    whirr.frequency.setValueAtTime(startFreq + Math.random() * 45, t);
    whirr.frequency.linearRampToValueAtTime(endFreq + Math.random() * 70, t + 0.05);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.07 * spatial.gainMul, t + 0.007);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    whirr.connect(gain);
    whirr.start(t);
    whirr.stop(t + 0.09);
  }

  playHit(options?: AudioSpatialOptions) {
    if (!this.enabled || this.muteGameSounds) return;
    this.resume();
    if (this.volume <= 0.001) return;
    if (!this.shouldPlaySound(options, true)) return;

    const spatial = this.getSpatialMix(options);
    if (!this.throttle('hit', Math.round(70 * spatial.throttleMul))) return;

    const t = this.ctx.currentTime;
    const pitch = 0.7 + Math.random() * 0.5;

    const osc = this.createOscillatorVoice();
    const { gain } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140 * pitch, t);
    osc.frequency.linearRampToValueAtTime(60, t + 0.06);

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 800 * pitch;
    bp.Q.value = 5;

    const peak = 0.2 * this.jitter(1, 0.1) * spatial.gainMul;

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.002);
    gain.gain.linearRampToValueAtTime(0, t + 0.06);

    osc.connect(bp);
    bp.connect(gain);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  playExplosion(isLarge: boolean = false, options?: AudioSpatialOptions) {
    if (!this.enabled || this.muteGameSounds) return;
    this.resume();
    if (this.volume <= 0.001) return;
    if (!this.noiseBuffer) return;
    if (!this.shouldPlaySound(options, true)) return;

    const spatial = this.getSpatialMix(options);
    if (!this.throttle(isLarge ? 'explosion-large' : 'explosion-small', Math.round(200 * spatial.throttleMul))) return;

    const t = this.ctx.currentTime;
    const duration = (isLarge ? 1.4 : 0.6) * this.jitter(1, 0.1);
    const vol = (isLarge ? 0.7 : 0.4) * this.jitter(1, 0.1) * spatial.gainMul;

    // Main heavy noise body
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(isLarge ? 250 : 600, t);
    lp.frequency.exponentialRampToValueAtTime(15, t + duration);

    const { gain } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    src.connect(lp);
    lp.connect(gain);
    src.start(t);
    src.stop(t + duration + 0.2);

    // Debris layer (High-frequency scatter)
    const debris = this.ctx.createBufferSource();
    debris.buffer = this.noiseBuffer;
    const { gain: debrisG } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(2000, t);
    
    debrisG.gain.setValueAtTime(0, t);
    debrisG.gain.linearRampToValueAtTime(vol * 0.4, t + 0.05);
    debrisG.gain.exponentialRampToValueAtTime(0.001, t + (duration * 0.5));

    debris.connect(hp);
    hp.connect(debrisG);
    debris.start(t);
    debris.stop(t + duration);

    // Shockwave Rumble
    if (isLarge) {
      const rumble = this.createOscillatorVoice();
      const { gain: rumbleG } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
      rumble.type = 'sine';
      rumble.frequency.setValueAtTime(60, t);
      rumble.frequency.exponentialRampToValueAtTime(10, t + duration);

      rumbleG.gain.setValueAtTime(0, t);
      rumbleG.gain.linearRampToValueAtTime(0.4, t + 0.08);
      rumbleG.gain.exponentialRampToValueAtTime(0.001, t + duration);

      rumble.connect(rumbleG);
      rumble.start(t);
      rumble.stop(t + duration + 0.1);
    }
  }

  playLevelUp() {
    if (!this.enabled || this.muteGameSounds) return;
    this.resume();
    if (this.volume <= 0.001) return;
    if (!this.shouldPlaySound(undefined, true)) return;
    const t = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50];

    notes.forEach((freq, i) => {
      const osc = this.createOscillatorVoice();
      const { gain } = this.createPannedGain(0.2);
      const start = t + i * 0.06;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      const peak = 0.15 * this.jitter(1, 0.05);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(peak, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);

      osc.connect(gain);
      osc.start(start);
      osc.stop(start + 0.6);
    });
  }

  playUIHover() {
    if (!this.enabled) return;
    this.resume();
    if (this.volume <= 0.001) return;
    if (!this.throttle('ui-hover', 45)) return;

    const t = this.ctx.currentTime;
    const osc = this.createOscillatorVoice();
    const { gain } = this.createPannedGain(0.1);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1100, t);
    osc.frequency.exponentialRampToValueAtTime(1400, t + 0.03);
    gain.gain.setValueAtTime(0.02, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + 0.04);
  }

  playUIClick() {
    if (!this.enabled) return;
    this.resume();
    if (this.volume <= 0.001) return;
    const t = this.ctx.currentTime;
    const osc = this.createOscillatorVoice();
    const { gain } = this.createPannedGain(0.15);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(330, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.06);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  playUISelect() {
    if (!this.enabled) return;
    this.resume();
    if (this.volume <= 0.001) return;
    const t = this.ctx.currentTime;
    const oscA = this.createOscillatorVoice();
    const oscB = this.createOscillatorVoice();
    const { gain } = this.createPannedGain(0.12);
    oscA.type = 'triangle';
    oscB.type = 'sine';
    oscA.frequency.setValueAtTime(520 + Math.random() * 35, t);
    oscA.frequency.exponentialRampToValueAtTime(880 + Math.random() * 45, t + 0.06);
    oscB.frequency.setValueAtTime(390 + Math.random() * 20, t);
    oscB.frequency.exponentialRampToValueAtTime(640 + Math.random() * 30, t + 0.07);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.11, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    oscA.connect(gain);
    oscB.connect(gain);
    oscA.start(t);
    oscB.start(t);
    oscA.stop(t + 0.13);
    oscB.stop(t + 0.13);
  }

  playUIToggle(enabledState: boolean) {
    if (!this.enabled) return;
    this.resume();
    if (this.volume <= 0.001) return;
    const t = this.ctx.currentTime;
    const osc = this.createOscillatorVoice();
    const { gain } = this.createPannedGain(0.08);
    osc.type = enabledState ? 'triangle' : 'square';
    const start = enabledState ? 260 : 420;
    const end = enabledState ? 520 : 180;
    osc.frequency.setValueAtTime(start + Math.random() * 18, t);
    osc.frequency.exponentialRampToValueAtTime(end + Math.random() * 18, t + 0.08);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  playDialogueBlip(options?: AudioSpatialOptions, variant: 'default' | 'support' | 'sniper' | 'rusher' | 'boss' | 'boss_cinematic' | 'boss_gatekeeper' | 'boss_splitter' | 'boss_reactor' | 'boss_executioner' | 'boss_grand_singularity' = 'default') {
    if (!this.enabled || this.muteGameSounds) return;
    this.resume();
    if (this.volume <= 0.001) return;
    if (options && !options.onScreen) return;
    if (!this.throttle(`dialogue-blip-${variant}`, 28)) return;

    const t = this.ctx.currentTime;
    const osc = this.createOscillatorVoice();
    const overtone = this.createOscillatorVoice();
    const { gain } = this.createPannedGain(0.12, options?.pan);

    let startFreq = 760;
    let endFreq = 540;
    let peak = 0.06;
    let wave: OscillatorType = 'square';
    let jitterAmount = 0.035;
    let duration = 0.08;

    if (variant === 'support') {
      startFreq = 980;
      endFreq = 760;
      peak = 0.05;
      wave = 'triangle';
    } else if (variant === 'sniper') {
      startFreq = 1180;
      endFreq = 900;
      peak = 0.045;
      wave = 'sine';
    } else if (variant === 'rusher') {
      startFreq = 640;
      endFreq = 420;
      peak = 0.065;
      wave = 'square';
    } else if (variant === 'boss') {
      startFreq = 420;
      endFreq = 250;
      peak = 0.085;
      wave = 'sawtooth';
    } else if (variant === 'boss_cinematic') {
      startFreq = 310;
      endFreq = 176;
      peak = 0.1;
      wave = 'sawtooth';
      jitterAmount = 0.12;
      duration = 0.1;
    } else if (variant === 'boss_gatekeeper') {
      startFreq = 248;
      endFreq = 138;
      peak = 0.098;
      wave = 'square';
      jitterAmount = 0.13;
      duration = 0.102;
    } else if (variant === 'boss_splitter') {
      startFreq = 468;
      endFreq = 236;
      peak = 0.084;
      wave = 'triangle';
      jitterAmount = 0.16;
      duration = 0.088;
    } else if (variant === 'boss_reactor') {
      startFreq = 286;
      endFreq = 126;
      peak = 0.104;
      wave = 'sawtooth';
      jitterAmount = 0.14;
      duration = 0.1;
    } else if (variant === 'boss_executioner') {
      startFreq = 188;
      endFreq = 92;
      peak = 0.112;
      wave = 'square';
      jitterAmount = 0.11;
      duration = 0.11;
    } else if (variant === 'boss_grand_singularity') {
      startFreq = 352;
      endFreq = 118;
      peak = 0.108;
      wave = 'triangle';
      jitterAmount = 0.18;
      duration = 0.108;
    }
    if (variant.startsWith('boss_')) {
      peak *= 1.22;
      duration *= 1.06;
    }

    const phrasePitch = variant.startsWith('boss_')
      ? this.semitoneFactor(([-7, -3, 0, 4, 8])[Math.floor(Math.random() * 5)])
      : 1;
    osc.type = wave;
    overtone.type = variant === 'boss_gatekeeper' || variant === 'boss_executioner'
      ? 'square'
      : variant === 'boss_splitter'
        ? 'sine'
        : 'triangle';
    osc.frequency.setValueAtTime(startFreq * phrasePitch * this.jitter(1, jitterAmount), t);
    osc.frequency.exponentialRampToValueAtTime(endFreq * this.jitter(1, jitterAmount * 0.7), t + duration * 0.82);
    overtone.frequency.setValueAtTime(startFreq * (variant.startsWith('boss_') ? 1.96 : 1.5) * this.jitter(1, jitterAmount * 0.75), t + 0.003);
    overtone.frequency.exponentialRampToValueAtTime(endFreq * (variant.startsWith('boss_') ? 1.18 : 1.06) * this.jitter(1, jitterAmount * 0.55), t + duration * 0.72);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    if (variant.startsWith('boss_')) overtone.connect(gain);
    osc.start(t);
    overtone.start(t + 0.002);
    osc.stop(t + duration + 0.01);
    overtone.stop(t + duration * 0.78);
  }

  playNotification() {
    if (!this.enabled || this.muteGameSounds) return;
    this.resume();
    if (this.volume <= 0.001) return;
    if (!this.shouldPlaySound(undefined, true)) return;
    const t = this.ctx.currentTime;
    const osc1 = this.createOscillatorVoice();
    const osc2 = this.createOscillatorVoice();
    const { gain } = this.createPannedGain(0.1);
    
    osc1.frequency.setValueAtTime(880, t);
    osc2.frequency.setValueAtTime(1320, t);
    
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    
    osc1.connect(gain);
    osc2.connect(gain);
    osc1.start(t);
    osc1.stop(t + 0.2);
    osc2.start(t);
    osc2.stop(t + 0.2);
  }

  playShapeSpawn() {
    if (!this.enabled || this.muteGameSounds) return;
    this.resume();
    if (this.volume <= 0.001) return;
    if (!this.shouldPlaySound(undefined, true)) return;
    if (!this.throttle('shape-spawn', 150)) return;

    const t = this.ctx.currentTime;
    const osc = this.createOscillatorVoice();
    const { gain } = this.createPannedGain(0.6);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400 + Math.random() * 200, t);
    osc.frequency.exponentialRampToValueAtTime(800 + Math.random() * 400, t + 0.15);
    
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.05, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  playShapeDeath(rarity: string = 'COMMON') {
    if (!this.enabled || this.muteGameSounds) return;
    this.resume();
    if (this.volume <= 0.001) return;
    if (!this.shouldPlaySound(undefined, true)) return;
    if (!this.throttle('shape-death', 50)) return;

    const t = this.ctx.currentTime;
    const osc = this.createOscillatorVoice();
    const { gain } = this.createPannedGain(0.4);
    
    let baseFreq = 180;
    let duration = 0.15;
    let vol = 0.1;

    if (rarity !== 'COMMON') {
        baseFreq = 300;
        duration = 0.35;
        vol = 0.25;
    }

    osc.type = 'square';
    osc.frequency.setValueAtTime(baseFreq * this.jitter(1, 0.2), t);
    osc.frequency.exponentialRampToValueAtTime(40, t + duration);
    
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + duration);
  }

  playDeath() {
    if (!this.enabled || this.muteGameSounds) return;
    this.resume();
    if (this.volume <= 0.001) return;
    if (!this.shouldPlaySound(undefined, true)) return;
    const t = this.ctx.currentTime;
    
    // Low rumble
    const osc1 = this.createOscillatorVoice();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(80, t);
    osc1.frequency.exponentialRampToValueAtTime(20, t + 1.5);
    
    // Screeching fall
    const osc2 = this.createOscillatorVoice();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(440, t);
    osc2.frequency.exponentialRampToValueAtTime(40, t + 1.0);

    const { gain } = this.createPannedGain(0.1);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.4, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 2.0);
    
    osc1.connect(gain);
    osc2.connect(gain);
    osc1.start(t);
    osc1.stop(t + 2.0);
    osc2.start(t);
    osc2.stop(t + 2.0);
  }

  playAchievement() {
    if (!this.enabled) return;
    this.resume();
    if (this.volume <= 0.001) return;
    if (!this.shouldPlaySound(undefined, false)) return;
    const t = this.ctx.currentTime;
    const notes = [587.33, 739.99, 880.00, 1174.66]; // D Major Arpeggio

    notes.forEach((f, i) => {
      const o = this.createOscillatorVoice();
      const { gain } = this.createPannedGain(0.2);
      const s = t + i * 0.12;
      o.type = 'sine';
      o.frequency.setValueAtTime(f, s);
      gain.gain.setTargetAtTime(0.15, s, 0.01);
      gain.gain.setTargetAtTime(0.001, s + 0.2, 0.1);
      o.connect(gain);
      o.start(s);
      o.stop(s + 1.0);
    });
  }

  playShieldHit() {
    if (!this.enabled || this.muteGameSounds) return;
    this.resume();
    if (this.volume <= 0.001) return;
    if (!this.shouldPlaySound(undefined, true)) return;
    if (!this.throttle('shield-hit', 80)) return;
    const t = this.ctx.currentTime;
    const osc = this.createOscillatorVoice();
    const { gain } = this.createPannedGain(0.2);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.05);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  playStatUpgrade() {
    if (!this.enabled) return;
    this.resume();
    if (this.volume <= 0.001) return;
    if (!this.shouldPlaySound(undefined, false)) return;
    const t = this.ctx.currentTime;
    [1046.50, 1318.51].forEach((f, i) => {
      const o = this.createOscillatorVoice();
      const { gain } = this.createPannedGain(0.15);
      const s = t + i * 0.04;
      o.type = 'sine';
      o.frequency.setValueAtTime(f, s);
      gain.gain.setValueAtTime(0, s);
      gain.gain.linearRampToValueAtTime(0.1, s + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, s + 0.15);
      o.connect(gain);
      o.start(s);
      o.stop(s + 0.2);
    });
  }

  playClassUpgrade() {
    if (!this.enabled) return;
    this.resume();
    if (this.volume <= 0.001) return;
    if (!this.shouldPlaySound(undefined, false)) return;
    const t = this.ctx.currentTime;
    const notes = [440, 554.37, 659.25];
    notes.forEach((f) => {
      const o = this.createOscillatorVoice();
      const { gain } = this.createPannedGain(0.2);
      o.type = 'triangle';
      o.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      o.connect(gain);
      o.start(t);
      o.stop(t + 0.8);
    });
  }

  private createNoiseBuffer() {
    const bufferSize = this.ctx.sampleRate * 2.5;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }
}
