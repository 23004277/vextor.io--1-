export type BackgroundMusicState = 'stopped' | 'playing' | 'paused';

export type BackgroundMusicSection =
  | 'idle'
  | 'intro'
  | 'build'
  | 'drop'
  | 'breakdown'
  | 'finale';

export type BackgroundMusicVisualizerFrame = {
  bars: ReadonlyArray<number>;
  waveform: ReadonlyArray<number>;
  beatPulse: number;
  beatPhase: number;
  downbeatPulse: number;
  beatDetected: boolean;
  manualBeatPulse: number;
  bass: number;
  mids: number;
  highs: number;
  energy: number;
  reactorPulse: number;
  logoPulse: number;
  backgroundGlow: number;
  bloom: number;
  particleBurst: number;
  uiFlicker: number;
  scanlineIntensity: number;
  glitchIntensity: number;
  currentTime: number;
  duration: number;
  progress: number;
  section: BackgroundMusicSection;
  sectionLabel: string;
  breakActive: boolean;
  breakRemaining: number;
  loopCount: number;
  formattedCurrentTime: string;
  formattedDuration: string;
  paused: boolean;
  volume: number;
};

type AudioByteBuffer = Uint8Array<ArrayBuffer>;

const MENU_TRACK_URLS = [
  new URL('./musicasset/Button_Mash_Glory.mp3', import.meta.url).href,
  new URL('./musicasset/Final_Sector_Charge.mp3', import.meta.url).href,
] as const;
const FALLBACK_DURATION_SECONDS = 180;
const FADE_IN_MS = 1400;
const FADE_OUT_MS = 900;
const DEFAULT_BAR_COUNT = 36;
const DEFAULT_WAVEFORM_POINTS = 80;
const FFT_SIZE = 4096;
const SMOOTHING_TIME_CONSTANT = 0.78;
const BEAT_COOLDOWN_MS = 170;
const BEAT_SPIKE_THRESHOLD = 0.08;
const MANUAL_BEAT_WINDOW = 0.075;

const MENU_BEAT_MAP_SECONDS: number[] = [
  // Add exact musical hit timestamps here for cinematic sync.
];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const lerp = (from: number, to: number, alpha: number) => from + (to - from) * alpha;

const averageRange = (data: ArrayLike<number>, start: number, end: number): number => {
  const safeStart = clamp(Math.floor(start), 0, data.length);
  const safeEnd = clamp(Math.floor(end), safeStart + 1, data.length);
  let total = 0;
  for (let i = safeStart; i < safeEnd; i += 1) total += data[i];
  return total / Math.max(1, safeEnd - safeStart) / 255;
};

