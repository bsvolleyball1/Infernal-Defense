import type { GameState } from '../game/types';
import type { JourneyProgress } from '../game/journey';
import { readMigratedSave } from './migrations/pipeline';
import { kinds, validateSave } from './save-schema';
import type { SaveDataV2 } from './save-schema';
import { boolean, integer, number, object, own, storageMessage } from './validation/primitives';

export type { SaveDataV2 } from './save-schema';

export type SlotResult =
  { status: 'empty' } | { status: 'valid'; data: SaveDataV2; migrated: boolean } | { status: 'error'; message: string };
export type WriteFailureCode = 'conflict' | 'quota' | 'blocked' | 'failure';
export type WriteResult = { ok: true } | { ok: false; code: WriteFailureCode; message: string };
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export interface Settings {
  music: number;
  sound: number;
  quiet: boolean;
}

const prefix = 'infernalDefense.';
const defaults: Settings = { music: 24, sound: 55, quiet: false };

function settings(value: unknown): Settings {
  object(value, 'Settings');
  const result = { ...defaults };
  for (const key of ['music', 'sound'] as const) {
    if (own(value, key)) {
      number(value[key], key, 0, 100);
      result[key] = value[key];
    }
  }
  if (own(value, 'quiet')) {
    boolean(value.quiet, 'Quiet');
    result.quiet = value.quiet;
  }
  return result;
}

function writeFailure(operation: string, error: unknown): WriteResult {
  let code: WriteFailureCode = 'failure';
  if (error instanceof Error && error.name === 'QuotaExceededError') code = 'quota';
  if (error instanceof Error && error.name === 'SecurityError') code = 'blocked';
  return { ok: false, code, message: `${operation}: ${storageMessage(error)}` };
}

function slot(index: number): string {
  integer(index, 'Save slot', 0, 2);
  return `${prefix}save.${index}`;
}

export class SaveRepository {
  private readonly revisions = new Map<number, string | null>();
  constructor(private readonly storage: KeyValueStorage) {}

  /** adopt=true is reserved for explicitly loading/replacing a journey. */
  readSlot(index: number, adopt = false): SlotResult {
    try {
      const raw = this.storage.getItem(slot(index));
      if (raw === null) {
        if (adopt || !this.revisions.has(index)) this.revisions.set(index, null);
        return { status: 'empty' };
      }
      const value: unknown = JSON.parse(raw);
      object(value, 'Save');
      const read = readMigratedSave(value);
      if (adopt || !this.revisions.has(index)) this.revisions.set(index, raw);
      return { status: 'valid', data: read.data, migrated: read.migrated };
    } catch (error) {
      return { status: 'error', message: `Could not read this save: ${storageMessage(error)}` };
    }
  }

  saveSlot(index: number, state: GameState, journey?: JourneyProgress): WriteResult {
    try {
      const key = slot(index);
      // Preserve campaign metadata if a compatibility caller updates only battle state.
      const previous = this.revisions.get(index);
      const progress = journey ?? (previous ? (JSON.parse(previous) as SaveDataV2).journey : undefined);
      const data: SaveDataV2 = { version: 2, savedAt: Date.now(), state, ...(progress ? { journey: progress } : {}) };
      validateSave(data);
      const raw = JSON.stringify(data);
      validateSave(JSON.parse(raw));
      const expected = this.revisions.has(index) ? this.revisions.get(index) : null;
      if (this.storage.getItem(key) !== expected) {
        return {
          ok: false,
          code: 'conflict',
          message:
            'Could not save journey: This slot changed in another tab. Reload this app and use Load Save to continue the newer journey before saving.',
        };
      }
      this.storage.setItem(key, raw);
      this.revisions.set(index, raw);
      return { ok: true };
    } catch (error) {
      return writeFailure('Could not save journey', error);
    }
  }

  readSettings(): Settings {
    try {
      const raw = this.storage.getItem(`${prefix}settings`);
      return raw === null ? { ...defaults } : settings(JSON.parse(raw));
    } catch {
      return { ...defaults };
    }
  }

  writeSettings(value: Settings): WriteResult {
    try {
      object(value, 'Settings');
      number(value.music, 'Music volume', 0, 100);
      number(value.sound, 'Sound volume', 0, 100);
      boolean(value.quiet, 'Quiet');
      return this.write(`${prefix}settings`, settings(value), 'Could not save settings');
    } catch (error) {
      return writeFailure('Could not save settings', error);
    }
  }

  readBestiary(): string[] {
    try {
      const raw = this.storage.getItem(`${prefix}bestiary`);
      if (raw === null) return [];
      const value: unknown = JSON.parse(raw);
      kinds(value, false);
      return [...new Set(value)];
    } catch {
      return [];
    }
  }

  writeBestiary(value: string[]): WriteResult {
    try {
      kinds(value, false);
      return this.write(`${prefix}bestiary`, [...new Set(value)], 'Could not save bestiary');
    } catch (error) {
      return writeFailure('Could not save bestiary', error);
    }
  }

  private write(key: string, value: unknown, operation: string): WriteResult {
    try {
      this.storage.setItem(key, JSON.stringify(value));
      return { ok: true };
    } catch (error) {
      return writeFailure(operation, error);
    }
  }
}
