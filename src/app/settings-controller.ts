import type { Settings, WriteResult } from '../services/storage';

export interface SettingsRepository {
  writeSettings(value: Settings): WriteResult;
}

export interface SettingsView {
  renderSoundToggle(settings: Settings): void;
  renderOptions(settings: Settings): void;
}

export interface SettingsAudio {
  setSettings(settings: Settings): void;
  unlock(): unknown;
}

/** Owns player settings: applies them to audio, shows them, and persists them. */
export class SettingsController {
  constructor(
    private current: Settings,
    private readonly repository: SettingsRepository,
    private readonly audio: SettingsAudio,
    private readonly view: SettingsView,
    private readonly report: (result: WriteResult) => void,
  ) {}

  get settings(): Settings {
    return this.current;
  }

  /** Apply the stored settings at startup without writing them back. */
  init(): void {
    this.audio.setSettings(this.current);
    this.view.renderSoundToggle(this.current);
  }

  toggleQuiet(): void {
    this.update({ quiet: !this.current.quiet });
    this.view.renderSoundToggle(this.current);
  }

  setVolume(field: 'music' | 'sound', value: number): void {
    this.update({ [field]: value });
    this.view.renderOptions(this.current);
  }

  private update(change: Partial<Settings>): void {
    this.current = { ...this.current, ...change };
    this.audio.setSettings(this.current);
    void this.audio.unlock();
    this.report(this.repository.writeSettings(this.current));
  }
}