const formatTime = (totalSeconds: number): string => {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const createZeroBars = (count: number) => Array.from({ length: count }, () => 0);
const EMPTY_BARS = Object.freeze(createZeroBars(DEFAULT_BAR_COUNT));
const EMPTY_WAVEFORM = Object.freeze(createZeroBars(DEFAULT_WAVEFORM_POINTS));

const getBars = (data: ArrayLike<number>, barCount: number, output: number[]): number[] => {
  const usableBins = Math.max(1, Math.floor(data.length * 0.92));
  const binsPerBar = usableBins / barCount;
  if (output.length !== barCount) output.length = barCount;

  for (let barIndex = 0; barIndex < barCount; barIndex += 1) {
    const start = Math.floor(barIndex * binsPerBar);
    const end = Math.max(start + 1, Math.floor((barIndex + 1) * binsPerBar));
    let peak = 0;
    let weighted = 0;
    let weightTotal = 0;
    for (let i = start; i < end; i += 1) {
      const normalized = data[i] / 255;
      const weight = 1 + (i / usableBins) * 0.35;
      weighted += normalized * weight;
      weightTotal += weight;
      if (normalized > peak) peak = normalized;
    }
    const avg = weightTotal > 0 ? weighted / weightTotal : 0;
    output[barIndex] = clamp(avg * 0.72 + peak * 0.52, 0, 1);
  }

  return output;
};

const getWaveform = (data: ArrayLike<number>, pointCount: number, output: number[]): number[] => {
  const step = Math.max(1, Math.floor(data.length / pointCount));
  if (output.length !== pointCount) output.length = pointCount;
  for (let i = 0; i < pointCount; i += 1) {
    const sample = data[Math.min(data.length - 1, i * step)] ?? 128;
    output[i] = clamp((sample - 128) / 128, -1, 1);
  }
  return output;
};

const detectSection = (progress: number, bass: number, energy: number): { key: BackgroundMusicSection; label: string } => {
  if (energy < 0.08) return { key: 'idle', label: 'Signal Idle' };
  if (progress < 0.16) return { key: 'intro', label: 'Boot Sequence' };
  if (progress < 0.38) return { key: 'build', label: 'Charge Build' };
  if (progress < 0.68) return bass > 0.56 ? { key: 'drop', label: 'Impact Drive' } : { key: 'build', label: 'Charge Build' };
  if (progress < 0.84) return energy < 0.34 ? { key: 'breakdown', label: 'Cooling Break' } : { key: 'drop', label: 'Impact Drive' };
  return { key: 'finale', label: 'Victory Surge' };
};

export class BackgroundMusic {
  private audio: HTMLAudioElement | null = null;
  private state: BackgroundMusicState = 'stopped';
  private volume = 1;
  private fadeRafId: number | null = null;
  private fadeToken = 0;
  private wantsPlayback = false;
  private loopCount = 0;
  private lastCurrentTime = 0;

  private audioContext: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;

  private frequencyData: AudioByteBuffer | null = null;
  private timeDomainData: AudioByteBuffer | null = null;
  private barBuffer = createZeroBars(DEFAULT_BAR_COUNT);
  private waveformBuffer = createZeroBars(DEFAULT_WAVEFORM_POINTS);

  private prevBass = 0;
  private lastBeatAt = -Infinity;
  private beatPulse = 0;
  private downbeatPulse = 0;
  private manualBeatPulse = 0;
  private manualBeatCursor = 0;
  private smoothedBass = 0;
  private smoothedMids = 0;
  private smoothedHighs = 0;
  private smoothedEnergy = 0;
  private smoothedBars = createZeroBars(DEFAULT_BAR_COUNT);
  private smoothedWaveform = createZeroBars(DEFAULT_WAVEFORM_POINTS);
  private lastFrameAt = 0;
  private lastBeatDetected = false;
  private currentGain = 0;
  private trackIndex = 0;
  private frameCache: BackgroundMusicVisualizerFrame = {
    bars: EMPTY_BARS,
    waveform: EMPTY_WAVEFORM,
    beatPulse: 0,
    beatPhase: 1,
    downbeatPulse: 0,
    beatDetected: false,
    manualBeatPulse: 0,
    bass: 0,
    mids: 0,
    highs: 0,
    energy: 0,
    reactorPulse: 0,
    logoPulse: 0,
    backgroundGlow: 0,
    bloom: 0,
    particleBurst: 0,
    uiFlicker: 0,
    scanlineIntensity: 0,
    glitchIntensity: 0,
    currentTime: 0,
    duration: FALLBACK_DURATION_SECONDS,
    progress: 0,
    section: 'idle',
    sectionLabel: 'Signal Idle',
    breakActive: false,
    breakRemaining: 0,
    loopCount: 0,
    formattedCurrentTime: '00:00',
    formattedDuration: formatTime(FALLBACK_DURATION_SECONDS),
    paused: true,
    volume: 0,
  };

  init(): void {
    if (this.audio) return;

    const audio = new Audio(MENU_TRACK_URLS[this.trackIndex]);
    audio.loop = false;
    audio.preload = 'auto';
    audio.currentTime = 0;
    audio.crossOrigin = 'anonymous';
    audio.setAttribute('playsinline', 'true');

    audio.addEventListener('ended', this.handleEnded);

    this.audio = audio;
    this.state = 'paused';
  }

  async start(): Promise<void> {
    await this.resume();
  }

  async resume(): Promise<void> {
    this.init();
    const audio = this.audio;
    if (!audio) return;

    this.wantsPlayback = true;
    this.ensureAudioGraph();

    if (this.audioContext?.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch {
        return;
      }
    }

    this.cancelFade();

    if (audio.paused) {
      try {
        await audio.play();
      } catch (error) {
        if (error instanceof DOMException && error.name === 'NotAllowedError') return;
        throw error;
      }
    }

    this.state = 'playing';
    await this.fadeAudio(this.volume, FADE_IN_MS);
  }

  pause(): void {
    this.wantsPlayback = false;
    const audio = this.audio;
    if (!audio) {
      this.state = 'paused';
      return;
    }

    const token = ++this.fadeToken;
    this.state = 'paused';

    void this.fadeAudio(0, FADE_OUT_MS, token).then(() => {
      if (!this.audio || token !== this.fadeToken) return;
      this.audio.pause();
    });
  }

  pauseImmediately(): void {
    this.wantsPlayback = false;
    this.cancelFade();
    if (this.audio) this.audio.pause();
    if (this.gainNode) this.gainNode.gain.value = 0;
    this.currentGain = 0;
    this.state = 'paused';
  }

  stop(): void {
    this.wantsPlayback = false;
    this.cancelFade();

    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio.removeEventListener('ended', this.handleEnded);
      this.audio.src = '';
      this.audio.load();
    }

    this.sourceNode?.disconnect();
    this.analyserNode?.disconnect();
    this.gainNode?.disconnect();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      void this.audioContext.close();
    }

    this.audio = null;
    this.audioContext = null;
    this.sourceNode = null;
    this.analyserNode = null;
    this.gainNode = null;
    this.frequencyData = null;
    this.timeDomainData = null;
    this.barBuffer = createZeroBars(DEFAULT_BAR_COUNT);
    this.waveformBuffer = createZeroBars(DEFAULT_WAVEFORM_POINTS);
    this.smoothedBars = createZeroBars(DEFAULT_BAR_COUNT);
    this.smoothedWaveform = createZeroBars(DEFAULT_WAVEFORM_POINTS);
    this.trackIndex = 0;
    this.prevBass = 0;
    this.beatPulse = 0;
    this.downbeatPulse = 0;
    this.manualBeatPulse = 0;
    this.loopCount = 0;
    this.manualBeatCursor = 0;
    this.lastCurrentTime = 0;
    this.currentGain = 0;
    this.state = 'stopped';
  }

  setVolume(volume: number): void {
    this.volume = clamp(volume, 0, 1);
    if (this.state === 'playing') {
      void this.fadeAudio(this.volume, 180);
    }
  }

  getState(): BackgroundMusicState {
    return this.state;
  }

  getVisualizerFrame(): BackgroundMusicVisualizerFrame {
    const now = performance.now();
    const dtMs = this.lastFrameAt > 0 ? now - this.lastFrameAt : 16.67;
    this.lastFrameAt = now;
    const dtNorm = clamp(dtMs / 16.67, 0.5, 2.4);

    const audio = this.audio;
    const analyser = this.analyserNode;
    const isAudioActive = Boolean(audio && analyser && !audio.paused && this.state === 'playing');

    let bass = 0;
    let mids = 0;
    let highs = 0;
    let energy = 0;
    let beatDetected = false;

    if (audio && analyser && !audio.paused && this.state === 'playing' && this.frequencyData && this.timeDomainData) {
      analyser.getByteFrequencyData(this.frequencyData);
      analyser.getByteTimeDomainData(this.timeDomainData);

      const bassEnd = Math.floor(this.frequencyData.length * 0.08);
      const midsEnd = Math.floor(this.frequencyData.length * 0.34);
      const highsEnd = Math.floor(this.frequencyData.length * 0.8);

      bass = averageRange(this.frequencyData, 1, bassEnd);
      mids = averageRange(this.frequencyData, bassEnd, midsEnd);
      highs = averageRange(this.frequencyData, midsEnd, highsEnd);
      energy = clamp(bass * 0.5 + mids * 0.32 + highs * 0.18, 0, 1);

      getBars(this.frequencyData, DEFAULT_BAR_COUNT, this.barBuffer);
      getWaveform(this.timeDomainData, DEFAULT_WAVEFORM_POINTS, this.waveformBuffer);
      beatDetected = this.detectBeat(bass, now);
      this.handleManualBeat(audio.currentTime, now);
    } else {
      const idleTime = now * 0.001;
      bass = 0.14 + Math.sin(idleTime * 1.1) * 0.04;
      mids = 0.12 + Math.sin(idleTime * 1.7 + 1.6) * 0.05;
      highs = 0.1 + Math.cos(idleTime * 2.4 + 0.4) * 0.05;
      energy = clamp(bass * 0.48 + mids * 0.32 + highs * 0.2, 0, 1);
      for (let i = 0; i < this.barBuffer.length; i += 1) {
        const swing = Math.sin(idleTime * (1.2 + i * 0.035) + i * 0.42) * 0.5 + 0.5;
        this.barBuffer[i] = clamp(0.08 + swing * (0.18 + bass * 0.22), 0, 1);
      }
      for (let i = 0; i < this.waveformBuffer.length; i += 1) {
        this.waveformBuffer[i] = Math.sin(idleTime * 1.8 + i * 0.26) * (0.08 + highs * 0.14);
      }
    }

    const smoothAlpha = clamp(0.18 / dtNorm, 0.08, 0.26);
    this.smoothedBass = lerp(this.smoothedBass, bass, smoothAlpha);
    this.smoothedMids = lerp(this.smoothedMids, mids, smoothAlpha * 0.92);
    this.smoothedHighs = lerp(this.smoothedHighs, highs, smoothAlpha * 0.88);
    this.smoothedEnergy = lerp(this.smoothedEnergy, energy, smoothAlpha * 0.85);

    for (let i = 0; i < this.smoothedBars.length; i += 1) {
      this.smoothedBars[i] = lerp(this.smoothedBars[i], this.barBuffer[i] ?? 0, 0.22);
    }
    for (let i = 0; i < this.smoothedWaveform.length; i += 1) {
      this.smoothedWaveform[i] = lerp(this.smoothedWaveform[i], this.waveformBuffer[i] ?? 0, 0.28);
    }

    this.beatPulse = Math.max(0, this.beatPulse - 0.042 * dtNorm);
    this.downbeatPulse = Math.max(0, this.downbeatPulse - 0.03 * dtNorm);
    this.manualBeatPulse = Math.max(0, this.manualBeatPulse - 0.05 * dtNorm);

    const currentTime = this.getCurrentTime();
    const duration = this.getDuration();
    const progress = duration > 0 ? clamp(currentTime / duration, 0, 1) : 0;
    const sectionData = detectSection(progress, this.smoothedBass, this.smoothedEnergy);
    const downbeat = clamp(this.downbeatPulse + this.manualBeatPulse * 0.35, 0, 1.5);
    const reactorPulse = clamp(this.smoothedBass * 0.72 + this.beatPulse * 0.8 + this.manualBeatPulse * 0.95, 0, 1.6);
    const logoPulse = clamp(this.smoothedBass * 0.42 + this.beatPulse * 0.45 + this.manualBeatPulse * 0.55, 0, 1.3);
    const backgroundGlow = clamp(this.smoothedBass * 0.34 + this.smoothedMids * 0.22 + reactorPulse * 0.24, 0, 1.2);
    const bloom = clamp(this.smoothedBass * 0.28 + this.smoothedHighs * 0.16 + this.manualBeatPulse * 0.5, 0, 1.3);
    const particleBurst = clamp(this.smoothedMids * 0.46 + this.manualBeatPulse * 0.75 + this.beatPulse * 0.28, 0, 1.4);
    const uiFlicker = clamp(this.smoothedMids * 0.4 + this.smoothedHighs * 0.22, 0, 1);
    const scanlineIntensity = clamp(this.smoothedHighs * 0.7 + this.beatPulse * 0.15, 0, 1.1);
    const glitchIntensity = clamp(this.smoothedHighs * 0.42 + this.manualBeatPulse * 0.58, 0, 1.15);

    this.frameCache = {
      bars: this.smoothedBars,
      waveform: this.smoothedWaveform,
      beatPulse: clamp(this.beatPulse + this.manualBeatPulse * 0.55, 0, 1.5),
      beatPhase: clamp(1 - reactorPulse * 0.6, 0, 1),
      downbeatPulse: downbeat,
      beatDetected,
      manualBeatPulse: this.manualBeatPulse,
      bass: this.smoothedBass,
      mids: this.smoothedMids,
      highs: this.smoothedHighs,
      energy: this.smoothedEnergy,
      reactorPulse,
      logoPulse,
      backgroundGlow,
      bloom,
      particleBurst,
      uiFlicker,
      scanlineIntensity,
      glitchIntensity,
      currentTime,
      duration,
      progress,
      section: sectionData.key,
      sectionLabel: sectionData.label,
      breakActive: false,
      breakRemaining: 0,
      loopCount: this.loopCount,
      formattedCurrentTime: formatTime(currentTime),
      formattedDuration: formatTime(duration),
      paused: !isAudioActive,
      volume: this.currentGain,
    };
    return this.frameCache;
  }

  private ensureAudioGraph(): void {
    if (!this.audio) return;
    if (this.audioContext && this.sourceNode && this.analyserNode && this.gainNode) return;

    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    const context = this.audioContext ?? new AudioContextCtor();
    const source = this.sourceNode ?? context.createMediaElementSource(this.audio);
    const analyser = this.analyserNode ?? context.createAnalyser();
    const gainNode = this.gainNode ?? context.createGain();

    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = SMOOTHING_TIME_CONSTANT;
    gainNode.gain.value = this.currentGain;

    source.disconnect();
    analyser.disconnect();
    gainNode.disconnect();

    source.connect(analyser);
    analyser.connect(gainNode);
    gainNode.connect(context.destination);

    this.audioContext = context;
    this.sourceNode = source;
    this.analyserNode = analyser;
    this.gainNode = gainNode;
    this.frequencyData = new Uint8Array(analyser.frequencyBinCount);
    this.timeDomainData = new Uint8Array(analyser.fftSize);
  }

  private detectBeat(bassPower: number, nowMs: number): boolean {
    const delta = bassPower - this.prevBass;
    const relativeThreshold = Math.max(this.prevBass * 0.14, BEAT_SPIKE_THRESHOLD);
    const ready = nowMs - this.lastBeatAt > BEAT_COOLDOWN_MS;
    const isBeat = ready && bassPower > 0.18 && delta > relativeThreshold;

    this.prevBass = lerp(this.prevBass, bassPower, 0.48);
    this.lastBeatDetected = isBeat;

    if (isBeat) {
      this.lastBeatAt = nowMs;
      this.beatPulse = 1;
      if (bassPower > 0.42 || delta > relativeThreshold * 1.35) {
        this.downbeatPulse = 1;
      }
    }

    return isBeat;
  }

  private handleManualBeat(currentTime: number, nowMs: number): void {
    if (MENU_BEAT_MAP_SECONDS.length === 0) return;

    while (this.manualBeatCursor < MENU_BEAT_MAP_SECONDS.length) {
      const target = MENU_BEAT_MAP_SECONDS[this.manualBeatCursor];
      if (currentTime + MANUAL_BEAT_WINDOW < target) break;
      if (Math.abs(currentTime - target) <= MANUAL_BEAT_WINDOW) {
        this.manualBeatPulse = 1;
        this.beatPulse = Math.max(this.beatPulse, 0.9);
        this.downbeatPulse = Math.max(this.downbeatPulse, 0.82);
        this.lastBeatAt = nowMs;
      }
      this.manualBeatCursor += 1;
    }
  }

  private readonly handleEnded = (): void => {
    void this.advanceTrack();
  };

  private async advanceTrack(): Promise<void> {
    const audio = this.audio;
    if (!audio) return;

    const nextIndex = (this.trackIndex + 1) % MENU_TRACK_URLS.length;
    const wrappedPlaylist = nextIndex === 0 && MENU_TRACK_URLS.length > 0;

    this.trackIndex = nextIndex;
    if (wrappedPlaylist) {
      this.loopCount += 1;
    }

    this.manualBeatCursor = 0;
    this.lastCurrentTime = 0;
    this.prevBass = 0;
    this.beatPulse = 0;
    this.downbeatPulse = 0;
    this.manualBeatPulse = 0;

    audio.src = MENU_TRACK_URLS[this.trackIndex];
    audio.currentTime = 0;
    audio.load();

    if (!this.wantsPlayback) {
      this.state = 'paused';
      return;
    }

    try {
      await audio.play();
      this.state = 'playing';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        this.state = 'paused';
        return;
      }
      throw error;
    }
  }

  private getCurrentTime(): number {
    const current = this.audio?.currentTime ?? 0;
    if (current + 0.25 < this.lastCurrentTime) {
      this.loopCount += 1;
      this.manualBeatCursor = 0;
    }
    this.lastCurrentTime = current;
    return clamp(current, 0, this.getDuration());
  }

  private getDuration(): number {
    const duration = this.audio?.duration;
    return Number.isFinite(duration) && duration && duration > 0 ? duration : FALLBACK_DURATION_SECONDS;
  }

  private fadeAudio(targetVolume: number, durationMs: number, token = ++this.fadeToken): Promise<void> {
    if (!this.gainNode) {
      this.currentGain = clamp(targetVolume, 0, 1);
      return Promise.resolve();
    }
    if (durationMs <= 0) {
      this.currentGain = clamp(targetVolume, 0, 1);
      this.gainNode.gain.value = this.currentGain;
      return Promise.resolve();
    }

    const startGain = this.gainNode.gain.value;
    const delta = clamp(targetVolume, 0, 1) - startGain;
    const startedAt = performance.now();

    return new Promise((resolve) => {
      const step = (now: number) => {
        if (!this.gainNode || token !== this.fadeToken) {
          resolve();
          return;
        }

        const progress = clamp((now - startedAt) / durationMs, 0, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        this.currentGain = clamp(startGain + delta * eased, 0, 1);
        this.gainNode.gain.value = this.currentGain;

        if (progress >= 1) {
          this.fadeRafId = null;
          resolve();
          return;
        }

        this.fadeRafId = window.requestAnimationFrame(step);
      };

      this.fadeRafId = window.requestAnimationFrame(step);
    });
  }

  private cancelFade(): void {
    this.fadeToken += 1;
    if (this.fadeRafId != null) {
      window.cancelAnimationFrame(this.fadeRafId);
      this.fadeRafId = null;
    }
  }
}
