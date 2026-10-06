import { describe, expect, it, vi } from 'vitest';
import { GameEngine, createInitialState } from '../src/game/engine';
import type { GameState } from '../src/game/types';
import { map } from '../src/content/catalog';
import { SaveRepository } from '../src/services/storage';

const key = (slot = 0) => `infernalDefense.save.${slot}`;
const defaultSettings = { music: 24, sound: 55, quiet: false };

function fixture() {
  const values = new Map<string, string>();
  const storage = {
    getItem: vi.fn((name: string) => values.get(name) ?? null),
    setItem: vi.fn((name: string, value: string) => { values.set(name, value); }),
  };
  const repository = new SaveRepository(storage);
  return { values, storage, repository };
}

function battle(): GameState {
  const state = createInitialState('tutorial', 73);
  Object.assign(state, {
    phase: 'battle', wave: 3, paused: true, simulationTime: 2500.25, speed: 1.5,
    gold: 91, enemiesKilled: 8, enemiesSummoned: 10, knownMonsters: ['scout', 'shield'],
    selected: 0, chosen: 'poison', nextEntityId: 9,
  });
  state.towers[0] = { type: 'ice', level: 2, cooldown: 418.75 };
  state.enemies = [{
    id: 6, kind: 'shield', hp: 80.5, max: 130, spd: 0.52, progress: 9.25,
    slow: 200, poison: 1230, poisonD: 320, carryingEgg: 1,
    returning: true, escaped: false, rewarded: false,
  }, {
    id: 7, kind: 'scout', hp: 45, max: 55, spd: 0.86, progress: 2,
    slow: 0, poison: 0, poisonD: 0, carryingEgg: null,
    returning: false, escaped: false, rewarded: false,
  }];
  state.projectiles = [{ id: 8, x: -5.2, y: 305.4, targetId: 6, dragon: 'ice', damage: 11.36, speed: 5, level: 2 }];
  state.eggs[0] = { id: 1, status: 'carried', progress: null, carrier: 6 };
  state.eggs[1] = { id: 2, status: 'dropped', progress: 7.5, carrier: null };
  state.eggs[4] = { id: 5, status: 'escaped', progress: null, carrier: null };
  state.spawnSchedule = [{ kind: 'runner', hp: 55, spd: 1.22, at: 2400 }, { kind: 'shield', hp: 130, spd: 0.52, at: 3000 }];
  return state;
}

function legacy() {
  return {
    version: 1, savedAt: 1700000000000, gold: 205, bankedGold: 87,
    wave: 2, lives: 4, enemiesKilled: 17, enemiesSummoned: 22,
    activeLevel: 'tutorial', knownMonsters: ['scout', 'shield'],
    towers: [{ type: 'fire', level: 3, last: 0 }, null, null, null, null],
    eggs: createInitialState().eggs.map((egg, i) => i === 4 ? { ...egg, status: 'escaped' } : egg),
  };
}

