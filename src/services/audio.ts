export interface AudioSettings {
  music: number;
  sound: number;
  quiet: boolean;
}

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

/** One lazily unlocked context for the original synthesized music and effects. */
export class AudioService {
  private context: AudioContext | null = null;
  private musicMaster: GainNode | null = null;
  private settings: AudioSettings = { music: 24, sound: 55, quiet: false };
  private paused = false;

  async unlock(): Promise<void> {
    if (typeof window === 'undefined' || document.hidden) return;
    const Constructor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
    if (!Constructor) return;
    this.paused = false;
    try {
      if (!this.context) {
        const context = new Constructor();
        this.context = context;
        this.musicMaster = context.createGain();
        this.musicMaster.gain.value = 0;
        this.musicMaster.connect(context.destination);
        for (const [hz, level] of [[110, 0.11], [164.81, 0.06], [220, 0.025]]) {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.type = 'sine';
          oscillator.frequency.value = hz;
          gain.gain.value = level;
          oscillator.connect(gain);
          gain.connect(this.musicMaster);
          oscillator.start();
        }
      }
      if (!this.paused && !document.hidden && this.context.state === 'suspended') await this.context.resume();
      this.syncMusic();
    } catch {
      // Unsupported or policy-blocked audio must not interrupt gameplay.
    }
  }

  setSettings(settings: AudioSettings): void {
    const volume = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
    this.settings = { music: volume(settings.music), sound: volume(settings.sound), quiet: settings.quiet };
    this.syncMusic();
  }

  play(dragon: 'fire' | 'ice' | 'poison'): void {
    const context = this.context;
    if (!context || context.state !== 'running' || document.hidden || this.paused || this.settings.quiet || this.settings.sound === 0) return;
    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = dragon === 'ice' ? 'sine' : 'triangle';
      oscillator.frequency.value = dragon === 'fire' ? 480 : dragon === 'ice' ? 780 : 300;
      gain.gain.setValueAtTime(0.035 * this.settings.sound / 100, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.08);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      oscillator.start();
      oscillator.stop(context.currentTime + 0.09);
    } catch {
      // A browser closing/suspending audio is harmless to the simulation.
    }
  }

  async suspend(): Promise<void> {
    this.paused = true;
    try { await this.context?.suspend(); } catch { /* Browser audio policy. */ }
  }

  async resume(): Promise<void> {
    if (typeof document !== 'undefined' && document.hidden) return;
    this.paused = false;
    // Resume never creates a context; first creation requires a user gesture.
    try { await this.context?.resume(); this.syncMusic(); } catch { /* Await next gesture. */ }
  }

  private syncMusic(): void {
    if (!this.context || !this.musicMaster) return;
    this.musicMaster.gain.setTargetAtTime(this.settings.music / 100 * 0.12, this.context.currentTime, 0.25);
  }
}
