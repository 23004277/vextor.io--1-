export type BackgroundMusicState = 'stopped' | 'playing' | 'paused';

export type BackgroundMusicSection =
  | 'warmup'
  | 'drive'
  | 'surge'
  | 'drop'
  | 'breakdown'
  | 'finale'
  | 'cooldown';

export type BackgroundMusicVisualizerFrame = {
  bars: number[];
  beatPulse: number;
  beatPhase: number;
  downbeatPulse: number;
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
};

const MENU_TRACK_URL = new URL('./musicasset/Final_Sector_Charge.mp3', import.meta.url).href;
const TRACK_DURATION_SECONDS = 175;
const BPM = 128;
const BEATS_PER_BAR = 4;
const FADE_IN_MS = 1500;
const FADE_OUT_MS = 1250;
const LOOP_RESET_FADE_MS = 220;
const REFRESH_BREAK_MS = 3000;
const REFRESH_BREAK_AFTER_LOOPS = 3;

const SECTION_TIMELINE: Array<{ start: number; end: number; key: BackgroundMusicSection; label: string; energy: number }> = [
  { start: 0, end: 22, key: 'warmup', label: 'Signal Warmup', energy: 0.42 },
  { start: 22, end: 52, key: 'drive', label: 'Charge Run', energy: 0.58 },
  { start: 52, end: 74, key: 'surge', label: 'Vector Surge', energy: 0.72 },
  { start: 74, end: 112, key: 'drop', label: 'Final Sector Drop', energy: 0.98 },
  { start: 112, end: 136, key: 'breakdown', label: 'Cooling Break', energy: 0.46 },
  { start: 136, end: 165, key: 'finale', label: 'Overdrive Finale', energy: 1.06 },
  { start: 165, end: TRACK_DURATION_SECONDS, key: 'cooldown', label: 'Exit Drift', energy: 0.38 },
];

export class BackgroundMusic {
  private audio: HTMLAudioElement | null = null;
  private state: BackgroundMusicState = 'stopped';
  private volume = 1;
  private fadeRafId: number | null = null;
  private monitorRafId: number | null = null;
  private refreshBreakTimeoutId: number | null = null;
  private fadeToken = 0;
  private wantsPlayback = false;
  private inRefreshBreak = false;
  private refreshBreakEndsAt = 0;
  private completedLoops = 0;
  private trackBoundaryPending = false;

  init(): void {
    if (this.audio) return;

    const audio = new Audio(MENU_TRACK_URL);
    audio.loop = false;
    audio.preload = 'auto';
    audio.volume = 0;
    audio.muted = false;
    audio.currentTime = 0;
    audio.setAttribute('playsinline', 'true');
    audio.crossOrigin = 'anonymous';

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
    this.inRefreshBreak = false;
    this.refreshBreakEndsAt = 0;
    this.clearRefreshBreak();
    this.cancelFade();

    if (audio.currentTime >= TRACK_DURATION_SECONDS || audio.ended) {
      audio.currentTime = 0;
    }

    audio.muted = false;

    if (audio.paused) {
      audio.volume = 0;
      try {
        await audio.play();
      } catch (error) {
        if (error instanceof DOMException && error.name === 'NotAllowedError') {
          return;
        }
        throw error;
      }
    }

    this.state = 'playing';
    this.ensureMonitorLoop();
    await this.fadeTo(this.volume, FADE_IN_MS);
  }

  pause(): void {
    const audio = this.audio;
    this.wantsPlayback = false;
    this.inRefreshBreak = false;
    this.refreshBreakEndsAt = 0;
    this.clearRefreshBreak();

    if (!audio) {
      this.state = 'paused';
      return;
    }

    const token = ++this.fadeToken;
    this.state = 'paused';

    void this.fadeTo(0, FADE_OUT_MS, token).then(() => {
      if (!this.audio || token !== this.fadeToken) return;
      this.audio.pause();
      this.stopMonitorLoop();
    });
  }

