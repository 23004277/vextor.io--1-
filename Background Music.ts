export type BackgroundMusicState = 'stopped' | 'playing' | 'paused';

type MusicSection =
  | 'intro'
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

const BPM = 128;
const STEPS_PER_BAR = 16;
const BEATS_PER_BAR = 4;
const SECONDS_PER_BEAT = 60 / BPM;
const SECONDS_PER_STEP = SECONDS_PER_BEAT / 4;
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SECONDS = 0.18;
const MASTER_GAIN_AT_FULL = 0.34;

const ARRANGEMENT: ArrangementEntry[] = [
  { section: 'intro', bars: 8 },
  { section: 'buildUpOne', bars: 8 },
  { section: 'dropOne', bars: 16 },
  { section: 'breakdown', bars: 8 },
  { section: 'buildUpTwo', bars: 16 },
  { section: 'dropTwo', bars: 16 },
  { section: 'outro', bars: 8 },
];

const MINOR_SCALE = [0, 3, 7, 10];
const ROOT_SEQUENCE = [46.25, 55.0, 61.74, 69.3];
const DROP_MELODY = [0, 2, 1, 3, 2, 1, 0, 1, 3, 2, 1, 0, 2, 1, 3, 1];
const ARP_PATTERN = [0, 1, 2, 1, 3, 2, 1, 0];
const HAT_PATTERN = [1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0];
const BASS_PATTERN = [0, -1, 0, -1, 2, -1, 0, -1, 1, -1, 0, -1, 3, -1, 2, -1];

export class BackgroundMusic {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private drumBus: GainNode | null = null;
  private fxBus: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private state: BackgroundMusicState = 'stopped';
  private bpm = BPM;
  private volume = 0.1;
  private schedulerId: number | null = null;
  private currentStep = 0;
  private currentBar = 0;
  private arrangementIndex = 0;
  private barInSection = 0;
  private nextStepTime = 0;
  private arrangementRestartPending = false;

  init(): void {
    if (this.audioContext) return;
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new Ctx();

    this.masterGain = this.audioContext.createGain();
    this.musicBus = this.audioContext.createGain();
    this.drumBus = this.audioContext.createGain();
    this.fxBus = this.audioContext.createGain();
    this.compressor = this.audioContext.createDynamicsCompressor();

    this.masterGain.gain.value = this.volume * MASTER_GAIN_AT_FULL;
    this.musicBus.gain.value = 0.92;
    this.drumBus.gain.value = 0.96;
    this.fxBus.gain.value = 0.62;

    this.compressor.threshold.setValueAtTime(-16, this.audioContext.currentTime);
    this.compressor.knee.setValueAtTime(18, this.audioContext.currentTime);
    this.compressor.ratio.setValueAtTime(3.2, this.audioContext.currentTime);
    this.compressor.attack.setValueAtTime(0.003, this.audioContext.currentTime);
    this.compressor.release.setValueAtTime(0.18, this.audioContext.currentTime);

    this.musicBus.connect(this.masterGain);
    this.drumBus.connect(this.masterGain);
    this.fxBus.connect(this.masterGain);
    this.masterGain.connect(this.compressor);
    this.compressor.connect(this.audioContext.destination);

    this.noiseBuffer = this.createNoiseBuffer();
    this.state = 'paused';
  }

  async start(): Promise<void> {
    this.init();
    if (!this.audioContext) return;
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    if (this.state === 'playing') return;

    this.resetTransport(this.audioContext.currentTime + 0.06);
    this.startScheduler();
    this.state = 'playing';
  }

  pause(): void {
    if (!this.audioContext) return;
    this.stopScheduler();
    this.state = 'paused';
  }

  async resume(): Promise<void> {
    if (!this.audioContext) {
      await this.start();
      return;
    }
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    if (this.state === 'playing') return;
    this.nextStepTime = Math.max(this.audioContext.currentTime + 0.04, this.nextStepTime || 0);
    this.startScheduler();
    this.state = 'playing';
  }

  stop(): void {
    this.stopScheduler();
    this.state = 'stopped';
    if (this.audioContext) {
      this.audioContext.close().catch(() => undefined);
    }
    this.audioContext = null;
    this.masterGain = null;
    this.musicBus = null;
    this.drumBus = null;
    this.fxBus = null;
    this.compressor = null;
    this.noiseBuffer = null;
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (!this.masterGain || !this.audioContext) return;
    this.masterGain.gain.setTargetAtTime(this.volume * MASTER_GAIN_AT_FULL, this.audioContext.currentTime, 0.05);
  }