describe('version 2 snapshots', () => {
  it('rejects stale writes after another repository has advanced the same slot', () => {
    const { repository, values, storage } = fixture();
    const old = createInitialState();
    expect(repository.saveSlot(0, old)).toEqual({ ok: true });
    const other = new SaveRepository(storage);
    expect(other.readSlot(0).status).toBe('valid');
    const newer = createInitialState(); newer.gold = 15; newer.towers[0] = { type: 'fire', level: 2, cooldown: 0 };
    expect(other.saveSlot(0, newer)).toEqual({ ok: true });
    const retained = values.get(key());
    expect(repository.saveSlot(0, old)).toMatchObject({ ok: false, code: 'conflict' });
    expect(values.get(key())).toBe(retained);
    repository.readSlot(0); // Previewing slots must not authorize overwriting one.
    expect(repository.saveSlot(0, old)).toMatchObject({ ok: false });
    repository.readSlot(0, true); // Explicitly adopting the newly loaded journey does.
    expect(repository.saveSlot(0, newer)).toEqual({ ok: true });
  });

  it('never overwrites existing unread data without first adopting a valid slot', () => {
    const { repository, values } = fixture();
    values.set(key(), '{broken');
    expect(repository.saveSlot(0, createInitialState()).ok).toBe(false);
    expect(values.get(key())).toBe('{broken');
  });

  it('round trips every field and isolates storage from subsequent object mutations', () => {
    const { repository, values } = fixture();
    const state = battle();
    const expected = structuredClone(state);
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1700000000123);
    try {
      expect(repository.saveSlot(0, state)).toEqual({ ok: true });
      const saved = JSON.parse(values.get(key())!);
      expect(saved).toEqual({ version: 2, savedAt: 1700000000123, state: expected });
      state.enemies[0].hp = 1;
      state.towers[0]!.level = 99;
      state.spawnSchedule.length = 0;
      expect(repository.readSlot(0)).toEqual({ status: 'valid', data: saved, migrated: false });
      const result = repository.readSlot(0);
      if (result.status !== 'valid') throw new Error('Expected valid save');
      result.data.state.gold = 0;
      expect(repository.readSlot(0)).toEqual({ status: 'valid', data: saved, migrated: false });
    } finally { clock.mockRestore(); }
  });

  it('keeps all three slots independent', () => {
    const { repository } = fixture();
    for (let i = 0; i < 3; i++) {
      const state = createInitialState();
      state.gold = 120 + i;
      expect(repository.saveSlot(i, state)).toEqual({ ok: true });
    }
    for (let i = 0; i < 3; i++) {
      const result = repository.readSlot(i);
      expect(result.status).toBe('valid');
      if (result.status === 'valid') expect(result.data.state.gold).toBe(120 + i);
    }
  });

  it('accepts actual engine snapshots and preserves continued simulation', () => {
    const { repository } = fixture();
    const engine = new GameEngine();
    engine.dispatch({ type: 'choose', dragon: 'poison' });
    engine.dispatch({ type: 'perch', index: 0 });
    engine.dispatch({ type: 'choose', dragon: 'fire' });
    engine.dispatch({ type: 'perch', index: 1 });
    engine.dispatch({ type: 'startWave' });
    for (let i = 0; i < 1600 && engine.state.phase === 'battle'; i++) {
      engine.step(16);
      expect(repository.saveSlot(0, engine.snapshot())).toEqual({ ok: true });
    }
    const result = repository.readSlot(0);
    if (result.status !== 'valid') throw new Error('Expected valid engine snapshot');
    const restored = new GameEngine(result.data.state);
    expect(restored.snapshot()).toEqual(engine.snapshot());
    for (let i = 0; i < 100; i++) {
      expect(restored.step(16)).toEqual(engine.step(16));
      expect(restored.snapshot()).toEqual(engine.snapshot());
    }
  });

  it.each(['won', 'lost'] as const)('round trips a %s run without changing its bank', phase => {
    const { repository } = fixture();
    const state = createInitialState();
    Object.assign(state, { phase, wave: 5, rewardGold: 50, bankedGold: 150, rewardsApplied: true });
    if (phase === 'lost') state.eggs.forEach(egg => { egg.status = 'escaped'; });
    expect(repository.saveSlot(0, state)).toEqual({ ok: true });
    const result = repository.readSlot(0);
    expect(result.status).toBe('valid');
    if (result.status === 'valid') expect(result.data.state).toEqual(state);
  });

  it.each([-1, 3, 1.5, NaN, Infinity, '0', null, undefined])('rejects invalid slot %s without touching storage', index => {
    const { repository, storage } = fixture();
    expect(repository.readSlot(index as number).status).toBe('error');
    expect(repository.saveSlot(index as number, createInitialState()).ok).toBe(false);
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('distinguishes an absent key from corrupt JSON, and never rewrites either', () => {
    const { repository, values, storage } = fixture();
    expect(repository.readSlot(0)).toEqual({ status: 'empty' });
    for (const raw of ['', '{broken', 'null', '[]', 'true', '1', '{}', '{"version":3}', '{"version":"2"}']) {
      values.set(key(), raw);
      expect(repository.readSlot(0).status).toBe('error');
      expect(values.get(key())).toBe(raw);
    }
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it.each(Object.keys(createInitialState()))('requires v2 state field %s', field => {
    const { repository, values } = fixture();
    const state = battle() as unknown as Record<string, unknown>;
    delete state[field];
    values.set(key(), JSON.stringify({ version: 2, savedAt: 1, state }));
    expect(repository.readSlot(0).status).toBe('error');
  });

  const invalid: [string, (state: GameState) => void][] = [
    ['unknown phase', s => { s.phase = 'playing' as GameState['phase']; }],
    ['string speed', s => { s.speed = '1' as unknown as GameState['speed']; }],
    ['unsupported speed', s => { s.speed = 3 as GameState['speed']; }],
    ['negative gold', s => { s.gold = -1; }],
    ['nonboolean paused', s => { s.paused = 1 as unknown as boolean; }],
    ['negative time', s => { s.simulationTime = -1; }],
    ['fractional wave', s => { s.wave = 1.5; }],
    ['wave out of range', s => { s.wave = 6; }],
    ['kill counter inconsistency', s => { s.enemiesKilled = 11; }],
    ['unknown level', s => { s.activeLevel = 'level2' as GameState['activeLevel']; }],
    ['unknown chosen dragon', s => { s.chosen = 'water' as GameState['chosen']; }],
    ['selected out of range', s => { s.selected = map.perches.length; }],
    ['selected empty perch', s => { s.selected = 1; }],
    ['wrong tower count', s => { s.towers.pop(); }],
    ['unknown tower', s => { s.towers[0]!.type = 'water' as NonNullable<GameState['chosen']>; }],
    ['fractional tower level', s => { s.towers[0]!.level = 1.5; }],
    ['negative cooldown', s => { s.towers[0]!.cooldown = -1; }],
    ['unknown bestiary', s => { s.knownMonsters = ['toString']; }],
    ['duplicate bestiary', s => { s.knownMonsters = ['scout', 'scout']; }],
    ['wrong egg count', s => { s.eggs.pop(); }],
    ['duplicate egg id', s => { s.eggs[1].id = 1; }],
    ['invalid egg status', s => { s.eggs[0].status = 'gone' as GameState['eggs'][number]['status']; }],
    ['dropped egg missing progress', s => { s.eggs[1].progress = null; }],
    ['nest egg with progress', s => { s.eggs[2].progress = 1; }],
    ['egg outside path', s => { s.eggs[1].progress = map.path.length; }],
    ['missing carrier', s => { s.eggs[0].carrier = 999; }],
    ['one-sided enemy reference', s => { s.enemies[0].carryingEgg = null; }],
    ['one-sided egg reference', s => { s.eggs[0] = { id: 1, status: 'nest', progress: null, carrier: null }; }],
    ['two eggs with one carrier', s => { s.eggs[1] = { id: 2, status: 'carried', progress: null, carrier: 6 }; }],
    ['carrier not returning', s => { s.enemies[0].returning = false; }],
    ['escaped carrier', s => { s.enemies[0].escaped = true; }],
    ['egg owned by wrong enemy', s => { s.eggs[0].carrier = 7; }],
    ['dangling projectile', s => { s.projectiles[0].targetId = 999; }],
    ['duplicate enemy ids', s => { s.enemies[1].id = 6; }],
    ['duplicate projectile/enemy id', s => { s.projectiles[0].id = 6; }],
    ['entity collides with egg id', s => { s.enemies[1].id = 2; }],
    ['next entity id collision', s => { s.nextEntityId = 8; }],
    ['unknown enemy kind', s => { s.enemies[0].kind = 'dragon' as GameState['enemies'][number]['kind']; }],
    ['health over maximum', s => { s.enemies[0].hp = 131; }],
    ['negative health', s => { s.enemies[0].hp = -1; }],
    ['dead active enemy', s => { s.enemies[0].hp = 0; }],
    ['rewarded active enemy', s => { s.enemies[0].rewarded = true; }],
    ['zero max health', s => { s.enemies[0].max = 0; }],
    ['zero enemy speed', s => { s.enemies[0].spd = 0; }],
    ['negative enemy path', s => { s.enemies[0].progress = -1; }],
    ['negative status timer', s => { s.enemies[0].poisonD = -1; }],
    ['unknown projectile dragon', s => { s.projectiles[0].dragon = 'water' as NonNullable<GameState['chosen']>; }],
    ['zero projectile speed', s => { s.projectiles[0].speed = 0; }],
    ['invalid projectile level', s => { s.projectiles[0].level = 0; }],
    ['invalid spawn kind', s => { s.spawnSchedule[0].kind = 'toString' as GameState['spawnSchedule'][number]['kind']; }],
    ['invalid spawn health', s => { s.spawnSchedule[0].hp = 0; }],
    ['negative spawn time', s => { s.spawnSchedule[0].at = -1; }],
    ['unordered spawn times', s => { s.spawnSchedule[1].at = 2300; }],
    ['battle wave zero', s => { s.wave = 0; }],
    ['premature applied reward', s => { s.rewardsApplied = true; }],
    ['premature reward gold', s => { s.rewardGold = 50; }],
    ['ready with active enemies', s => { s.phase = 'ready'; }],
    ['terminal with active combat', s => { s.phase = 'won'; s.wave = 5; s.rewardsApplied = true; }],
    ['enemy count exceeds summoned', s => { s.enemiesKilled = 0; s.enemiesSummoned = 1; }],
  ];
  it.each(invalid)('rejects %s on read and write without replacing data', (_name, mutate) => {
    const { repository, values, storage } = fixture();
    const state = battle();
    mutate(state);
    const raw = JSON.stringify({ version: 2, savedAt: 1, state });
    values.set(key(), raw);
    expect(repository.readSlot(0).status).toBe('error');
    expect(repository.saveSlot(0, state).ok).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(values.get(key())).toBe(raw);
  });

  it.each([NaN, Infinity, -Infinity])('rejects nonfinite numbers before JSON converts them to null (%s)', value => {
    const { repository, storage } = fixture();
    const state = battle();
    state.gold = value;
    expect(repository.saveSlot(0, state).ok).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('contains serialization failures and validates the serialized representation', () => {
    const { repository, storage } = fixture();
    const state = createInitialState();
    Object.assign(state, { toJSON: () => ({ gold: 123 }) });
    expect(repository.saveSlot(0, state).ok).toBe(false);
    Object.assign(state, { toJSON: () => { throw new Error('Cannot serialize'); } });
    expect(repository.saveSlot(0, state)).toEqual({ ok: false, code: 'failure', message: 'Could not save journey: Cannot serialize' });
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it.each([undefined, null, 'today', -1, 1.5])('rejects invalid v2 timestamp %s', savedAt => {
    const { repository, values } = fixture();
    values.set(key(), JSON.stringify({ version: 2, savedAt, state: createInitialState() }));
    expect(repository.readSlot(0).status).toBe('error');
  });
});

describe('legacy checkpoint migration', () => {
  it('preserves original checkpoint fields without creating a battle or rewriting the slot', () => {
    const { repository, values, storage } = fixture();
    const original = legacy();
    const raw = JSON.stringify(original);
    values.set(key(), raw);
    const result = repository.readSlot(0);
    if (result.status !== 'valid') throw new Error('Expected migrated save');
    expect(result.migrated).toBe(true);
    expect(result.data.savedAt).toBe(original.savedAt);
    expect(result.data.state).toMatchObject({
      phase: 'ready', wave: 2, gold: 205, bankedGold: 87, enemiesKilled: 17,
      enemiesSummoned: 22, activeLevel: 'tutorial', knownMonsters: ['scout', 'shield'],
      enemies: [], projectiles: [], spawnSchedule: [], rewardsApplied: false,
      simulationTime: 0, selected: null, chosen: null,
    });
    expect(result.data.state.towers[0]).toEqual({ type: 'fire', level: 3, cooldown: 0 });
    expect(result.data.state.eggs).toEqual(original.eggs);
    expect(values.get(key())).toBe(raw);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(repository.saveSlot(0, result.data.state)).toEqual({ ok: true });
    expect(repository.readSlot(0)).toMatchObject({ status: 'valid', migrated: false });
  });

  it('uses defaults only for absent legacy fields', () => {
    const { repository, values } = fixture();
    values.set(key(), JSON.stringify({ version: 1 }));
    expect(repository.readSlot(0)).toEqual({
      status: 'valid', migrated: true, data: { version: 2, savedAt: 0, state: createInitialState() },
    });
  });

  it('reconstructs missing eggs from lives, including zero lives as a lost run', () => {
    const { repository, values } = fixture();
    for (const lives of [0, 2, 5]) {
      values.set(key(), JSON.stringify({ version: 1, lives, wave: 2, bankedGold: 95 }));
      const result = repository.readSlot(0);
      if (result.status !== 'valid') throw new Error('Expected migrated save');
      expect(result.data.state.eggs.filter(egg => egg.status !== 'escaped')).toHaveLength(lives);
      expect(result.data.state.phase).toBe(lives === 0 ? 'lost' : 'ready');
      expect(result.data.state.rewardsApplied).toBe(lives === 0);
      expect(result.data.state.bankedGold).toBe(95);
    }
  });

  it('recognizes a completed fifth wave and retains the already banked reward', () => {
    const { repository, values } = fixture();
    const original = { ...legacy(), wave: 5, bankedGold: 144 };
    values.set(key(), JSON.stringify(original));
    for (let i = 0; i < 3; i++) {
      const result = repository.readSlot(0);
      if (result.status !== 'valid') throw new Error('Expected migrated save');
      expect(result.data.state).toMatchObject({ phase: 'won', rewardsApplied: true, bankedGold: 144, rewardGold: 57 });
      const engine = new GameEngine(result.data.state);
      engine.dispatch({ type: 'startWave' });
      engine.step(1000);
      expect(engine.state.bankedGold).toBe(144);
    }
  });

  it('uses checkpoint eggs even when mid-battle lives differ, and drops orphaned carried eggs', () => {
    const { repository, values } = fixture();
    const original = legacy();
    Object.assign(original.eggs[0], { status: 'carried', carrier: 0.123, progress: null });
    original.lives = 0;
    values.set(key(), JSON.stringify(original));
    const result = repository.readSlot(0);
    if (result.status !== 'valid') throw new Error('Expected migrated save');
    expect(result.data.state.phase).toBe('ready');
    expect(result.data.state.eggs[0]).toEqual({ id: 1, status: 'dropped', carrier: null, progress: map.path.length - 1 });
  });

  it.each([
    ['gold', '120'], ['gold', null], ['bankedGold', -1], ['wave', 6], ['wave', 1.5],
    ['lives', -1], ['lives', 6], ['savedAt', 'today'], ['activeLevel', 'level2'],
    ['towers', null], ['towers', {}], ['towers', []], ['towers', [null]],
    ['towers', [{ type: 'water', level: 1, last: 0 }, null, null, null, null]],
    ['towers', [{ type: 'fire', level: 0, last: 0 }, null, null, null, null]],
    ['towers', [{ type: 'fire', level: 1, last: '0' }, null, null, null, null]],
    ['eggs', null], ['eggs', []], ['knownMonsters', null], ['knownMonsters', ['unknown']],
    ['enemiesKilled', '17'], ['enemiesSummoned', 1],
  ])('rejects incompatible legacy %s=%j rather than defaulting', (field, value) => {
    const { repository, values, storage } = fixture();
    const raw = JSON.stringify({ ...legacy(), [field]: value });
    values.set(key(), raw);
    expect(repository.readSlot(0).status).toBe('error');
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(values.get(key())).toBe(raw);
  });
});

describe('settings, bestiary and storage failures', () => {
  it('uses the original audio defaults and migrates the missing quiet setting', () => {
    const { repository, values } = fixture();
    expect(repository.readSettings()).toEqual(defaultSettings);
    values.set('infernalDefense.settings', JSON.stringify({ music: 12, sound: 66 }));
    expect(repository.readSettings()).toEqual({ music: 12, sound: 66, quiet: false });
    const settings = { music: 0, sound: 100, quiet: true };
    expect(repository.writeSettings(settings)).toEqual({ ok: true });
    expect(repository.readSettings()).toEqual(settings);
  });

  it.each([null, [], { music: '24' }, { music: -1 }, { sound: 101 }, { quiet: 'false' }])('rejects invalid settings %j without writing', value => {
    const { repository, values, storage } = fixture();
    const raw = JSON.stringify(value);
    values.set('infernalDefense.settings', raw);
    expect(repository.readSettings()).toEqual(defaultSettings);
    expect(repository.writeSettings(value as unknown as typeof defaultSettings).ok).toBe(false);
    expect(values.get('infernalDefense.settings')).toBe(raw);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('requires all fields for settings writes but supports absent legacy read fields', () => {
    const { repository, storage } = fixture();
    expect(repository.writeSettings({ music: 24, sound: 55 } as typeof defaultSettings).ok).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('deduplicates valid monster kinds and keeps bestiary separate from saves', () => {
    const { repository, values } = fixture();
    expect(repository.readBestiary()).toEqual([]);
    expect(repository.writeBestiary(['chief', 'scout', 'chief'])).toEqual({ ok: true });
    expect(repository.readBestiary()).toEqual(['chief', 'scout']);
    expect(repository.saveSlot(0, createInitialState())).toEqual({ ok: true });
    expect(repository.readBestiary()).toEqual(['chief', 'scout']);
    expect(values.has('infernalDefense.settings')).toBe(false);
  });

  it.each([null, {}, ['unknown'], ['toString'], ['scout', 1]])('rejects invalid bestiary %j without overwriting it', value => {
    const { repository, values, storage } = fixture();
    const raw = JSON.stringify(value);
    values.set('infernalDefense.bestiary', raw);
    expect(repository.readBestiary()).toEqual([]);
    expect(repository.writeBestiary(value as string[]).ok).toBe(false);
    expect(values.get('infernalDefense.bestiary')).toBe(raw);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('contains malformed settings and bestiary JSON', () => {
    const { repository, values, storage } = fixture();
    values.set('infernalDefense.settings', '{');
    values.set('infernalDefense.bestiary', '{');
    expect(repository.readSettings()).toEqual(defaultSettings);
    expect(repository.readBestiary()).toEqual([]);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it.each(['QuotaExceededError', 'SecurityError'])('returns write failures for %s and preserves saved data', name => {
    const { repository, storage, values } = fixture();
    expect(repository.saveSlot(0, createInitialState())).toEqual({ ok: true });
    const previous = values.get(key());
    storage.setItem.mockImplementation(() => { throw new DOMException('Storage unavailable', name); });
    const detail = name === 'QuotaExceededError' ? 'Browser storage is full.' : 'Browser storage access is blocked.';
    const code = name === 'QuotaExceededError' ? 'quota' : 'blocked';
    expect(repository.saveSlot(0, battle())).toEqual({ ok: false, code, message: `Could not save journey: ${detail}` });
    expect(repository.writeSettings(defaultSettings)).toEqual({ ok: false, code, message: `Could not save settings: ${detail}` });
    expect(repository.writeBestiary(['scout'])).toEqual({ ok: false, code, message: `Could not save bestiary: ${detail}` });
    expect(values.get(key())).toBe(previous);
  });

  it('contains security errors on reads without treating saves as empty', () => {
    const { repository, storage } = fixture();
    storage.getItem.mockImplementation(() => { throw new DOMException('Access denied', 'SecurityError'); });
    expect(repository.readSlot(0)).toEqual({ status: 'error', message: 'Could not read this save: Browser storage access is blocked.' });
    expect(repository.readSettings()).toEqual(defaultSettings);
    expect(repository.readBestiary()).toEqual([]);
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
