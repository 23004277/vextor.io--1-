
import { TankClass } from '../types';

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

export class SoundEngine {
  ctx: AudioContext;
  masterGain: GainNode;
  noiseBuffer: AudioBuffer | null = null;
  volume: number = 0.15;
  muteGameSounds: boolean = false;
  private enabled: boolean = false;

  // Throttle tracking to prevent audio clipping during high fire rates
  private lastPlayed: Record<string, number> = {};
  private rapidFireState: Record<string, { lastAt: number; streak: number }> = {};

  constructor() {
    const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    this.ctx = new AudioContextClass();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volume;

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
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  // Small helper: random factor around 1.0
  private jitter(center = 1, amount = 0.1) {
    return center * (1 - amount + Math.random() * amount * 2);
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
        const osc = this.ctx.createOscillator();
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
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
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
      const pinOsc = this.ctx.createOscillator();
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
      const rotor = this.ctx.createOscillator();
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
      const bodyOsc = this.ctx.createOscillator();
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
      const sub = this.ctx.createOscillator();
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
      const servo = this.ctx.createOscillator();
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
      const coreHum = this.ctx.createOscillator();
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
      const tracker = this.ctx.createOscillator();
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

      const staticHum = this.ctx.createOscillator();
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
      const chirp = this.ctx.createOscillator();
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
      const crack = this.ctx.createOscillator();
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
      const sig = this.ctx.createOscillator();
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
      const crack = this.ctx.createOscillator();
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
    const osc = this.ctx.createOscillator();
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
    const osc = this.ctx.createOscillator();
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
    this.playExplosion(true, options);
    const t = this.ctx.currentTime;
    const sub = this.ctx.createOscillator();
    const { gain } = this.createPannedGain(spatial.panRange, spatial.pan, spatial.lowpassHz);
    sub.type = 'sine';
    sub.frequency.setValueAtTime(58, t);
    sub.frequency.exponentialRampToValueAtTime(18, t + 0.25);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.24 * spatial.gainMul, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    sub.connect(gain);
    sub.start(t);
    sub.stop(t + 0.3);
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
    const ring = this.ctx.createOscillator();
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

  playBossDroneLaunch(options?: AudioSpatialOptions, sourceClass?: TankClass) {
    if (!this.enabled || this.muteGameSounds) return;
    this.resume();
    if (this.volume <= 0.001) return;
    if (!this.shouldPlaySound(options, true)) return;
    const spatial = this.getSpatialMix(options);
    if (!this.throttle('boss-drone-launch', Math.round(120 * spatial.throttleMul))) return;
    const t = this.ctx.currentTime;
    const whirr = this.ctx.createOscillator();
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

    const osc = this.ctx.createOscillator();
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
      const rumble = this.ctx.createOscillator();
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
      const osc = this.ctx.createOscillator();
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
    const osc = this.ctx.createOscillator();
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
    const osc = this.ctx.createOscillator();
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

  playNotification() {
    if (!this.enabled || this.muteGameSounds) return;
    this.resume();
    if (this.volume <= 0.001) return;
    if (!this.shouldPlaySound(undefined, true)) return;
    const t = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
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
    const osc = this.ctx.createOscillator();
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
    const osc = this.ctx.createOscillator();
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
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(80, t);
    osc1.frequency.exponentialRampToValueAtTime(20, t + 1.5);
    
    // Screeching fall
    const osc2 = this.ctx.createOscillator();
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
      const o = this.ctx.createOscillator();
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
    const osc = this.ctx.createOscillator();
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
      const o = this.ctx.createOscillator();
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
      const o = this.ctx.createOscillator();
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