  setBpm(nextBpm: number): void {
    this.bpm = Math.max(96, Math.min(160, nextBpm));
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

  private resetTransport(startTime: number): void {
    this.currentStep = 0;
    this.currentBar = 0;
    this.arrangementIndex = 0;
    this.barInSection = 0;
    this.arrangementRestartPending = false;
    this.nextStepTime = startTime;
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
    const sectionProgress = entry.bars <= 1 ? 1 : this.barInSection / Math.max(1, entry.bars - 1);
    this.playStep(entry.section, this.currentStep, sectionProgress, time);
  }

  private advanceTransport(): void {
    this.currentStep++;
    this.nextStepTime += SECONDS_PER_STEP * (BPM / this.bpm);

    if (this.currentStep >= STEPS_PER_BAR) {
      this.currentStep = 0;
      this.currentBar++;
      this.barInSection++;

      const entry = ARRANGEMENT[this.arrangementIndex];
      if (entry && this.barInSection >= entry.bars) {
        this.arrangementIndex++;
        this.barInSection = 0;
      }

      if (this.arrangementIndex >= ARRANGEMENT.length) {
        this.arrangementIndex = 0;
        this.currentBar = 0;
      }
    }
  }

  private playStep(section: MusicSection, step: number, progress: number, time: number): void {
    const beat = step % STEPS_PER_BAR;
    const barRoot = ROOT_SEQUENCE[this.currentBar % ROOT_SEQUENCE.length];
    const phraseVariant = this.currentBar % 4;

    this.playPad(section, barRoot, time, step, progress);

    if (section === 'intro') {
      if (beat === 0 || beat === 8) this.playArp(barRoot, step, time, 0.12, 980);
      if (step === 0 && progress < 0.9) this.playNoiseWash(time, 0.75, 0.045, 6800, 900);
      return;
    }

    if (section === 'buildUpOne' || section === 'buildUpTwo') {
      if (step === 0) this.playRiser(time, SECONDS_PER_STEP * STEPS_PER_BAR, section === 'buildUpTwo' ? 0.14 : 0.1, section === 'buildUpTwo' ? 1800 : 1200);
      this.playSnareRoll(step, progress, time, section === 'buildUpTwo');
      if (beat === 0 || beat === 8) this.playFilteredChord(barRoot, time, progress, section === 'buildUpTwo');
      if (progress > 0.72 && beat % 2 === 0) this.playArp(barRoot * 2, step + phraseVariant, time, 0.08, 2100);
      return;
    }

    if (section === 'breakdown') {
      if (beat === 0 || beat === 8) this.playArp(barRoot, step + phraseVariant, time, 0.1, 1200);
      if (beat === 4 || beat === 12) this.playFilteredLead(barRoot, step, time);
      return;
    }

    const isDrop = section === 'dropOne' || section === 'dropTwo';
    const isBigDrop = section === 'dropTwo';
    const isOutro = section === 'outro';

    if (isDrop || isOutro) {
      if (beat === 0 || beat === 4 || beat === 8 || beat === 12) {
        this.playKick(time, isBigDrop ? 1.02 : 0.9);
        this.sidechainPump(time, isBigDrop ? 0.13 : 0.17);
      }
      if (beat === 4 || beat === 12) this.playClap(time, isBigDrop ? 0.22 : 0.18);
      if (HAT_PATTERN[step]) this.playHat(time, isBigDrop ? 0.08 : 0.06, step % 2 === 0 ? 7800 : 9800);

      const bassIndex = BASS_PATTERN[step];
      if (bassIndex >= 0) {
        this.playBass(barRoot * this.intervalRatio(MINOR_SCALE[bassIndex]), time, isBigDrop ? 0.28 : 0.22, isBigDrop ? 210 : 185);
      }

      if (isOutro) {
        if (beat === 0 || beat === 8) this.playFilteredLead(barRoot, step, time, 0.08);
        return;
      }

      this.playLead(barRoot, step, time, isBigDrop ? 0.15 : 0.12, isBigDrop ? 0.22 : 0.16);
      if (isBigDrop && step % 4 === 2) {
        this.playExtraLead(barRoot, step, time);
      }
    }
  }

  private playPad(section: MusicSection, root: number, time: number, step: number, progress: number): void {
    if (!this.audioContext || !this.musicBus) return;
    if (step !== 0 && step !== 8) return;
    const duration = step === 0 ? SECONDS_PER_STEP * 8.2 : SECONDS_PER_STEP * 7.8;
    const amp =
      section === 'dropTwo' ? 0.08 :
      section === 'dropOne' ? 0.07 :
      section === 'buildUpTwo' ? 0.06 + progress * 0.01 :
      0.055;

    for (let i = 0; i < 3; i++) {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      const filter = this.audioContext.createBiquadFilter();
      const stereo = this.audioContext.createStereoPanner();
      const freq = root * this.intervalRatio(MINOR_SCALE[i]);

      osc.type = i === 2 ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(freq, time);
      osc.detune.setValueAtTime((i - 1) * 6, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(section.includes('drop') ? 2400 : 1500, time);
      filter.Q.setValueAtTime(0.3, time);

      stereo.pan.setValueAtTime((i - 1) * 0.2, time);
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(amp / 3, time + 0.22);
      gain.gain.linearRampToValueAtTime(amp / 4, time + duration * 0.6);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(stereo);
      stereo.connect(this.musicBus);
      osc.start(time);
      osc.stop(time + duration + 0.04);
    }
  }

  private playArp(root: number, step: number, time: number, amp: number, cutoff: number): void {
    if (!this.audioContext || !this.musicBus) return;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();
    const note = root * this.intervalRatio(MINOR_SCALE[ARP_PATTERN[step % ARP_PATTERN.length]]);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(note * 2, time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(amp, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus);
    osc.start(time);
    osc.stop(time + 0.24);
  }

  private playFilteredChord(root: number, time: number, progress: number, stronger: boolean): void {
    if (!this.audioContext || !this.musicBus) return;
    const duration = SECONDS_PER_STEP * 6;
    const cutoffBase = stronger ? 900 : 650;
    for (let i = 0; i < 3; i++) {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      const filter = this.audioContext.createBiquadFilter();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(root * this.intervalRatio(MINOR_SCALE[i]), time);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(cutoffBase + progress * (stronger ? 2800 : 1800), time);
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime((stronger ? 0.04 : 0.03) / 3, time + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicBus);
      osc.start(time);
      osc.stop(time + duration + 0.03);
    }
  }

  private playRiser(time: number, duration: number, amp: number, ceilingHz: number): void {
    if (!this.audioContext || !this.fxBus) return;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, time);
    osc.frequency.exponentialRampToValueAtTime(ceilingHz, time + duration);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(280, time);
    filter.frequency.exponentialRampToValueAtTime(6200, time + duration);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(amp, time + duration * 0.78);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.fxBus);
    osc.start(time);
    osc.stop(time + duration);

    if (this.noiseBuffer) {
      this.playNoiseWash(time, duration, amp * 0.35, 4200, 180);
    }
  }

  private playSnareRoll(step: number, progress: number, time: number, stronger: boolean): void {
    let interval = 4;
    if (progress > 0.5) interval = 2;
    if (progress > 0.75) interval = 1;
    if (step % interval !== 0) return;
    this.playSnare(time, (stronger ? 0.13 : 0.1) + progress * 0.1);
  }

  private playKick(time: number, amp: number): void {
    if (!this.audioContext || !this.drumBus) return;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(146, time);
    osc.frequency.exponentialRampToValueAtTime(44, time + 0.14);
    gain.gain.setValueAtTime(amp, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.34);
    osc.connect(gain);
    gain.connect(this.drumBus);
    osc.start(time);
    osc.stop(time + 0.36);
  }

  private playClap(time: number, amp: number): void {
    if (!this.audioContext || !this.drumBus || !this.noiseBuffer) return;
    const src = this.audioContext.createBufferSource();
    const gain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();
    src.buffer = this.noiseBuffer;
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1700, time);
    filter.Q.setValueAtTime(0.65, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(amp, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.drumBus);
    src.start(time);
    src.stop(time + 0.13);
  }

  private playSnare(time: number, amp: number): void {
    if (!this.audioContext || !this.drumBus || !this.noiseBuffer) return;
    const src = this.audioContext.createBufferSource();
    const gain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();
    src.buffer = this.noiseBuffer;
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1400, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(amp, time + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.14);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.drumBus);
    src.start(time);
    src.stop(time + 0.16);
  }

