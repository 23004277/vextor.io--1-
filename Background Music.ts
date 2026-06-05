export type BackgroundMusicState = 'stopped' | 'playing' | 'paused';

type MusicSection =
  | 'intro'
  | 'groove'
  | 'buildUpOne'
  | 'dropOne'
  | 'breakdown'
  | 'buildUpTwo'
  | 'dropTwo'
  | 'outro';

type ArrangementEntry = {
  section: MusicSection;
  bars: number;
};

type OscType = OscillatorType;

const DEFAULT_BPM = 128;
const STEPS_PER_BAR = 16;
const BEATS_PER_BAR = 4;
const LOOKAHEAD_MS = 20;
const SCHEDULE_AHEAD_SECONDS = 0.22;
const MASTER_GAIN_AT_FULL = 0.54;
const MIN_GAIN = 0.0001;

const ARRANGEMENT: ArrangementEntry[] = [
  { section: 'intro', bars: 8 },
  { section: 'groove', bars: 8 },
  { section: 'buildUpOne', bars: 16 },
  { section: 'dropOne', bars: 24 },
  { section: 'breakdown', bars: 8 },
  { section: 'buildUpTwo', bars: 16 },
  { section: 'dropTwo', bars: 32 },
  { section: 'outro', bars: 8 },
];

const ROOTS = [46.25, 55.0, 61.735, 41.2]; // F# minor-ish / A / B / E movement.
const MINOR = [0, 3, 7, 10];
const MINOR_EXT = [0, 2, 3, 5, 7, 10, 12];
const CHORDS = [
  [0, 3, 7, 10],
  [0, 3, 7, 12],
  [0, 5, 7, 10],
  [0, 3, 8, 12],
];

const HOOK_A = [0, 2, 3, 5, 3, 2, 0, 2, 5, 3, 2, 0, 3, 2, 5, 2];
const HOOK_B = [7, 5, 3, 2, 3, 5, 7, 10, 7, 5, 3, 2, 5, 3, 2, 0];
const ARP = [0, 2, 4, 2, 5, 4, 2, 0, 0, 3, 4, 3, 6, 4, 3, 0];
const BASS_GROOVE = [0, -1, 0, 0, 3, -1, 0, -1, 5, -1, 3, -1, 0, 0, 7, -1];
const BASS_DROP_A = [0, 0, -1, 0, 3, -1, 0, -1, 5, 5, -1, 3, 0, -1, 7, -1];
const BASS_DROP_B = [0, -1, 0, 0, 7, -1, 5, -1, 3, -1, 5, 3, 0, 0, 10, -1];
const HAT_CLOSED = [1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0];
const HAT_BUSY = [1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1];
const PERC_PATTERN = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0];

export class BackgroundMusic {
  private audioContext: AudioContext | null = null;

  private masterGain: GainNode | null = null;
  private preMaster: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private bassBus: GainNode | null = null;
  private drumBus: GainNode | null = null;
  private fxBus: GainNode | null = null;
  private sendBus: GainNode | null = null;
  private delayBus: GainNode | null = null;
  private reverbBus: GainNode | null = null;

  private sidechainGain: GainNode | null = null;
  private toneFilter: BiquadFilterNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private delay: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;
  private delayFilter: BiquadFilterNode | null = null;
  private convolver: ConvolverNode | null = null;

  private noiseBuffer: AudioBuffer | null = null;
  private impulseBuffer: AudioBuffer | null = null;

  private state: BackgroundMusicState = 'stopped';
  private bpm = DEFAULT_BPM;
  private volume = 1;
  private schedulerId: number | null = null;
  private suspendTimeoutId: number | null = null;
  private currentStep = 0;
  private currentBar = 0;
  private arrangementIndex = 0;
  private barInSection = 0;
  private nextStepTime = 0;
  private startedAt = 0;

  init(): void {
    if (this.audioContext) return;

    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioContextCtor();

    const ctx = this.audioContext;

    this.masterGain = ctx.createGain();
    this.preMaster = ctx.createGain();
    this.musicBus = ctx.createGain();
    this.bassBus = ctx.createGain();
    this.drumBus = ctx.createGain();
    this.fxBus = ctx.createGain();
    this.sendBus = ctx.createGain();
    this.delayBus = ctx.createGain();
    this.reverbBus = ctx.createGain();
    this.sidechainGain = ctx.createGain();
    this.toneFilter = ctx.createBiquadFilter();
    this.compressor = ctx.createDynamicsCompressor();
    this.limiter = ctx.createDynamicsCompressor();
    this.delay = ctx.createDelay(1.2);
    this.delayFeedback = ctx.createGain();
    this.delayFilter = ctx.createBiquadFilter();
    this.convolver = ctx.createConvolver();

    this.noiseBuffer = this.createNoiseBuffer(3);
    this.impulseBuffer = this.createImpulseBuffer(1.8, 2.6);
    this.convolver.buffer = this.impulseBuffer;

    this.masterGain.gain.value = this.volume * MASTER_GAIN_AT_FULL;
    this.preMaster.gain.value = 0.95;
    this.musicBus.gain.value = 0.92;
    this.bassBus.gain.value = 0.82;
    this.drumBus.gain.value = 0.95;
    this.fxBus.gain.value = 0.68;
    this.sendBus.gain.value = 0.24;
    this.delayBus.gain.value = 0.16;
    this.reverbBus.gain.value = 0.12;
    this.sidechainGain.gain.value = 1;

    this.toneFilter.type = 'lowpass';
    this.toneFilter.frequency.value = 16000;
    this.toneFilter.Q.value = 0.25;

    this.delay.delayTime.value = this.secondsPerBeat() * 0.375;
    this.delayFeedback.gain.value = 0.24;
    this.delayFilter.type = 'lowpass';
    this.delayFilter.frequency.value = 4200;

    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 18;
    this.compressor.ratio.value = 3.5;
    this.compressor.attack.value = 0.004;
    this.compressor.release.value = 0.16;

    this.limiter.threshold.value = -3;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 12;
    this.limiter.attack.value = 0.002;
    this.limiter.release.value = 0.08;

    this.musicBus.connect(this.sidechainGain);
    this.bassBus.connect(this.sidechainGain);
    this.sidechainGain.connect(this.toneFilter);
    this.toneFilter.connect(this.preMaster);

    this.drumBus.connect(this.preMaster);
    this.fxBus.connect(this.preMaster);

    this.musicBus.connect(this.sendBus);
    this.fxBus.connect(this.sendBus);
    this.sendBus.connect(this.delayBus);
    this.sendBus.connect(this.reverbBus);

    this.delayBus.connect(this.delay);
    this.delay.connect(this.delayFilter);
    this.delayFilter.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delay);
    this.delayFilter.connect(this.preMaster);

