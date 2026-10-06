import type { GameState } from '../game/types';
import { createInitialState } from '../game/state';
import { dragons, map, monsters } from '../content/catalog';

export interface SaveDataV2 {
  version: 2;
  savedAt: number;
  state: GameState;
}

export type SlotResult =
  | { status: 'empty' }
  | { status: 'valid'; data: SaveDataV2; migrated: boolean }
  | { status: 'error'; message: string };
export type WriteFailureCode = 'conflict' | 'quota' | 'blocked' | 'failure';
export type WriteResult = { ok: true } | { ok: false; code: WriteFailureCode; message: string };
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export interface Settings { music: number; sound: number; quiet: boolean }

const prefix = 'infernalDefense.';
const defaults: Settings = { music: 24, sound: 55, quiet: false };
type RecordValue = Record<string, unknown>;

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function object(value: unknown, name: string): asserts value is RecordValue {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), `${name} must be an object.`);
}
function number(value: unknown, name: string, min = 0, max = Number.MAX_SAFE_INTEGER): asserts value is number {
  check(typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max, `${name} is invalid.`);
}
function integer(value: unknown, name: string, min = 0, max = Number.MAX_SAFE_INTEGER): asserts value is number {
  number(value, name, min, max);
  check(Number.isSafeInteger(value), `${name} must be an integer.`);
}
function boolean(value: unknown, name: string): asserts value is boolean {
  check(typeof value === 'boolean', `${name} must be a boolean.`);
}
function array(value: unknown, name: string): asserts value is unknown[] {
  check(Array.isArray(value), `${name} must be an array.`);
}
function choice(value: unknown, choices: readonly string[], name: string): asserts value is string {
  check(typeof value === 'string' && choices.includes(value), `${name} is unknown.`);
}
function own(value: RecordValue, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}
function monster(value: unknown): void { choice(value, Object.keys(monsters), 'Monster kind'); }
function dragon(value: unknown): void { choice(value, Object.keys(dragons), 'Dragon type'); }
function progress(value: unknown): void { number(value, 'Path progress', 0, map.path.length - 1); }
function kinds(value: unknown, unique = true): asserts value is string[] {
  array(value, 'Bestiary');
  for (const kind of value) monster(kind);
  if (unique) check(new Set(value).size === value.length, 'Bestiary contains duplicate kinds.');
}
function tower(value: unknown, legacy = false): void {
  if (value === null) return;
  object(value, 'Tower');
  dragon(value.type);
  integer(value.level, 'Tower level', 1);
  if (legacy) {
    if (own(value, 'last')) number(value.last, 'Legacy tower timer');
  } else number(value.cooldown, 'Tower cooldown');
}
function towers(value: unknown, legacy = false): asserts value is unknown[] {
  array(value, 'Towers');
  check(value.length === 5, 'Exactly five tower slots are required.');
  for (const item of value) tower(item, legacy);
}
function egg(value: unknown, legacy = false): asserts value is RecordValue {
  object(value, 'Egg');
  integer(value.id, 'Egg id', 1, 5);
  choice(value.status, ['nest', 'carried', 'dropped', 'escaped'], 'Egg status');
  if (value.progress !== null) progress(value.progress);
  if (value.carrier !== null) {
    // Original enemy ids were Math.random(), not integer entity ids.
    if (legacy) number(value.carrier, 'Legacy egg carrier');
    else integer(value.carrier, 'Egg carrier', 1);
  }
  if (value.status === 'carried') {
    check(value.carrier !== null, 'A carried egg requires a carrier.');
    if (!legacy) check(value.progress === null, 'A carried egg cannot have dropped progress.');
  } else check(value.carrier === null, 'Only carried eggs can have a carrier.');
  if (value.status === 'dropped') check(value.progress !== null, 'A dropped egg requires progress.');
  if (value.status === 'nest') check(value.progress === null, 'A nest egg cannot have path progress.');
}
function eggs(value: unknown, legacy = false): asserts value is RecordValue[] {
  array(value, 'Eggs');
  check(value.length === 5, 'Exactly five eggs are required.');
  const ids = new Set<number>();
  for (const item of value) {
    egg(item, legacy);
    check(!ids.has(item.id as number), 'Egg ids must be unique.');
    ids.add(item.id as number);
  }
}