  private playHat(time: number, amp: number, cutoff: number): void {
    if (!this.audioContext || !this.drumBus || !this.noiseBuffer) return;
    const src = this.audioContext.createBufferSource();
    const gain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();
    src.buffer = this.noiseBuffer;
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(cutoff, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(amp, time + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.drumBus);
    src.start(time);
    src.stop(time + 0.06);
  }

  private playBass(freq: number, time: number, amp: number, cutoff: number): void {
    if (!this.audioContext || !this.musicBus) return;
    const osc = this.audioContext.createOscillator();
    const sub = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();
    osc.type = 'sawtooth';
    sub.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);
    sub.frequency.setValueAtTime(freq * 0.5, time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, time);
    gain.gain.setValueAtTime(amp, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.24);
    osc.connect(filter);
    sub.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus);
    osc.start(time);
    sub.start(time);
    osc.stop(time + 0.26);
    sub.stop(time + 0.26);
  }

  private playLead(root: number, step: number, time: number, amp: number, slide: number): void {
    if (!this.audioContext || !this.musicBus) return;
    const noteIndex = DROP_MELODY[step % DROP_MELODY.length];
    const freq = root * 2 * this.intervalRatio(MINOR_SCALE[noteIndex % MINOR_SCALE.length]);
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();
    const stereo = this.audioContext.createStereoPanner();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq * (1 - slide * 0.15), time);
    osc.frequency.linearRampToValueAtTime(freq, time + 0.08);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2600, time);
    filter.Q.setValueAtTime(3.2, time);
    stereo.pan.setValueAtTime(((step % 4) - 1.5) * 0.08, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(amp, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(stereo);
    stereo.connect(this.musicBus);
    osc.start(time);
    osc.stop(time + 0.24);
  }

  private playExtraLead(root: number, step: number, time: number): void {
    if (!this.audioContext || !this.fxBus) return;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();
    const melodyIndex = DROP_MELODY[(step + 5) % DROP_MELODY.length];
    const freq = root * 4 * this.intervalRatio(MINOR_SCALE[melodyIndex % MINOR_SCALE.length]);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2400, time);
    filter.Q.setValueAtTime(2.8, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.08, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.fxBus);
    osc.start(time);
    osc.stop(time + 0.18);
  }

  private playFilteredLead(root: number, step: number, time: number, amp = 0.06): void {
    if (!this.audioContext || !this.musicBus) return;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();
    const note = root * 2 * this.intervalRatio(MINOR_SCALE[(step / 4) % MINOR_SCALE.length]);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(note, time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(780, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(amp, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.34);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus);
    osc.start(time);
    osc.stop(time + 0.36);
  }

  private playNoiseWash(time: number, duration: number, amp: number, startHz: number, endHz: number): void {
    if (!this.audioContext || !this.fxBus || !this.noiseBuffer) return;
    const src = this.audioContext.createBufferSource();
    const gain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();
    src.buffer = this.noiseBuffer;
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(startHz, time);
    filter.frequency.exponentialRampToValueAtTime(endHz, time + duration);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(amp, time + duration * 0.18);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.fxBus);
    src.start(time);
    src.stop(time + duration);
  }

  private sidechainPump(time: number, floor: number): void {
    if (!this.musicBus) return;
    this.musicBus.gain.cancelScheduledValues(time);
    this.musicBus.gain.setValueAtTime(0.92, time);
    this.musicBus.gain.linearRampToValueAtTime(floor, time + 0.018);
    this.musicBus.gain.linearRampToValueAtTime(0.92, time + 0.22);
  }

  private intervalRatio(semitones: number): number {
    return Math.pow(2, semitones / 12);
  }

  private createNoiseBuffer(): AudioBuffer | null {
    if (!this.audioContext) return null;
    const length = this.audioContext.sampleRate * 2;
    const buffer = this.audioContext.createBuffer(1, length, this.audioContext.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      channel[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }
    return buffer;
  }
}
