// Background Music placeholder (Web Audio API scaffold)
// Build your own soundtrack logic here.

export type BackgroundMusicState = 'stopped' | 'playing' | 'paused';

export class BackgroundMusic {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private state: BackgroundMusicState = 'stopped';
  private bpm = 110;

  init(): void {
    if (this.audioContext) return;
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new Ctx();

    this.masterGain = this.audioContext.createGain();
    this.musicBus = this.audioContext.createGain();

    this.masterGain.gain.value = 0.25;
    this.musicBus.gain.value = 1.0;

    this.musicBus.connect(this.masterGain);
    this.masterGain.connect(this.audioContext.destination);
  }

  async start(): Promise<void> {
    this.init();
    if (!this.audioContext) return;
    if (this.audioContext.state === 'suspended') await this.audioContext.resume();
    this.state = 'playing';

    // Placeholder tone (replace with your sequencing/pattern system)
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 110;
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(this.musicBus!);
    osc.start();

    const now = this.audioContext.currentTime;
    gain.gain.linearRampToValueAtTime(0.02, now + 0.4);
    gain.gain.linearRampToValueAtTime(0.0001, now + 1.2);
    osc.stop(now + 1.25);
  }

  pause(): void {
    this.state = 'paused';
    if (this.audioContext && this.audioContext.state === 'running') {
      this.audioContext.suspend().catch(() => undefined);
    }
  }

  async resume(): Promise<void> {
    if (!this.audioContext) return;
    await this.audioContext.resume();
    this.state = 'playing';
  }

  stop(): void {
    this.state = 'stopped';
    if (this.audioContext) {
      this.audioContext.close().catch(() => undefined);
      this.audioContext = null;
      this.masterGain = null;
      this.musicBus = null;
    }
  }

  setVolume(volume: number): void {
    if (!this.masterGain) return;
    this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
  }

  setBpm(nextBpm: number): void {
    this.bpm = Math.max(40, Math.min(260, nextBpm));
  }

  getBpm(): number {
    return this.bpm;
  }

  getState(): BackgroundMusicState {
    return this.state;
  }
}
