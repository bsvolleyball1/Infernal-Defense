import { describe, expect, it } from 'vitest';
import { BestiaryStore } from '../src/app/bestiary-store';
import { SettingsController } from '../src/app/settings-controller';
import { reportWrite } from '../src/app/write-report';
import type { Settings, WriteResult } from '../src/services/storage';

const failure: WriteResult = { ok: false, code: 'failure', message: 'nope' };

describe('reportWrite', () => {
  it('reports only failed writes', () => {
    const shown: string[] = [];
    expect(reportWrite({ ok: true }, (m) => shown.push(m))).toBe(true);
    expect(reportWrite(failure, (m) => shown.push(m))).toBe(false);
    expect(shown).toEqual(['nope']);
  });
});

describe('BestiaryStore', () => {
  it('merges discoveries without duplicates and persists once per record', () => {
    const writes: string[][] = [];
    const store = new BestiaryStore(
      {
        readBestiary: () => ['imp'],
        writeBestiary: (value) => {
          writes.push(value);
          return { ok: true };
        },
      },
      () => {},
    );
    store.record('imp', 'troll');
    expect(store.list).toEqual(['imp', 'troll']);
    expect(writes).toEqual([['imp', 'troll']]);
  });
});

describe('SettingsController', () => {
  function build() {
    const log: string[] = [];
    let written: Settings | null = null;
    const controller = new SettingsController(
      { music: 50, sound: 50, quiet: false },
      {
        writeSettings: (value) => {
          written = value;
          return { ok: true };
        },
      },
      { setSettings: () => log.push('audio'), unlock: () => log.push('unlock') },
      { renderSoundToggle: () => log.push('toggle'), renderOptions: () => log.push('options') },
      () => log.push('report'),
    );
    return { controller, log, written: () => written };
  }

  it('toggles quiet, applies it to audio, shows it and persists it', () => {
    const { controller, log, written } = build();
    controller.toggleQuiet();
    expect(controller.settings.quiet).toBe(true);
    expect(written()?.quiet).toBe(true);
    expect(log).toEqual(['audio', 'unlock', 'report', 'toggle']);
  });

  it('updates a single volume field', () => {
    const { controller } = build();
    controller.setVolume('music', 20);
    expect(controller.settings).toEqual({ music: 20, sound: 50, quiet: false });
  });
});