    this.reverbBus.connect(this.convolver);
    this.convolver.connect(this.preMaster);

    this.preMaster.connect(this.compressor);
    this.compressor.connect(this.masterGain);
    this.masterGain.connect(this.limiter);
    this.limiter.connect(ctx.destination);

    this.state = 'paused';
  }

  async start(): Promise<void> {
    this.init();
    if (!this.audioContext) return;
    this.clearSuspendTimeout();

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    if (this.state === 'playing') return;

    this.restoreOutputGain();

    this.resetTransport(this.audioContext.currentTime + 0.08);
    this.startScheduler();
    this.state = 'playing';
  }

  pause(): void {
    if (!this.audioContext || !this.masterGain) return;
    this.stopScheduler();
    this.clearSuspendTimeout();
    const now = this.audioContext.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(Math.max(MIN_GAIN, this.masterGain.gain.value), now);
    this.masterGain.gain.exponentialRampToValueAtTime(MIN_GAIN, now + 0.12);
    this.state = 'paused';
    this.suspendTimeoutId = window.setTimeout(() => {
      if (!this.audioContext || this.state !== 'paused') return;
      if (this.audioContext.state === 'running') {
        this.audioContext.suspend().catch(() => undefined);
      }
    }, 160);
  }

  async resume(): Promise<void> {
    if (!this.audioContext) {
      await this.start();
      return;
    }

    this.clearSuspendTimeout();

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    if (this.state === 'playing') return;

    this.restoreOutputGain();
    this.nextStepTime = Math.max(this.audioContext.currentTime + 0.05, this.nextStepTime || 0);
    this.startScheduler();
    this.state = 'playing';
  }

  stop(): void {
    this.stopScheduler();
    this.clearSuspendTimeout();
    this.state = 'stopped';

    if (this.audioContext) {
      this.audioContext.close().catch(() => undefined);
    }

    this.audioContext = null;
    this.masterGain = null;
    this.preMaster = null;
    this.musicBus = null;
    this.bassBus = null;
    this.drumBus = null;
    this.fxBus = null;
    this.sendBus = null;
    this.delayBus = null;
    this.reverbBus = null;
    this.sidechainGain = null;
    this.toneFilter = null;
    this.compressor = null;
    this.limiter = null;
    this.delay = null;
    this.delayFeedback = null;
    this.delayFilter = null;
    this.convolver = null;
    this.noiseBuffer = null;
    this.impulseBuffer = null;
  }

  setVolume(volume: number): void {
    this.volume = this.clamp(volume, 0, 1);
    if (!this.masterGain || !this.audioContext) return;
    this.masterGain.gain.setTargetAtTime(this.volume * MASTER_GAIN_AT_FULL, this.audioContext.currentTime, 0.04);
  }

  setBpm(nextBpm: number): void {
    this.bpm = this.clamp(nextBpm, 110, 150);
    if (this.delay && this.audioContext) {
      this.delay.delayTime.setTargetAtTime(this.secondsPerBeat() * 0.375, this.audioContext.currentTime, 0.05);
    }
  }

  getBpm(): number {
    return this.bpm;
  }

  getState(): BackgroundMusicState {
    return this.state;
  }

  private startScheduler(): void {
    if (this.schedulerId != null) return;
    this.schedulerId = window.setInterval(() => this.schedulerTick(), LOOKAHEAD_MS);
  }

  private stopScheduler(): void {
    if (this.schedulerId != null) {
      window.clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
  }

  private clearSuspendTimeout(): void {
    if (this.suspendTimeoutId != null) {
      window.clearTimeout(this.suspendTimeoutId);
      this.suspendTimeoutId = null;
    }
  }

  private restoreOutputGain(): void {
    if (!this.masterGain || !this.audioContext) return;
    const now = this.audioContext.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(Math.max(MIN_GAIN, this.masterGain.gain.value), now);
    this.masterGain.gain.exponentialRampToValueAtTime(Math.max(MIN_GAIN, this.volume * MASTER_GAIN_AT_FULL), now + 0.08);
  }

  private resetTransport(startTime: number): void {
    this.currentStep = 0;
    this.currentBar = 0;
    this.arrangementIndex = 0;
    this.barInSection = 0;
    this.nextStepTime = startTime;
    this.startedAt = startTime;
  }

  private schedulerTick(): void {
    if (!this.audioContext || this.state !== 'playing') return;

    while (this.nextStepTime < this.audioContext.currentTime + SCHEDULE_AHEAD_SECONDS) {
      this.scheduleCurrentStep(this.nextStepTime);
      this.advanceTransport();
    }
  }

  private scheduleCurrentStep(time: number): void {
    const entry = ARRANGEMENT[this.arrangementIndex];
    if (!entry) return;

    const progress = entry.bars <= 1 ? 1 : this.barInSection / Math.max(1, entry.bars - 1);
    const phraseBar = this.currentBar % 8;
    const chordBar = this.currentBar % ROOTS.length;
    const root = ROOTS[chordBar];

    this.automateSectionTone(entry.section, progress, time);
    this.playSection(entry.section, root, this.currentStep, progress, phraseBar, time);
  }

  private advanceTransport(): void {
    this.currentStep += 1;
    this.nextStepTime += this.secondsPerStep();

    if (this.currentStep < STEPS_PER_BAR) return;

    this.currentStep = 0;
    this.currentBar += 1;
    this.barInSection += 1;

    const entry = ARRANGEMENT[this.arrangementIndex];
    if (entry && this.barInSection >= entry.bars) {
      this.arrangementIndex += 1;
      this.barInSection = 0;
    }

    if (this.arrangementIndex >= ARRANGEMENT.length) {
      this.arrangementIndex = 0;
      this.currentBar = 0;
      this.barInSection = 0;
    }
  }

  private playSection(section: MusicSection, root: number, step: number, progress: number, phraseBar: number, time: number): void {
    const beat = step % STEPS_PER_BAR;
    const barStart = step === 0;
    const halfBar = step === 8;
    const lastBarEnergy = progress > 0.92;

    if (barStart || halfBar) {
      this.playWarmPad(root, time, section, progress, halfBar);
    }

    if (section === 'intro') {
      if (barStart) this.playNoiseSweep(time, this.secondsPerBar() * 0.9, 0.035, 7200, 900);
      if (step % 4 === 0) this.playBellPluck(root, step + phraseBar, time, 0.06, 0.55);
      if (step === 12 && phraseBar % 2 === 1) this.playReverseCymbal(time, this.secondsPerStep() * 4, 0.035);
      return;
    }

    if (section === 'groove') {
      this.playKickPattern(step, time, 0.72, false);
      this.playClapPattern(step, time, 0.12);
      this.playHatPattern(step, time, 0.04, false);
      if (step % 2 === 0) this.playArp(root, step + phraseBar, time, 0.06, 1600 + phraseBar * 120);
      if (BASS_GROOVE[step] >= 0) this.playSubBass(root, BASS_GROOVE[step], time, 0.12, 0.22);
      if (step === 15 && phraseBar % 4 === 3) this.playSnareFill(time, 0.08);
      return;
    }

    if (section === 'buildUpOne' || section === 'buildUpTwo') {
      const stronger = section === 'buildUpTwo';
      this.playBuildUp(root, step, progress, phraseBar, time, stronger);
      return;
    }

    if (section === 'dropOne') {
      this.playDrop(root, step, progress, phraseBar, time, false);
      return;
    }

    if (section === 'breakdown') {
      if (barStart) this.playDownlifter(time, this.secondsPerBar() * 0.75, 0.08);
      if (step % 4 === 0) this.playBellPluck(root, step + phraseBar, time, 0.07, 0.72);
      if (step === 4 || step === 12) this.playVocalChop(root, step, time, 0.055);
      if (step % 8 === 6) this.playAirPerc(time, 0.035, 3600 + phraseBar * 200);
      return;
    }

    if (section === 'dropTwo') {
      this.playDrop(root, step, progress, phraseBar, time, true);
      return;
    }

    if (section === 'outro') {
      const fade = 1 - progress * 0.65;
      if (beat === 0 || beat === 8) this.playKick(time, 0.48 * fade);
      if (beat === 4 || beat === 12) this.playClap(time, 0.08 * fade);
      if (step % 4 === 0) this.playBellPluck(root, step + phraseBar, time, 0.05 * fade, 0.6);
      if (barStart) this.playNoiseSweep(time, this.secondsPerBar() * 0.9, 0.025 * fade, 2800, 500);
      if (lastBarEnergy && step === 12) this.fadeMaster(time, this.secondsPerStep() * 4);
    }
  }

  private playBuildUp(root: number, step: number, progress: number, phraseBar: number, time: number, stronger: boolean): void {
    const barStart = step === 0;
    const beat = step % STEPS_PER_BAR;
    const tension = stronger ? 1.18 : 1;

    if (barStart) {
      this.playRiser(time, this.secondsPerBar() * 0.98, 0.08 * tension, stronger ? 3200 : 2200);
      if (progress < 0.1) this.playImpact(time, 0.08 * tension);
    }

    if (beat === 0 || beat === 8) this.playBuildChord(root, time, progress, stronger);
    if (step % 2 === 0) this.playArp(root * 2, step + phraseBar, time, 0.045 + progress * 0.055, 1400 + progress * 5200);
    if (step % 4 === 0 && progress > 0.25) this.playVocalChop(root, step + phraseBar, time, (0.035 + progress * 0.05) * tension);
    if (step % 8 === 4 && progress > 0.45) this.playPitchLaser(root, time, 0.04 + progress * 0.04, stronger);

    this.playSnareRoll(step, progress, time, stronger);

    if (progress > 0.52 && beat % 2 === 1) this.playHat(time, 0.035 + progress * 0.04, 8200 + progress * 4200, 0.035);
    if (progress > 0.78 && step % 2 === 0) this.playAirPerc(time, 0.028 + progress * 0.028, 5200 + progress * 3200);

    if (progress > 0.88 && step >= 12) {
      this.sidechainPump(time, stronger ? 0.22 : 0.28, 0.16);
      if (step === 12) this.playReverseCymbal(time, this.secondsPerStep() * 4, stronger ? 0.11 : 0.08);
    }

    if (progress > 0.95 && step === 15) {
      this.playPreDropStop(time, stronger);
    }
  }

  private playDrop(root: number, step: number, progress: number, phraseBar: number, time: number, bigger: boolean): void {
    const beat = step % STEPS_PER_BAR;
    const secondHalf = progress > 0.48;
    const finalQuarter = progress > 0.72;
    const variation = (this.currentBar + phraseBar) % 8;
    const bassPattern = bigger ? BASS_DROP_B : BASS_DROP_A;
    const hook = bigger ? HOOK_B : HOOK_A;
    const punch = bigger ? 1.08 : 0.92;

    this.playKickPattern(step, time, punch, true);
    this.playClapPattern(step, time, bigger ? 0.2 : 0.16);
    this.playHatPattern(step, time, bigger ? 0.08 : 0.062, bigger || finalQuarter);

    if (PERC_PATTERN[step] && (bigger || secondHalf)) {
      this.playPerc(time, bigger ? 0.055 : 0.042, step % 4 === 0 ? 680 : 920);
    }

    const bassNote = bassPattern[step];
    if (bassNote >= 0) {
      if (bigger) {
        this.playGrowlBass(root, bassNote, time, 0.23 + (finalQuarter ? 0.05 : 0), variation);
      } else {
        this.playElectroBass(root, bassNote, time, 0.2 + (secondHalf ? 0.03 : 0), variation);
      }
    }

    if (step % 2 === 0 || (bigger && step % 2 === 1 && finalQuarter)) {
      this.playSupersawLead(root, hook[step % hook.length], time, bigger ? 0.105 : 0.083, bigger, step);
    }

    if ((step === 6 || step === 14) && secondHalf) {
      this.playAnswerLead(root, hook[(step + 5) % hook.length], time, bigger ? 0.07 : 0.052, bigger);
    }

    if (step % 4 === 2 && (bigger || finalQuarter)) {
      this.playLaserZap(root, time, 0.032 + (bigger ? 0.02 : 0), step);
    }

    if (beat === 0 || beat === 4 || beat === 8 || beat === 12) {
      this.sidechainPump(time, bigger ? 0.12 : 0.18, bigger ? 0.24 : 0.22);
    }

    if (step === 0 && this.barInSection % 8 === 0) {
      this.playCrash(time, bigger ? 0.18 : 0.13);
      this.playImpact(time, bigger ? 0.14 : 0.1);
    }

    if (step === 12 && this.barInSection % 8 === 7) {
      this.playDropFill(time, bigger);
    }
  }

  private playKickPattern(step: number, time: number, amp: number, fourOnFloor: boolean): void {
    const beat = step % STEPS_PER_BAR;
    if (beat === 0 || beat === 4 || beat === 8 || beat === 12) {
      this.playKick(time, amp);
      return;
    }

    if (fourOnFloor) return;
    if (beat === 14) this.playKick(time, amp * 0.45);
  }

  private playClapPattern(step: number, time: number, amp: number): void {
    const beat = step % STEPS_PER_BAR;
    if (beat === 4 || beat === 12) {
      this.playClap(time, amp);
      this.playSnareLayer(time, amp * 0.62);
    }
  }

  private playHatPattern(step: number, time: number, amp: number, busy: boolean): void {
    const pattern = busy ? HAT_BUSY : HAT_CLOSED;
    if (pattern[step]) this.playHat(time, amp * (step % 2 === 0 ? 0.86 : 1), step % 2 === 0 ? 7600 : 10200, busy ? 0.045 : 0.036);
    if ((step === 2 || step === 10) && busy) this.playOpenHat(time, amp * 0.82);
  }

  private playWarmPad(root: number, time: number, section: MusicSection, progress: number, isHalfBar: boolean): void {
    if (!this.audioContext || !this.musicBus) return;

    const ctx = this.audioContext;
    const chord = CHORDS[this.currentBar % CHORDS.length];
    const duration = this.secondsPerStep() * (isHalfBar ? 7.7 : 8.2);
    const drop = section === 'dropOne' || section === 'dropTwo';
    const build = section === 'buildUpOne' || section === 'buildUpTwo';
    const amp = drop ? 0.035 : build ? 0.045 + progress * 0.02 : 0.052;
    const cutoff = drop ? 1900 : build ? 900 + progress * 2800 : 1350;

    chord.forEach((semitone, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      const pan = ctx.createStereoPanner();

      osc.type = i % 2 === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(root * this.ratio(semitone + (i >= 2 ? 12 : 0)), time);
      osc.detune.setValueAtTime((i - 1.5) * 7, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(cutoff, time);
      filter.Q.setValueAtTime(0.45, time);

      pan.pan.setValueAtTime((i - 1.5) * 0.23, time);
      gain.gain.setValueAtTime(MIN_GAIN, time);
      gain.gain.linearRampToValueAtTime(amp / chord.length, time + 0.12);
      gain.gain.linearRampToValueAtTime((amp / chord.length) * 0.78, time + duration * 0.65);
      gain.gain.exponentialRampToValueAtTime(MIN_GAIN, time + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(pan);
      pan.connect(this.musicBus!);
      osc.start(time);
      osc.stop(time + duration + 0.05);
    });
  }

  private playBuildChord(root: number, time: number, progress: number, stronger: boolean): void {
    if (!this.audioContext || !this.musicBus) return;

    const ctx = this.audioContext;
    const duration = this.secondsPerStep() * 6.5;
    const chord = CHORDS[this.currentBar % CHORDS.length];

    chord.forEach((semitone, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      const pan = ctx.createStereoPanner();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(root * this.ratio(semitone + (index > 1 ? 12 : 0)), time);
      osc.detune.setValueAtTime((index - 1.5) * (stronger ? 10 : 7), time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(500 + progress * (stronger ? 5200 : 3600), time);
      filter.Q.setValueAtTime(0.8 + progress * 2.1, time);

      pan.pan.setValueAtTime((index - 1.5) * 0.18, time);
      gain.gain.setValueAtTime(MIN_GAIN, time);
      gain.gain.linearRampToValueAtTime((stronger ? 0.082 : 0.058) / chord.length, time + 0.025);
      gain.gain.exponentialRampToValueAtTime(MIN_GAIN, time + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(pan);
      pan.connect(this.musicBus!);
      osc.start(time);
      osc.stop(time + duration + 0.04);
    });
  }

  private playBellPluck(root: number, step: number, time: number, amp: number, release: number): void {
    if (!this.audioContext || !this.musicBus) return;

    const ctx = this.audioContext;
    const note = root * 2 * this.ratio(MINOR_EXT[ARP[step % ARP.length] % 12]);
    const carrier = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const pan = ctx.createStereoPanner();

    carrier.type = 'sine';
    mod.type = 'sine';
    carrier.frequency.setValueAtTime(note, time);
    mod.frequency.setValueAtTime(note * 2.01, time);
    modGain.gain.setValueAtTime(note * 0.45, time);
    modGain.gain.exponentialRampToValueAtTime(1, time + release * 0.45);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1800 + (step % 4) * 260, time);
    filter.Q.setValueAtTime(2.4, time);

    pan.pan.setValueAtTime(((step % 8) - 3.5) * 0.08, time);
    gain.gain.setValueAtTime(MIN_GAIN, time);
    gain.gain.linearRampToValueAtTime(amp, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(MIN_GAIN, time + release);

    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(filter);
    filter.connect(gain);
    gain.connect(pan);
    pan.connect(this.musicBus);
    carrier.start(time);
    mod.start(time);
    carrier.stop(time + release + 0.04);
    mod.stop(time + release + 0.04);
  }

  private playArp(root: number, step: number, time: number, amp: number, cutoff: number): void {
    if (!this.audioContext || !this.musicBus) return;

    const ctx = this.audioContext;
    const note = root * 2 * this.ratio(MINOR_EXT[ARP[step % ARP.length]]);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const pan = ctx.createStereoPanner();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(note, time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, time);
    filter.Q.setValueAtTime(1.2, time);
    pan.pan.setValueAtTime(((step % 6) - 2.5) * 0.09, time);

    gain.gain.setValueAtTime(MIN_GAIN, time);
    gain.gain.linearRampToValueAtTime(amp, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(MIN_GAIN, time + this.secondsPerStep() * 1.5);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(pan);
    pan.connect(this.musicBus);
    osc.start(time);
    osc.stop(time + this.secondsPerStep() * 1.65);
  }

  private playSupersawLead(root: number, melodySemitone: number, time: number, amp: number, bigger: boolean, step: number): void {
    if (!this.audioContext || !this.musicBus) return;

    const ctx = this.audioContext;
    const frequency = root * 2 * this.ratio(melodySemitone);
    const filter = ctx.createBiquadFilter();
    const sum = ctx.createGain();
    const ampGain = ctx.createGain();
    const pan = ctx.createStereoPanner();
    const duration = this.secondsPerStep() * (bigger ? 1.65 : 1.25);
    const detunes = bigger ? [-18, -9, -3, 0, 4, 10, 19] : [-12, -4, 0, 5, 13];

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(bigger ? 4200 : 3300, time);
    filter.Q.setValueAtTime(bigger ? 2.2 : 1.6, time);

    sum.gain.value = 1 / detunes.length;
    pan.pan.setValueAtTime(((step % 8) - 3.5) * 0.035, time);
    ampGain.gain.setValueAtTime(MIN_GAIN, time);
    ampGain.gain.linearRampToValueAtTime(amp, time + 0.01);
    ampGain.gain.exponentialRampToValueAtTime(MIN_GAIN, time + duration);

    detunes.forEach((detune) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(frequency * 0.985, time);
      osc.frequency.linearRampToValueAtTime(frequency, time + 0.055);
      osc.detune.setValueAtTime(detune, time);
      osc.connect(sum);
      osc.start(time);
      osc.stop(time + duration + 0.04);
    });

    sum.connect(filter);
    filter.connect(ampGain);
    ampGain.connect(pan);
    pan.connect(this.musicBus);
  }

  private playAnswerLead(root: number, melodySemitone: number, time: number, amp: number, bigger: boolean): void {
    if (!this.audioContext || !this.fxBus) return;

    const ctx = this.audioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const pan = ctx.createStereoPanner();
    const freq = root * 4 * this.ratio(melodySemitone);

    osc.type = bigger ? 'square' : 'triangle';
    osc.frequency.setValueAtTime(freq * 1.04, time);
    osc.frequency.exponentialRampToValueAtTime(freq, time + 0.08);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(bigger ? 2600 : 2100, time);
    filter.Q.setValueAtTime(3.2, time);
    pan.pan.setValueAtTime(bigger ? -0.34 : 0.32, time);

    gain.gain.setValueAtTime(MIN_GAIN, time);
    gain.gain.linearRampToValueAtTime(amp, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(MIN_GAIN, time + this.secondsPerStep() * 1.2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(pan);
    pan.connect(this.fxBus);
    osc.start(time);
    osc.stop(time + this.secondsPerStep() * 1.3);
  }

  private playVocalChop(root: number, step: number, time: number, amp: number): void {
    if (!this.audioContext || !this.fxBus) return;

    const ctx = this.audioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const formant = ctx.createBiquadFilter();
    const pan = ctx.createStereoPanner();
    const note = root * 2 * this.ratio(MINOR_EXT[(step + 2) % MINOR_EXT.length]);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(note, time);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(650 + (step % 4) * 160, time);
    filter.Q.setValueAtTime(5.8, time);
    formant.type = 'bandpass';
    formant.frequency.setValueAtTime(1350 + (step % 3) * 360, time);
    formant.Q.setValueAtTime(7, time);
    pan.pan.setValueAtTime(((step % 4) - 1.5) * 0.16, time);

    gain.gain.setValueAtTime(MIN_GAIN, time);
    gain.gain.linearRampToValueAtTime(amp, time + 0.006);
    gain.gain.exponentialRampToValueAtTime(MIN_GAIN, time + 0.16);

    osc.connect(filter);
    filter.connect(formant);
    formant.connect(gain);
    gain.connect(pan);
    pan.connect(this.fxBus);
    osc.start(time);
    osc.stop(time + 0.18);
  }

  private playSubBass(root: number, semitone: number, time: number, amp: number, duration: number): void {
    if (!this.audioContext || !this.bassBus) return;

    const ctx = this.audioContext;
    const freq = root * this.ratio(semitone);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(MIN_GAIN, time);
    gain.gain.linearRampToValueAtTime(amp, time + 0.006);
    gain.gain.exponentialRampToValueAtTime(MIN_GAIN, time + duration);

    osc.connect(gain);
    gain.connect(this.bassBus);
    osc.start(time);
    osc.stop(time + duration + 0.04);
  }

  private playElectroBass(root: number, semitone: number, time: number, amp: number, variation: number): void {
    if (!this.audioContext || !this.bassBus) return;

    const ctx = this.audioContext;
    const freq = root * this.ratio(semitone);
    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const drive = ctx.createWaveShaper();
    const duration = this.secondsPerStep() * (variation % 3 === 0 ? 1.35 : 1.1);

    osc.type = 'sawtooth';
    sub.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);
    sub.frequency.setValueAtTime(freq * 0.5, time);
    osc.detune.setValueAtTime(variation % 2 === 0 ? -5 : 5, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(190 + (variation % 4) * 38, time);
    filter.frequency.linearRampToValueAtTime(420 + (variation % 4) * 85, time + 0.045);
    filter.Q.setValueAtTime(7, time);

    drive.curve = this.makeDistortionCurve(140);
    drive.oversample = '2x';

    gain.gain.setValueAtTime(MIN_GAIN, time);
    gain.gain.linearRampToValueAtTime(amp, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(MIN_GAIN, time + duration);

    osc.connect(drive);
    drive.connect(filter);
    sub.connect(filter);
    filter.connect(gain);
    gain.connect(this.bassBus);
    osc.start(time);
    sub.start(time);
    osc.stop(time + duration + 0.04);
    sub.stop(time + duration + 0.04);
  }

  private playGrowlBass(root: number, semitone: number, time: number, amp: number, variation: number): void {
    if (!this.audioContext || !this.bassBus) return;

    const ctx = this.audioContext;
    const freq = root * this.ratio(semitone);
    const oscA = ctx.createOscillator();
    const oscB = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const drive = ctx.createWaveShaper();
    const pan = ctx.createStereoPanner();
    const duration = this.secondsPerStep() * (variation % 4 === 0 ? 1.55 : 1.18);

    oscA.type = 'sawtooth';
    oscB.type = 'square';
    sub.type = 'sine';
    oscA.frequency.setValueAtTime(freq, time);
    oscB.frequency.setValueAtTime(freq * 1.005, time);
    sub.frequency.setValueAtTime(freq * 0.5, time);
    oscA.detune.setValueAtTime(-8, time);
    oscB.detune.setValueAtTime(8, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(260 + variation * 35, time);
    filter.frequency.linearRampToValueAtTime(920 + variation * 70, time + 0.075);
    filter.frequency.exponentialRampToValueAtTime(260 + variation * 35, time + duration);
    filter.Q.setValueAtTime(9, time);

    drive.curve = this.makeDistortionCurve(280);
    drive.oversample = '4x';
    pan.pan.setValueAtTime(((variation % 5) - 2) * 0.025, time);

    gain.gain.setValueAtTime(MIN_GAIN, time);
    gain.gain.linearRampToValueAtTime(amp, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(MIN_GAIN, time + duration);

    oscA.connect(drive);
    oscB.connect(drive);
    drive.connect(filter);
    sub.connect(filter);
    filter.connect(gain);
    gain.connect(pan);
    pan.connect(this.bassBus);
    oscA.start(time);
    oscB.start(time);
    sub.start(time);
    oscA.stop(time + duration + 0.04);
    oscB.stop(time + duration + 0.04);
    sub.stop(time + duration + 0.04);
  }

  private playKick(time: number, amp: number): void {
    if (!this.audioContext || !this.drumBus) return;

    const ctx = this.audioContext;
    const osc = ctx.createOscillator();
    const click = ctx.createOscillator();
    const gain = ctx.createGain();
    const clickGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(148, time);
    osc.frequency.exponentialRampToValueAtTime(48, time + 0.12);
    osc.frequency.exponentialRampToValueAtTime(36, time + 0.28);

    click.type = 'square';
    click.frequency.setValueAtTime(1120, time);
    clickGain.gain.setValueAtTime(amp * 0.035, time);
    clickGain.gain.exponentialRampToValueAtTime(MIN_GAIN, time + 0.018);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, time);
    gain.gain.setValueAtTime(amp, time);
    gain.gain.exponentialRampToValueAtTime(MIN_GAIN, time + 0.34);

    osc.connect(filter);
    filter.connect(gain);
    click.connect(clickGain);
    gain.connect(this.drumBus);
    clickGain.connect(this.drumBus);
    osc.start(time);
    click.start(time);
    osc.stop(time + 0.36);
    click.stop(time + 0.026);
  }

  private playClap(time: number, amp: number): void {
    if (!this.audioContext || !this.drumBus || !this.noiseBuffer) return;

    [0, 0.012, 0.026].forEach((offset, index) => {
      const ctx = this.audioContext!;
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      src.buffer = this.noiseBuffer;
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1550 + index * 260, time + offset);
      filter.Q.setValueAtTime(0.8, time + offset);
      gain.gain.setValueAtTime(MIN_GAIN, time + offset);
      gain.gain.linearRampToValueAtTime(amp * (1 - index * 0.18), time + offset + 0.002);
      gain.gain.exponentialRampToValueAtTime(MIN_GAIN, time + offset + 0.11);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.drumBus!);
      src.start(time + offset);
      src.stop(time + offset + 0.13);
    });
  }

  private playSnareLayer(time: number, amp: number): void {
    if (!this.audioContext || !this.drumBus || !this.noiseBuffer) return;

    const ctx = this.audioContext;
    const src = ctx.createBufferSource();
    const tone = ctx.createOscillator();
    const gain = ctx.createGain();
    const toneGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    src.buffer = this.noiseBuffer;
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1300, time);
    tone.type = 'triangle';
    tone.frequency.setValueAtTime(190, time);
    tone.frequency.exponentialRampToValueAtTime(138, time + 0.1);

    gain.gain.setValueAtTime(MIN_GAIN, time);
    gain.gain.linearRampToValueAtTime(amp, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(MIN_GAIN, time + 0.13);
    toneGain.gain.setValueAtTime(amp * 0.22, time);
    toneGain.gain.exponentialRampToValueAtTime(MIN_GAIN, time + 0.09);

    src.connect(filter);
    filter.connect(gain);
    tone.connect(toneGain);
    gain.connect(this.drumBus);
    toneGain.connect(this.drumBus);
    src.start(time);
    tone.start(time);
    src.stop(time + 0.15);
    tone.stop(time + 0.11);
  }

  private playHat(time: number, amp: number, cutoff: number, duration: number): void {
    if (!this.audioContext || !this.drumBus || !this.noiseBuffer) return;

    const ctx = this.audioContext;
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    src.buffer = this.noiseBuffer;
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(cutoff, time);
    gain.gain.setValueAtTime(MIN_GAIN, time);
    gain.gain.linearRampToValueAtTime(amp, time + 0.001);
    gain.gain.exponentialRampToValueAtTime(MIN_GAIN, time + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.drumBus);
    src.start(time);
    src.stop(time + duration + 0.01);
  }

  private playOpenHat(time: number, amp: number): void {
    if (!this.audioContext || !this.drumBus || !this.noiseBuffer) return;

    const ctx = this.audioContext;
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    src.buffer = this.noiseBuffer;
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(6800, time);
    gain.gain.setValueAtTime(MIN_GAIN, time);
    gain.gain.linearRampToValueAtTime(amp, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(MIN_GAIN, time + 0.22);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.drumBus);
    src.start(time);
    src.stop(time + 0.24);
  }

  private playPerc(time: number, amp: number, freq: number): void {
    if (!this.audioContext || !this.drumBus) return;

    const ctx = this.audioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const pan = ctx.createStereoPanner();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, time);
    filter.Q.setValueAtTime(8, time);
    pan.pan.setValueAtTime(freq > 800 ? 0.26 : -0.24, time);
    gain.gain.setValueAtTime(MIN_GAIN, time);
    gain.gain.linearRampToValueAtTime(amp, time + 0.003);
    gain.gain.exponentialRampToValueAtTime(MIN_GAIN, time + 0.09);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(pan);
    pan.connect(this.drumBus);
    osc.start(time);
    osc.stop(time + 0.1);
  }

  private playAirPerc(time: number, amp: number, cutoff: number): void {
    if (!this.audioContext || !this.fxBus || !this.noiseBuffer) return;

    const ctx = this.audioContext;
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    src.buffer = this.noiseBuffer;
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(cutoff, time);
    filter.Q.setValueAtTime(2.2, time);
    gain.gain.setValueAtTime(MIN_GAIN, time);
    gain.gain.linearRampToValueAtTime(amp, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(MIN_GAIN, time + 0.08);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.fxBus);
    src.start(time);
    src.stop(time + 0.09);
  }

  private playRiser(time: number, duration: number, amp: number, ceilingHz: number): void {
    if (!this.audioContext || !this.fxBus) return;

    const ctx = this.audioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const pan = ctx.createStereoPanner();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, time);
    osc.frequency.exponentialRampToValueAtTime(ceilingHz, time + duration);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(320, time);
    filter.frequency.exponentialRampToValueAtTime(6200, time + duration);
    filter.Q.setValueAtTime(1.5, time);
    pan.pan.setValueAtTime(0.1, time);

    gain.gain.setValueAtTime(MIN_GAIN, time);
    gain.gain.exponentialRampToValueAtTime(amp, time + duration * 0.82);
    gain.gain.exponentialRampToValueAtTime(MIN_GAIN, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(pan);
    pan.connect(this.fxBus);
    osc.start(time);
    osc.stop(time + duration + 0.04);

    this.playNoiseSweep(time, duration, amp * 0.45, 4600, 12000);
  }

  private playNoiseSweep(time: number, duration: number, amp: number, startHz: number, endHz: number): void {
    if (!this.audioContext || !this.fxBus || !this.noiseBuffer) return;

    const ctx = this.audioContext;
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    src.buffer = this.noiseBuffer;
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(Math.max(80, startHz), time);
    filter.frequency.exponentialRampToValueAtTime(Math.max(80, endHz), time + duration);
    filter.Q.setValueAtTime(0.9, time);
    gain.gain.setValueAtTime(MIN_GAIN, time);
    gain.gain.linearRampToValueAtTime(amp, time + duration * 0.18);
    gain.gain.exponentialRampToValueAtTime(MIN_GAIN, time + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.fxBus);
    src.start(time);
    src.stop(time + duration + 0.02);
  }

  private playReverseCymbal(time: number, duration: number, amp: number): void {
    if (!this.audioContext || !this.fxBus || !this.noiseBuffer) return;

    const ctx = this.audioContext;
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    src.buffer = this.noiseBuffer;
    src.playbackRate.setValueAtTime(0.72, time);
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(3000, time);
    gain.gain.setValueAtTime(MIN_GAIN, time);
    gain.gain.linearRampToValueAtTime(amp, time + duration * 0.92);
    gain.gain.exponentialRampToValueAtTime(MIN_GAIN, time + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.fxBus);
    src.start(time);
    src.stop(time + duration + 0.01);
  }

  private playCrash(time: number, amp: number): void {
    if (!this.audioContext || !this.fxBus || !this.noiseBuffer) return;

    const ctx = this.audioContext;
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    src.buffer = this.noiseBuffer;
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(4200, time);
    gain.gain.setValueAtTime(MIN_GAIN, time);
    gain.gain.linearRampToValueAtTime(amp, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(MIN_GAIN, time + 1.2);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.fxBus);
    src.start(time);
    src.stop(time + 1.25);
  }

  private playImpact(time: number, amp: number): void {
    if (!this.audioContext || !this.fxBus || !this.noiseBuffer) return;

    const ctx = this.audioContext;
    const src = ctx.createBufferSource();
    const osc = ctx.createOscillator();
    const noiseGain = ctx.createGain();
    const oscGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    src.buffer = this.noiseBuffer;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(78, time);
    osc.frequency.exponentialRampToValueAtTime(34, time + 0.55);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, time);

    noiseGain.gain.setValueAtTime(amp, time);
    noiseGain.gain.exponentialRampToValueAtTime(MIN_GAIN, time + 0.46);
    oscGain.gain.setValueAtTime(amp * 0.9, time);
    oscGain.gain.exponentialRampToValueAtTime(MIN_GAIN, time + 0.62);

    src.connect(filter);
    filter.connect(noiseGain);
    osc.connect(oscGain);
    noiseGain.connect(this.fxBus);
    oscGain.connect(this.fxBus);
    src.start(time);
    osc.start(time);
    src.stop(time + 0.65);
    osc.stop(time + 0.65);
  }

  private playDownlifter(time: number, duration: number, amp: number): void {
    if (!this.audioContext || !this.fxBus) return;

    const ctx = this.audioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1900, time);
    osc.frequency.exponentialRampToValueAtTime(70, time + duration);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2800, time);
    filter.frequency.exponentialRampToValueAtTime(360, time + duration);
    gain.gain.setValueAtTime(amp, time);
    gain.gain.exponentialRampToValueAtTime(MIN_GAIN, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.fxBus);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  private playSnareRoll(step: number, progress: number, time: number, stronger: boolean): void {
    let interval = 4;
    if (progress > 0.38) interval = 2;
    if (progress > 0.68) interval = 1;

    if (step % interval !== 0) return;

    const amp = (stronger ? 0.085 : 0.065) + progress * (stronger ? 0.12 : 0.09);
    this.playSnareLayer(time, amp);

    if (progress > 0.82 && step % 2 === 1) {
      this.playSnareLayer(time + this.secondsPerStep() * 0.5, amp * 0.65);
    }
  }

  private playPitchLaser(root: number, time: number, amp: number, stronger: boolean): void {
    if (!this.audioContext || !this.fxBus) return;

    const ctx = this.audioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const start = root * (stronger ? 8 : 6);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(start, time);
    osc.frequency.exponentialRampToValueAtTime(start * 1.9, time + 0.18);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1800, time);
    filter.Q.setValueAtTime(5, time);
    gain.gain.setValueAtTime(MIN_GAIN, time);
    gain.gain.linearRampToValueAtTime(amp, time + 0.006);
    gain.gain.exponentialRampToValueAtTime(MIN_GAIN, time + 0.2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.fxBus);
    osc.start(time);
    osc.stop(time + 0.22);
  }

  private playLaserZap(root: number, time: number, amp: number, step: number): void {
    if (!this.audioContext || !this.fxBus) return;

    const ctx = this.audioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const pan = ctx.createStereoPanner();
    const freq = root * 8 * this.ratio(MINOR[step % MINOR.length]);

    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.58, time + 0.11);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2400 + (step % 4) * 420, time);
    filter.Q.setValueAtTime(4.5, time);
    pan.pan.setValueAtTime(step % 4 < 2 ? -0.42 : 0.42, time);
    gain.gain.setValueAtTime(MIN_GAIN, time);
    gain.gain.linearRampToValueAtTime(amp, time + 0.003);
    gain.gain.exponentialRampToValueAtTime(MIN_GAIN, time + 0.13);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(pan);
    pan.connect(this.fxBus);
    osc.start(time);
    osc.stop(time + 0.15);
  }

  private playPreDropStop(time: number, stronger: boolean): void {
    if (!this.sidechainGain) return;

    this.sidechainGain.gain.cancelScheduledValues(time);
    this.sidechainGain.gain.setValueAtTime(1, time);
    this.sidechainGain.gain.linearRampToValueAtTime(0.02, time + 0.03);
    this.sidechainGain.gain.linearRampToValueAtTime(1, time + this.secondsPerStep() * 0.95);
    this.playImpact(time + this.secondsPerStep() * 0.82, stronger ? 0.12 : 0.08);
  }

  private playDropFill(time: number, bigger: boolean): void {
    const stepDur = this.secondsPerStep();
    for (let i = 0; i < 4; i++) {
      this.playSnareLayer(time + i * stepDur * 0.5, (bigger ? 0.105 : 0.082) * (1 + i * 0.12));
      if (i % 2 === 0) this.playAirPerc(time + i * stepDur * 0.5, bigger ? 0.055 : 0.04, 6200 + i * 650);
    }
    this.playReverseCymbal(time, stepDur * 4, bigger ? 0.09 : 0.065);
  }

  private playSnareFill(time: number, amp: number): void {
    const stepDur = this.secondsPerStep();
    this.playSnareLayer(time, amp);
    this.playSnareLayer(time + stepDur * 0.5, amp * 0.82);
    this.playSnareLayer(time + stepDur, amp * 1.08);
  }

  private automateSectionTone(section: MusicSection, progress: number, time: number): void {
    if (!this.toneFilter) return;

    const target =
      section === 'intro' ? 3800 + progress * 4200 :
      section === 'groove' ? 9000 :
      section === 'buildUpOne' ? 2500 + progress * 11000 :
      section === 'buildUpTwo' ? 3200 + progress * 12500 :
      section === 'breakdown' ? 5200 :
      section === 'outro' ? 7600 - progress * 4800 :
      16000;

    this.toneFilter.frequency.cancelScheduledValues(time);
    this.toneFilter.frequency.setTargetAtTime(target, time, 0.08);
  }

  private sidechainPump(time: number, floor: number, release: number): void {
    if (!this.sidechainGain) return;

    this.sidechainGain.gain.cancelScheduledValues(time);
    this.sidechainGain.gain.setValueAtTime(1, time);
    this.sidechainGain.gain.linearRampToValueAtTime(floor, time + 0.018);
    this.sidechainGain.gain.linearRampToValueAtTime(1, time + release);
  }

  private fadeMaster(time: number, duration: number): void {
    if (!this.masterGain) return;
    const current = this.volume * MASTER_GAIN_AT_FULL;
    this.masterGain.gain.cancelScheduledValues(time);
    this.masterGain.gain.setValueAtTime(current, time);
    this.masterGain.gain.linearRampToValueAtTime(MIN_GAIN, time + duration);
    this.masterGain.gain.setTargetAtTime(current, time + duration + 0.1, 0.12);
  }

  private secondsPerBeat(): number {
    return 60 / this.bpm;
  }

  private secondsPerStep(): number {
    return this.secondsPerBeat() / BEATS_PER_BAR;
  }

  private secondsPerBar(): number {
    return this.secondsPerBeat() * BEATS_PER_BAR;
  }

  private ratio(semitones: number): number {
    return Math.pow(2, semitones / 12);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private createNoiseBuffer(seconds: number): AudioBuffer | null {
    if (!this.audioContext) return null;

    const length = Math.floor(this.audioContext.sampleRate * seconds);
    const buffer = this.audioContext.createBuffer(1, length, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.985 + white * 0.015;
      data[i] = white * 0.72 + last * 0.28;
    }

    return buffer;
  }

  private createImpulseBuffer(seconds: number, decay: number): AudioBuffer | null {
    if (!this.audioContext) return null;

    const length = Math.floor(this.audioContext.sampleRate * seconds);
    const buffer = this.audioContext.createBuffer(2, length, this.audioContext.sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const t = i / length;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * 0.55;
      }
    }

    return buffer;
  }

  private makeDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
    const samples = 256;
    const curve = new Float32Array(new ArrayBuffer(samples * Float32Array.BYTES_PER_ELEMENT));
    const deg = Math.PI / 180;

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }

    return curve;
  }
}