function validateState(value: unknown): asserts value is GameState {
  object(value, 'State');
  choice(value.phase, ['ready', 'battle', 'won', 'lost'], 'Phase');
  boolean(value.paused, 'Paused');
  number(value.simulationTime, 'Simulation time');
  check([1, 1.5, 2].includes(value.speed as number), 'Speed is invalid.');
  number(value.gold, 'Gold');
  number(value.bankedGold, 'Banked gold');
  integer(value.wave, 'Wave', 0, 5);
  integer(value.enemiesKilled, 'Enemies killed');
  integer(value.enemiesSummoned, 'Enemies summoned');
  check(value.enemiesKilled <= value.enemiesSummoned, 'Kill count exceeds summoned count.');
  number(value.rewardGold, 'Reward gold');
  boolean(value.rewardsApplied, 'Rewards applied');
  choice(value.activeLevel, ['level1', 'tutorial'], 'Level');
  kinds(value.knownMonsters);
  if (value.selected !== null) integer(value.selected, 'Selected perch', 0, 4);
  if (value.chosen !== null) dragon(value.chosen);
  towers(value.towers);
  check(value.selected === null || value.towers[value.selected as number] !== null, 'Selected perch must contain a tower.');
  eggs(value.eggs);
  array(value.enemies, 'Enemies');
  array(value.projectiles, 'Projectiles');
  array(value.spawnSchedule, 'Spawn schedule');
  integer(value.nextEntityId, 'Next entity id', 6);

  const ids = new Set<number>(value.eggs.map(item => item.id as number));
  const enemies = new Map<number, RecordValue>();
  const claimId = (id: unknown) => {
    integer(id, 'Entity id', 1);
    check(!ids.has(id), 'Entity ids must be unique.');
    check(id < (value.nextEntityId as number), 'Next entity id must exceed existing entity ids.');
    ids.add(id);
    return id;
  };
  for (const enemy of value.enemies) {
    object(enemy, 'Enemy');
    const id = claimId(enemy.id);
    monster(enemy.kind);
    number(enemy.hp, 'Enemy health', Number.MIN_VALUE);
    number(enemy.max, 'Enemy maximum health', Number.MIN_VALUE);
    check(enemy.hp <= enemy.max, 'Enemy health exceeds maximum.');
    number(enemy.spd, 'Enemy speed', Number.MIN_VALUE);
    progress(enemy.progress);
    number(enemy.slow, 'Slow timer');
    number(enemy.poison, 'Poison timer');
    number(enemy.poisonD, 'Poison damage timer');
    if (enemy.carryingEgg !== null) integer(enemy.carryingEgg, 'Carried egg id', 1, 5);
    boolean(enemy.returning, 'Returning');
    boolean(enemy.escaped, 'Escaped');
    boolean(enemy.rewarded, 'Rewarded');
    check(!enemy.escaped && !enemy.rewarded, 'Active enemies cannot be escaped or already rewarded.');
    enemies.set(id, enemy);
  }
  for (const projectile of value.projectiles) {
    object(projectile, 'Projectile');
    claimId(projectile.id);
    number(projectile.x, 'Projectile x', -Number.MAX_SAFE_INTEGER);
    number(projectile.y, 'Projectile y', -Number.MAX_SAFE_INTEGER);
    integer(projectile.targetId, 'Projectile target', 1);
    check(enemies.has(projectile.targetId), 'Projectile target does not exist.');
    dragon(projectile.dragon);
    number(projectile.damage, 'Projectile damage');
    number(projectile.speed, 'Projectile speed', Number.MIN_VALUE);
    integer(projectile.level, 'Projectile level', 1);
  }
  let previousSpawnTime = 0;
  for (const item of value.spawnSchedule) {
    object(item, 'Spawn');
    monster(item.kind);
    number(item.hp, 'Spawn health', Number.MIN_VALUE);
    number(item.spd, 'Spawn speed', Number.MIN_VALUE);
    number(item.at, 'Spawn time');
    check(item.at >= previousSpawnTime, 'Spawn schedule must be ordered by time.');
    previousSpawnTime = item.at;
  }
  for (const item of value.eggs) {
    if (item.status === 'carried') {
      const carrier = enemies.get(item.carrier as number);
      check(carrier && carrier.carryingEgg === item.id && carrier.returning && !carrier.escaped && (carrier.hp as number) > 0,
        'Egg carrier reference is inconsistent.');
    }
  }
  for (const enemy of enemies.values()) {
    if (enemy.carryingEgg !== null) {
      check(value.eggs.some(item => item.id === enemy.carryingEgg && item.status === 'carried' && item.carrier === enemy.id),
        'Enemy carried egg reference is inconsistent.');
    }
  }
  check(value.enemies.length <= value.enemiesSummoned, 'Live enemy count exceeds summoned count.');
  const remaining = value.eggs.filter(item => item.status !== 'escaped').length;
  const terminal = value.phase === 'won' || value.phase === 'lost';
  check(value.rewardsApplied === terminal, 'Reward state does not match phase.');
  if (terminal) {
    check(value.enemies.length === 0 && value.projectiles.length === 0 && value.spawnSchedule.length === 0,
      'A finished run cannot contain active combat.');
    check(value.phase === 'won' ? value.wave === 5 && remaining > 0 : remaining === 0,
      'Terminal phase does not match wave or eggs.');
  } else {
    check(value.wave < 5 || value.phase === 'battle', 'A completed fifth wave must be terminal.');
    check(remaining > 0, 'An active run must have eggs remaining.');
    check(value.rewardGold === 0, 'An active run cannot have a terminal reward.');
    if (value.phase === 'ready') check(value.enemies.length === 0 && value.projectiles.length === 0 && value.spawnSchedule.length === 0,
      'A ready checkpoint cannot contain active combat.');
    else check(value.wave > 0, 'Battle requires a started wave.');
  }
}