  stop(): void {
    this.wantsPlayback = false;
    this.inRefreshBreak = false;
    this.refreshBreakEndsAt = 0;
    this.completedLoops = 0;
    this.trackBoundaryPending = false;
    this.cancelFade();
    this.stopMonitorLoop();
    this.clearRefreshBreak();

    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio.src = '';
      this.audio.load();
    }

    this.audio = null;
    this.state = 'stopped';
  }

  setVolume(volume: number): void {
    this.volume = this.clamp(volume, 0, 1);
    if (!this.audio) return;

    if (this.state === 'playing' && !this.audio.paused) {
      this.audio.volume = this.volume;
    } else if (this.state !== 'playing') {
      this.audio.volume = 0;
    }
  }

  getState(): BackgroundMusicState {
    return this.state;
  }

  getVisualizerFrame(): BackgroundMusicVisualizerFrame {
    const currentTime = this.getCurrentTime();
    const duration = TRACK_DURATION_SECONDS;
    const progress = duration > 0 ? currentTime / duration : 0;
    const sectionData = this.getSectionForTime(currentTime);
    const beatProgress = this.getBeatProgress(currentTime);
    const barProgress = this.getBarProgress(currentTime);
    const pulseBase = Math.max(0, Math.cos(beatProgress * Math.PI * 2));
    const beatPhase = 1 - Math.min(1, beatProgress);
    const sharpBeat = Math.pow(Math.max(0, 1 - beatProgress * 1.8), 2.6);
    const downbeatProgress = Math.min(barProgress, 1 - barProgress) * 2;
    const downbeatPulse = Math.pow(Math.max(0, 1 - downbeatProgress * 1.35), 3.2);
    const beatPulse = this.clamp(sectionData.energy * 0.35 + pulseBase * 0.28 + sharpBeat * 0.52 + downbeatPulse * 0.24, 0, 1.35);
    const bars = Array.from({ length: 28 }, (_, index) => {
      const lanePhase = currentTime * (2.2 + (index % 5) * 0.19) + index * 0.53;
      const groove = Math.sin(lanePhase) * 0.22 + Math.cos(lanePhase * 0.52 + beatProgress * Math.PI * 2) * 0.12;
      const beatLaneOffset = ((index % 4) / 4) * 0.18;
      const beatAccent = Math.max(0, sharpBeat - beatLaneOffset) * (index % 2 === 0 ? 0.5 : 0.34);
      const barAccent = index % 4 === 0 ? downbeatPulse * 0.48 : index % 2 === 0 ? downbeatPulse * 0.18 : 0;
      const lift = sectionData.energy * (0.52 + (index % 6) * 0.04);
      const sweep = Math.max(0, Math.sin(barProgress * Math.PI * 2 + index * 0.41)) * 0.18;
      return this.clamp(0.09 + lift + groove + beatAccent + barAccent + sweep, 0.06, 1.12);
    });

    return {
      bars,
      beatPulse,
      beatPhase,
      downbeatPulse,
      currentTime,
      duration,
      progress,
      section: sectionData.key,
      sectionLabel: sectionData.label,
      breakActive: this.inRefreshBreak,
      breakRemaining: this.getBreakRemaining(),
      loopCount: this.completedLoops,
      formattedCurrentTime: this.formatTime(currentTime),
      formattedDuration: this.formatTime(duration),
    };
  }

  private getCurrentTime(): number {
    return this.clamp(this.audio?.currentTime ?? 0, 0, TRACK_DURATION_SECONDS);
  }

  private getSectionForTime(time: number) {
    return SECTION_TIMELINE.find((section) => time >= section.start && time < section.end) ?? SECTION_TIMELINE[SECTION_TIMELINE.length - 1];
  }

  private getBeatProgress(time: number): number {
    const beats = time / (60 / BPM);
    return beats - Math.floor(beats);
  }

  private getBarProgress(time: number): number {
    const bars = time / ((60 / BPM) * BEATS_PER_BAR);
    return bars - Math.floor(bars);
  }

  private getBreakRemaining(): number {
    if (!this.inRefreshBreak) return 0;
    return Math.max(0, (this.refreshBreakEndsAt - performance.now()) / 1000);
  }

  private formatTime(totalSeconds: number): string {
    const clamped = Math.max(0, Math.floor(totalSeconds));
    const minutes = Math.floor(clamped / 60);
    const seconds = clamped % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  private ensureMonitorLoop(): void {
    if (this.monitorRafId != null) return;

    const tick = () => {
      if (!this.audio) {
        this.monitorRafId = null;
        return;
      }

      if (this.state === 'playing' && !this.inRefreshBreak && this.audio.currentTime >= TRACK_DURATION_SECONDS - 0.04) {
        void this.handleTrackBoundary();
      }

      this.monitorRafId = window.requestAnimationFrame(tick);
    };

    this.monitorRafId = window.requestAnimationFrame(tick);
  }

  private stopMonitorLoop(): void {
    if (this.monitorRafId != null) {
      window.cancelAnimationFrame(this.monitorRafId);
      this.monitorRafId = null;
    }
  }

  private async handleTrackBoundary(): Promise<void> {
    if (!this.audio || this.trackBoundaryPending) return;
    this.trackBoundaryPending = true;

    try {
      this.completedLoops += 1;
      if (!this.wantsPlayback) {
        this.audio.pause();
        return;
      }

      if (this.completedLoops >= REFRESH_BREAK_AFTER_LOOPS) {
        await this.fadeTo(0, FADE_OUT_MS);
        if (!this.audio) return;
        this.audio.pause();
        this.audio.currentTime = 0;
        this.inRefreshBreak = true;
        this.refreshBreakEndsAt = performance.now() + REFRESH_BREAK_MS;
        this.state = 'paused';
        this.refreshBreakTimeoutId = window.setTimeout(() => {
          this.refreshBreakTimeoutId = null;
          this.inRefreshBreak = false;
          this.refreshBreakEndsAt = 0;
          this.completedLoops = 0;
          if (!this.wantsPlayback || !this.audio) return;
          void this.resume();
        }, REFRESH_BREAK_MS);
        return;
      }

      this.audio.currentTime = 0;
      this.audio.volume = Math.min(this.audio.volume, this.volume * 0.35);
      if (this.audio.paused) {
        try {
          await this.audio.play();
        } catch {
          return;
        }
      }
      this.state = 'playing';
      await this.fadeTo(this.volume, LOOP_RESET_FADE_MS);
    } finally {
      this.trackBoundaryPending = false;
    }
  }

  private clearRefreshBreak(): void {
    if (this.refreshBreakTimeoutId != null) {
      window.clearTimeout(this.refreshBreakTimeoutId);
      this.refreshBreakTimeoutId = null;
    }
  }

  private cancelFade(): void {
    this.fadeToken += 1;
    if (this.fadeRafId != null) {
      window.cancelAnimationFrame(this.fadeRafId);
      this.fadeRafId = null;
    }
  }

  private fadeTo(targetVolume: number, durationMs: number, token = this.fadeToken): Promise<void> {
    const audio = this.audio;
    if (!audio) return Promise.resolve();

    if (durationMs <= 0) {
      audio.volume = this.clamp(targetVolume, 0, 1);
      return Promise.resolve();
    }

    const startVolume = audio.volume;
    const delta = this.clamp(targetVolume, 0, 1) - startVolume;
    const startedAt = performance.now();

    return new Promise((resolve) => {
      const step = (now: number) => {
        if (!this.audio || token !== this.fadeToken) {
          resolve();
          return;
        }

        const progress = this.clamp((now - startedAt) / durationMs, 0, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        this.audio.volume = this.clamp(startVolume + delta * eased, 0, 1);

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

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