function validateSave(value: unknown): asserts value is SaveDataV2 {
  object(value, 'Save');
  check(value.version === 2, 'Unsupported save version.');
  integer(value.savedAt, 'Save timestamp');
  validateState(value.state);
}

function migrate(value: RecordValue): SaveDataV2 {
  // v1 stores a restartable checkpoint, never an exact combat snapshot.
  const state = createInitialState();
  const numeric = (key: string, fallback: number, max = Number.MAX_SAFE_INTEGER) => {
    if (!own(value, key)) return fallback;
    integer(value[key], `Legacy ${key}`, 0, max);
    return value[key];
  };
  const savedAt = numeric('savedAt', 0);
  state.gold = numeric('gold', state.gold);
  state.bankedGold = numeric('bankedGold', 0);
  state.wave = numeric('wave', 0, 5);
  state.enemiesKilled = numeric('enemiesKilled', 0);
  state.enemiesSummoned = numeric('enemiesSummoned', state.enemiesKilled);
  const lives = numeric('lives', 5, 5);
  if (own(value, 'activeLevel')) {
    choice(value.activeLevel, ['level1', 'tutorial'], 'Legacy level');
    state.activeLevel = value.activeLevel as GameState['activeLevel'];
  }
  if (own(value, 'knownMonsters')) {
    kinds(value.knownMonsters, false);
    state.knownMonsters = [...new Set(value.knownMonsters)];
  }
  if (own(value, 'towers')) {
    towers(value.towers, true);
    state.towers = value.towers.map(item => {
      if (item === null) return null;
      const t = item as RecordValue;
      return { type: t.type, level: t.level, cooldown: 0 } as NonNullable<GameState['towers'][number]>;
    });
  }
  if (own(value, 'eggs')) {
    eggs(value.eggs, true);
    state.eggs = value.eggs.map(item => ({
      id: item.id,
      status: item.status === 'carried' ? 'dropped' : item.status,
      progress: item.status === 'carried' ? item.progress ?? map.path.length - 1 : item.progress,
      carrier: null,
    })) as GameState['eggs'];
    // During a battle v1's lives value may be newer than its checkpoint eggs.
    // The eggs are authoritative when present, as in the original loader.
  } else {
    state.eggs = state.eggs.map((item, i) => ({ ...item, status: i < lives ? 'nest' : 'escaped' }));
  }
  const remaining = state.eggs.filter(item => item.status !== 'escaped').length;
  state.phase = remaining === 0 ? 'lost' : state.wave === 5 ? 'won' : 'ready';
  state.rewardsApplied = state.phase === 'won' || state.phase === 'lost';
  state.rewardGold = state.rewardsApplied ? state.enemiesKilled + remaining * 10 : 0;
  // Terminal v1 saves already banked this reward; adding it again would duplicate it.
  const data: SaveDataV2 = { version: 2, savedAt, state };
  validateSave(data);
  return data;
}

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
function message(error: unknown): string {
  if (error instanceof Error && error.name === 'QuotaExceededError') return 'Browser storage is full.';
  if (error instanceof Error && error.name === 'SecurityError') return 'Browser storage access is blocked.';
  return error instanceof Error ? error.message : 'Storage operation failed.';
}

function writeFailure(operation: string, error: unknown): WriteResult {
  let code: WriteFailureCode = 'failure';
  if (error instanceof Error && error.name === 'QuotaExceededError') code = 'quota';
  if (error instanceof Error && error.name === 'SecurityError') code = 'blocked';
  return { ok: false, code, message: `${operation}: ${message(error)}` };
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
      if (value.version === 1) {
        const data = migrate(value);
        if (adopt || !this.revisions.has(index)) this.revisions.set(index, raw);
        return { status: 'valid', data, migrated: true };
      }
      validateSave(value);
      if (adopt || !this.revisions.has(index)) this.revisions.set(index, raw);
      return { status: 'valid', data: value, migrated: false };
    } catch (error) { return { status: 'error', message: `Could not read this save: ${message(error)}` }; }
  }

  saveSlot(index: number, state: GameState): WriteResult {
    try {
      const key = slot(index);
      const data: SaveDataV2 = { version: 2, savedAt: Date.now(), state };
      validateSave(data);
      const raw = JSON.stringify(data);
      validateSave(JSON.parse(raw));
      const expected = this.revisions.has(index) ? this.revisions.get(index) : null;
      if (this.storage.getItem(key) !== expected) {
        return {
          ok: false,
          code: 'conflict',
          message: 'Could not save journey: This slot changed in another tab. Reload this app and use Load Save to continue the newer journey before saving.',
        };
      }
      this.storage.setItem(key, raw);
      this.revisions.set(index, raw);
      return { ok: true };
    } catch (error) { return writeFailure('Could not save journey', error); }
  }

  readSettings(): Settings {
    try {
      const raw = this.storage.getItem(`${prefix}settings`);
      return raw === null ? { ...defaults } : settings(JSON.parse(raw));
    } catch { return { ...defaults }; }
  }

  writeSettings(value: Settings): WriteResult {
    try {
      object(value, 'Settings');
      number(value.music, 'Music volume', 0, 100);
      number(value.sound, 'Sound volume', 0, 100);
      boolean(value.quiet, 'Quiet');
      return this.write(`${prefix}settings`, settings(value), 'Could not save settings');
    } catch (error) { return writeFailure('Could not save settings', error); }
  }

  readBestiary(): string[] {
    try {
      const raw = this.storage.getItem(`${prefix}bestiary`);
      if (raw === null) return [];
      const value: unknown = JSON.parse(raw);
      kinds(value, false);
      return [...new Set(value)];
    } catch { return []; }
  }

  writeBestiary(value: string[]): WriteResult {
    try {
      kinds(value, false);
      return this.write(`${prefix}bestiary`, [...new Set(value)], 'Could not save bestiary');
    } catch (error) { return writeFailure('Could not save bestiary', error); }
  }

  private write(key: string, value: unknown, operation: string): WriteResult {
    try {
      this.storage.setItem(key, JSON.stringify(value));
      return { ok: true };
    } catch (error) { return writeFailure(operation, error); }
  }
}
