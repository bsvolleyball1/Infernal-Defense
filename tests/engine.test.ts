import { describe, expect, it } from 'vitest';
import { dragons, map, monsters, positionAt, waves } from '../src/content/catalog';
import { createInitialState, GameEngine } from '../src/game/engine';
import type { DragonType, Enemy, GameState, Projectile } from '../src/game/types';

function enemy(overrides: Partial<Enemy> = {}): Enemy {
  return {
    id: 6, kind: 'scout', hp: 45, max: 45, spd: 0, progress: 1,
    slow: 0, poison: 0, poisonD: 0, carryingEgg: null,
    returning: false, escaped: false, rewarded: false, ...overrides,
  };
}

function battle(overrides: Partial<GameState> = {}): GameEngine {
  return new GameEngine({
    ...createInitialState(), phase: 'battle', wave: 1,
    enemies: [enemy()], enemiesSummoned: 1, nextEntityId: 7, ...overrides,
  });
}

function shot(target: Enemy, dragon: DragonType = 'fire', overrides: Partial<Projectile> = {}): Projectile {
  const [x, y] = positionAt(target.progress);
  return { id: 20, x, y, targetId: target.id, dragon, damage: dragons[dragon].damage, speed: dragon === 'fire' ? 6 : 5, level: 1, ...overrides };
}

describe('original content and initial state', () => {
  it('preserves the map, dragon balance, waves, and bestiary', () => {
    expect(map.width).toBe(700);
    expect(map.height).toBe(430);
    expect(map.path).toHaveLength(17);
    expect(map.perches).toEqual([{ x: 90, y: 202 }, { x: 230, y: 155 }, { x: 365, y: 205 }, { x: 430, y: 78 }, { x: 594, y: 205 }, { x: 220, y: 345 }, { x: 410, y: 385 }, { x: 590, y: 345 }]);
    expect(Object.values(dragons).map(({ name, cost, damage, rate, range }) => [name, cost, damage, rate, range])).toEqual([
      ['Ember', 60, 27, 680, 132], ['Frost', 55, 8, 820, 145], ['Thorn', 50, 7, 760, 125],
    ]);
    expect(waves.map(groups => groups.reduce((sum, group) => sum + group.n, 0))).toEqual([10, 12, 18, 18, 19]);
    expect(waves[4][2]).toEqual({ kind: 'chief', n: 1, hp: 900, spd: 0.4 });
    expect((['scout','shield','runner','chief'] as const).map(kind => monsters[kind].name)).toEqual(['Pass raider', 'Iron guard', 'Ash runner', 'Raid chief']);
  });

  it('interpolates fractional path progress and clamps the endpoints', () => {
    expect(positionAt(-1)).toEqual([-30, 300]);
    expect(positionAt(0.5)).toEqual([25, 300]);
    expect(positionAt(1.5)).toEqual([112.5, 290]);
    expect(positionAt(100)).toEqual([640, 85]);
    const endpoint = positionAt(16);
    endpoint[0] = 0;
    expect(positionAt(16)).toEqual([640, 85]);
  });

  it('creates independent version-free state with five eggs and eight empty perches', () => {
    const state = createInitialState();
    expect(state).toMatchObject({ phase: 'ready', paused: false, simulationTime: 0, speed: 1, gold: 120, bankedGold: 0, wave: 0, activeLevel: 'level1', rewardsApplied: false, rewardGold: 0, selected: null, chosen: null });
    expect(state).not.toHaveProperty('version');
    expect(state.towers).toEqual(Array(8).fill(null));
    expect(state.eggs).toEqual([1, 2, 3, 4, 5].map(id => ({ id, status: 'nest', progress: null, carrier: null })));
    state.eggs[0].status = 'escaped';
    expect(createInitialState().eggs[0].status).toBe('nest');
    expect(createInitialState('tutorial', 83)).toMatchObject({ activeLevel: 'tutorial', bankedGold: 83, gold: 120 });
  });
});

describe('commands and economy', () => {
  it('places, selects, upgrades, and sells with original prices and refunds', () => {
    const engine = new GameEngine();
    expect(engine.dispatch({ type: 'perch', index: 0 })).toEqual([{ type: 'message', text: 'Choose a dragon first' }]);
    engine.dispatch({ type: 'choose', dragon: 'fire' });
    expect(engine.state).toMatchObject({ chosen: 'fire', selected: null });
    expect(engine.dispatch({ type: 'perch', index: 0 })).toContainEqual({ type: 'save' });
    expect(engine.state).toMatchObject({ gold: 60, chosen: null, selected: 0 });
    expect(engine.state.towers[0]).toEqual({ type: 'fire', level: 1, cooldown: 0 });
    engine.dispatch({ type: 'upgrade' });
    expect(engine.state.gold).toBe(15);
    expect(engine.state.towers[0]?.level).toBe(2);
    expect(engine.dispatch({ type: 'upgrade' })).toEqual([]);
    engine.dispatch({ type: 'choose', dragon: 'ice' });
    engine.dispatch({ type: 'perch', index: 0 });
    expect(engine.state).toMatchObject({ chosen: null, selected: 0, gold: 15 });
    expect(engine.dispatch({ type: 'sell' })).toContainEqual({ type: 'message', text: 'Dragon sold · 48 gold' });
    expect(engine.state).toMatchObject({ gold: 63, selected: null });
    expect(engine.state.towers[0]).toBeNull();
  });

  it('floors the Frost refund and uses the current level for upgrade cost', () => {
    const engine = new GameEngine({ ...createInitialState(), gold: 300 });
    engine.dispatch({ type: 'choose', dragon: 'ice' });
    engine.dispatch({ type: 'perch', index: 2 });
    engine.dispatch({ type: 'upgrade' });
    engine.dispatch({ type: 'upgrade' });
    expect(engine.state.gold).toBe(110);
    engine.dispatch({ type: 'sell' });
    expect(engine.state.gold).toBe(173);
  });

  it('applies the upgraded fire rate to an attack already cooling down', () => {
    const engine = battle({ selected: 0, towers: [{ type: 'fire', level: 1, cooldown: 400 }, null, null, null, null] });
    engine.dispatch({ type: 'upgrade' });
    expect(engine.state.towers[0]?.cooldown).toBeCloseTo(680 / 1.13 - 280);
  });

  it('rejects invalid perches, unaffordable actions, and unselected actions without corrupting state', () => {
    const engine = new GameEngine({ ...createInitialState(), gold: 10 });
    engine.dispatch({ type: 'choose', dragon: 'poison' });
    const state = engine.snapshot();
    for (const index of [-1, map.perches.length, 0.5, NaN]) expect(engine.dispatch({ type: 'perch', index })).toEqual([]);
    expect(engine.dispatch({ type: 'perch', index: 1 })).toEqual([{ type: 'message', text: 'Not enough gold' }]);
    expect(engine.dispatch({ type: 'upgrade' })).toEqual([]);
    expect(engine.dispatch({ type: 'sell' })).toEqual([]);
    expect(engine.snapshot()).toEqual(state);
  });

  it('keeps completed results intact when gameplay commands arrive', () => {
    for (const phase of ['won', 'lost'] as const) {
      const engine = new GameEngine({ ...createInitialState(), phase, rewardGold: 62, rewardsApplied: true, bankedGold: 62 });
      const state = engine.snapshot();
      engine.dispatch({ type: 'choose', dragon: 'fire' });
      engine.dispatch({ type: 'perch', index: 0 });
      engine.dispatch({ type: 'upgrade' });
      engine.dispatch({ type: 'sell' });
      engine.dispatch({ type: 'startWave' });
      expect(engine.step(10000)).toEqual([]);
      expect(engine.snapshot()).toEqual(state);
    }
  });
});

describe('simulation clock and scheduled spawning', () => {
  it('does not pause ready states when leaving the game or loading a between-wave save', () => {
    const engine = new GameEngine();
    expect(engine.dispatch({ type: 'pause' })).toEqual([]);
    expect(engine.state.paused).toBe(false);
    engine.restore(engine.snapshot());
    engine.dispatch({ type: 'startWave' });
    expect(engine.state).toMatchObject({ phase: 'battle', paused: false });
    engine.step(10);
    expect(engine.state.enemiesSummoned).toBe(1);

    const betweenWaves = battle({ enemies: [] });
    betweenWaves.step(10);
    expect(betweenWaves.state).toMatchObject({ phase: 'ready', wave: 1 });
    betweenWaves.dispatch({ type: 'pause' });
    betweenWaves.restore(betweenWaves.snapshot());
    betweenWaves.dispatch({ type: 'startWave' });
    expect(betweenWaves.state).toMatchObject({ phase: 'battle', paused: false, wave: 2 });
    betweenWaves.step(10);
    expect(betweenWaves.state.spawnSchedule).toHaveLength(11);
  });

  it('clears a restored ready pause on wave start and lets resume clear pause in every phase', () => {
    const engine = new GameEngine({ ...createInitialState(), paused: true });
    engine.dispatch({ type: 'startWave' });
    expect(engine.state).toMatchObject({ phase: 'battle', paused: false });
    engine.step(10);
    expect(engine.state.enemiesSummoned).toBe(1);
    for (const phase of ['ready', 'battle', 'won', 'lost'] as const) {
      engine.restore({ ...createInitialState(), phase, paused: true });
      engine.dispatch({ type: 'resume' });
      expect(engine.state).toMatchObject({ phase, paused: false });
    }
  });

  it('blocks keyboard gameplay commands during a paused battle while permitting speed and resume', () => {
    const engine = battle({ paused: true, gold: 200, chosen: 'ice', selected: 0, towers: [{ type: 'fire', level: 1, cooldown: 100 }, null, null, null, null] });
    const state = engine.snapshot();
    expect(engine.dispatch({ type: 'choose', dragon: 'poison' })).toEqual([]);
    expect(engine.dispatch({ type: 'perch', index: 1 })).toEqual([]);
    expect(engine.dispatch({ type: 'upgrade' })).toEqual([]);
    expect(engine.dispatch({ type: 'sell' })).toEqual([]);
    expect(engine.dispatch({ type: 'startWave' })).toEqual([]);
    expect(engine.snapshot()).toEqual(state);
    engine.dispatch({ type: 'speed', speed: 2 });
    expect(engine.state).toMatchObject({ paused: true, speed: 2 });
    engine.dispatch({ type: 'resume' });
    engine.dispatch({ type: 'upgrade' });
    expect(engine.state.towers[0]?.level).toBe(2);
  });

  it('schedules wave groups at absolute simulation timestamps and prevents overlapping waves', () => {
    const engine = new GameEngine({ ...createInitialState(), simulationTime: 1234 });
    engine.dispatch({ type: 'startWave' });
    expect(engine.state).toMatchObject({ phase: 'battle', wave: 1, enemiesSummoned: 0 });
    expect(engine.state.spawnSchedule).toHaveLength(10);
    expect(engine.state.spawnSchedule[0]).toEqual({ kind: 'scout', hp: 45, spd: 0.72, at: 1234 });
    expect(engine.state.spawnSchedule[9].at).toBe(1234 + 9 * 656);
    const state = engine.snapshot();
    expect(engine.dispatch({ type: 'startWave' })).toEqual([]);
    expect(engine.snapshot()).toEqual(state);
  });

  it('uses original spawn intervals, groups, health, and speed for every wave', () => {
    for (let wave = 1; wave <= 5; wave++) {
      const engine = new GameEngine({ ...createInitialState(), wave: wave - 1 });
      engine.dispatch({ type: 'startWave' });
      const expected = waves[wave - 1].flatMap(group => Array.from({ length: group.n }, () => ({ kind: group.kind, hp: group.hp, spd: group.spd })));
      expect(engine.state.spawnSchedule.map(({ at, ...spawn }) => spawn)).toEqual(expected);
      expect(engine.state.spawnSchedule.map(spawn => spawn.at)).toEqual(expected.map((_, i) => i * Math.max(390, 710 - wave * 54)));
    }
  });

  it('scales spawning and movement with the selected speed', () => {
    const normal = new GameEngine();
    const fast = new GameEngine();
    normal.dispatch({ type: 'startWave' });
    fast.dispatch({ type: 'startWave' });
    fast.dispatch({ type: 'speed', speed: 2 });
    normal.step(10);
    fast.step(10);
    expect(normal.state.enemies[0].progress).toBeCloseTo(0.72 * 10 * 0.0045);
    expect(fast.state.enemies[0].progress).toBeCloseTo(0.72 * 20 * 0.0045);
    for (let i = 0; i < 33; i++) { normal.step(10); fast.step(10); }
    expect(normal.state.enemiesSummoned).toBe(1);
    expect(fast.state.enemiesSummoned).toBe(2);
    expect(fast.state.simulationTime).toBe(680);
  });

  it('pauses every timer and resumes without consuming background time', () => {
    const target = enemy({ spd: 0.72, slow: 400, poison: 900, poisonD: 200 });
    const engine = battle({
      enemies: [target], towers: [{ type: 'fire', level: 1, cooldown: 300 }, null, null, null, null],
      projectiles: [shot(target, 'fire', { x: -100 })],
      spawnSchedule: [{ kind: 'runner', hp: 55, spd: 1.22, at: 500 }],
    });
    engine.dispatch({ type: 'pause' });
    const paused = engine.snapshot();
    expect(engine.step(3600000)).toEqual([]);
    expect(engine.snapshot()).toEqual(paused);
    engine.dispatch({ type: 'resume' });
    engine.step(20);
    expect(engine.state.simulationTime).toBe(20);
    expect(engine.state.enemiesSummoned).toBe(1);
    expect(engine.state.enemies[0]).toMatchObject({ slow: 380, poison: 880, poisonD: 180 });
    expect(engine.state.towers[0]?.cooldown).toBe(280);
    expect(engine.state.projectiles[0].x).toBeGreaterThan(-100);
  });

  it('scales cooldown, freeze, poison, and projectile timers together', () => {
    const target = enemy({ slow: 1000, poison: 1000, poisonD: 500 });
    const engine = battle({ speed: 1.5, enemies: [target], towers: [{ type: 'ice', level: 1, cooldown: 300 }, null, null, null, null], projectiles: [shot(target, 'fire', { x: -100 })] });
    engine.step(20);
    expect(engine.state.simulationTime).toBe(30);
    expect(engine.state.enemies[0]).toMatchObject({ slow: 970, poison: 970, poisonD: 470 });
    expect(engine.state.towers[0]?.cooldown).toBe(270);
    expect(engine.state.projectiles[0].x).toBeCloseTo(-55);
  });

  it('ignores invalid time deltas and ready time without advancing the clock', () => {
    const engine = battle();
    const state = engine.snapshot();
    for (const dt of [0, -10, NaN, Infinity]) expect(engine.step(dt)).toEqual([]);
    expect(engine.snapshot()).toEqual(state);
    const ready = new GameEngine();
    ready.step(100000);
    expect(ready.state.simulationTime).toBe(0);
  });

  it('respects the 50-enemy cap without discarding scheduled enemies', () => {
    const engine = battle({ enemies: Array.from({ length: 50 }, (_, i) => enemy({ id: i + 6 })), nextEntityId: 56, spawnSchedule: [{ kind: 'scout', hp: 45, spd: 0.72, at: 0 }] });
    engine.step(10);
    expect(engine.state.enemies).toHaveLength(50);
    expect(engine.state.spawnSchedule).toHaveLength(1);
    engine.state.enemies.pop();
    engine.step(10);
    expect(engine.state.enemies).toHaveLength(50);
    expect(engine.state.spawnSchedule).toHaveLength(0);
    expect(engine.state.enemies[49].id).toBe(56);
  });

  it('allocates stable, globally unique numeric entity IDs', () => {
    const engine = new GameEngine();
    engine.dispatch({ type: 'choose', dragon: 'fire' });
    engine.dispatch({ type: 'perch', index: 0 });
    engine.dispatch({ type: 'startWave' });
    const observed = new Set(engine.state.eggs.map(egg => egg.id));
    for (let i = 0; i < 80; i++) {
      const firstNewId = engine.state.nextEntityId;
      engine.step(10);
      for (const entity of [...engine.state.enemies, ...engine.state.projectiles]) {
        expect(Number.isInteger(entity.id)).toBe(true);
        if (entity.id >= firstNewId) { expect(observed.has(entity.id)).toBe(false); observed.add(entity.id); }
      }
    }
    expect(engine.state.enemies[0].id).toBe(6);
    expect(observed.size).toBeGreaterThan(6);
  });
});

describe('combat formulas and rewards', () => {
  it('targets the enemy with the greatest progress in range and retains upgrade formulas', () => {
    const engine = battle({ enemies: [enemy({ id: 6, progress: 1 }), enemy({ id: 7, progress: 2 }), enemy({ id: 8, progress: 16 })], towers: [{ type: 'fire', level: 3, cooldown: 0 }, null, null, null, null], nextEntityId: 9 });
    expect(engine.step(1)).toContainEqual({ type: 'sound', dragon: 'fire' });
    expect(engine.state.projectiles[0]).toMatchObject({ id: 9, targetId: 7, dragon: 'fire', damage: 27 * (1 + 2 * 0.42), speed: 6, level: 3 });
    expect(engine.state.towers[0]?.cooldown).toBeCloseTo(680 / (1 + 2 * 0.13));
  });

  it('never shoots outside the upgraded range or before cooldown expiry', () => {
    const engine = battle({ enemies: [enemy({ progress: 16 })], towers: [{ type: 'fire', level: 1, cooldown: 0 }, null, null, null, null] });
    engine.step(10);
    expect(engine.state.projectiles).toHaveLength(0);
    engine.state.enemies[0].progress = 1;
    engine.state.towers[0]!.cooldown = 100;
    engine.step(20);
    expect(engine.state.projectiles).toHaveLength(0);
    engine.step(80);
    expect(engine.state.towers[0]?.cooldown).toBe(680);
    expect(engine.state.enemies[0].hp).toBe(18);
  });

  it('hits with the original projectile damage and freezes movement for 1250ms', () => {
    const target = enemy({ spd: 0.72 });
    const engine = battle({ enemies: [target], projectiles: [shot(target, 'ice')] });
    engine.step(10);
    expect(engine.state.enemies[0]).toMatchObject({ hp: 37, slow: 1250 });
    const progress = engine.state.enemies[0].progress;
    for (let i = 0; i < 125; i++) engine.step(10);
    expect(engine.state.enemies[0].progress).toBe(progress);
    expect(engine.state.enemies[0].slow).toBe(0);
    engine.step(10);
    expect(engine.state.enemies[0].progress).toBeGreaterThan(progress);
  });

  it('refreshes poison for 2300ms, dealing four damage after 10ms and each 450ms tick', () => {
    const target = enemy({ hp: 100, max: 100 });
    const engine = battle({ enemies: [target], projectiles: [shot(target, 'poison')] });
    engine.step(10);
    expect(engine.state.enemies[0]).toMatchObject({ hp: 93, poison: 2300, poisonD: 10 });
    engine.step(10);
    expect(engine.state.enemies[0]).toMatchObject({ hp: 89, poison: 2290, poisonD: 450 });
    for (let i = 0; i < 45; i++) engine.step(10);
    expect(engine.state.enemies[0].hp).toBe(85);
    for (let i = 0; i < 184; i++) engine.step(10);
    expect(engine.state.enemies[0]).toMatchObject({ hp: 69, poison: 0 });
    for (let i = 0; i < 60; i++) engine.step(10);
    expect(engine.state.enemies[0].hp).toBe(69);
  });

  it('awards a kill and discovery once even when multiple projectiles target a dying enemy', () => {
    const target = enemy({ hp: 20 });
    const engine = battle({ enemies: [target, enemy({ id: 7, progress: 16 })], projectiles: [shot(target), shot(target, 'fire', { id: 21 })] });
    const events = engine.step(10);
    expect(engine.state).toMatchObject({ gold: 132, enemiesKilled: 1, knownMonsters: ['scout'] });
    expect(events.filter(event => event.type === 'discovery')).toEqual([{ type: 'discovery', kind: 'scout' }]);
    expect(engine.state.projectiles).toHaveLength(0);
    expect(engine.state.enemies.map(item => item.id)).toEqual([7]);
    engine.state.projectiles.push(shot(engine.state.enemies[0], 'fire', { damage: 100 }));
    expect(engine.step(10).filter(event => event.type === 'discovery')).toEqual([]);
    expect(engine.state.enemiesKilled).toBe(2);
  });

  it('discovers poison kills and preserves the chief bonus and wave-clear gold', () => {
    const target = enemy({ kind: 'chief', hp: 4, poison: 100, poisonD: 10 });
    const engine = battle({ enemies: [target] });
    const events = engine.step(10);
    expect(engine.state).toMatchObject({ phase: 'ready', gold: 120 + 132 + 35, enemiesKilled: 1, knownMonsters: ['chief'] });
    expect(events).toContainEqual({ type: 'discovery', kind: 'chief' });
    expect(engine.state.bankedGold).toBe(0);
  });

  it('discards projectiles whose target no longer exists', () => {
    const engine = battle({ projectiles: [shot(enemy({ id: 999 }))] });
    engine.step(10);
    expect(engine.state.projectiles).toEqual([]);
    expect(engine.state.enemies[0].hp).toBe(45);
  });
});

describe('egg theft, rescue, and run completion', () => {
  it('takes an egg at the nest and reverses along the same path', () => {
    const engine = battle({ enemies: [enemy({ progress: 15.99, spd: 0.72 })] });
    engine.step(10);
    expect(engine.state.enemies[0]).toMatchObject({ progress: 16, carryingEgg: 1, returning: true });
    expect(engine.state.eggs[0]).toMatchObject({ status: 'carried', carrier: 6, progress: null });
    engine.step(10);
    expect(engine.state.enemies[0].progress).toBeCloseTo(16 - 0.72 * 10 * 0.0045);
  });

  it('drops a rescued egg at the carrier position and lets a later raider pick it up', () => {
    const carrier = enemy({ progress: 8, carryingEgg: 1, returning: true, hp: 20 });
    const engine = battle({ enemies: [carrier, enemy({ id: 7, progress: 7.99 })], projectiles: [shot(carrier)] });
    engine.state.eggs[0] = { id: 1, status: 'carried', progress: null, carrier: carrier.id };
    engine.step(10);
    expect(engine.state.eggs[0]).toEqual({ id: 1, status: 'dropped', progress: 8, carrier: null });
    expect(engine.state.enemiesKilled).toBe(1);
    engine.state.enemies[0].spd = 0.72;
    engine.step(10);
    expect(engine.state.enemies[0]).toMatchObject({ id: 7, progress: 8, carryingEgg: 1, returning: true });
    expect(engine.state.eggs[0]).toEqual({ id: 1, status: 'carried', progress: null, carrier: 7 });
  });

  it('returns without an egg if the nest is empty and never rewards an escape', () => {
    const engine = battle({ enemies: [enemy({ progress: 15.99, spd: 1 })] });
    engine.state.eggs.forEach(egg => { egg.status = 'dropped'; egg.progress = 8; });
    engine.step(10);
    expect(engine.state.enemies[0]).toMatchObject({ carryingEgg: null, returning: true });
    engine.state.enemies[0].progress = 0.01;
    engine.step(10);
    expect(engine.state).toMatchObject({ phase: 'ready', enemiesKilled: 0, gold: 155 });
    expect(engine.state.knownMonsters).toEqual([]);
    expect(engine.state.eggs.filter(egg => egg.status === 'escaped')).toHaveLength(0);
  });

  it('marks only the stolen egg escaped, including when poison was about to kill its carrier', () => {
    const carrier = enemy({ carryingEgg: 1, returning: true, progress: 0.01, spd: 1, hp: 4, poison: 100, poisonD: 1 });
    const engine = battle({ enemies: [carrier, enemy({ id: 7 })] });
    engine.state.eggs[0] = { id: 1, status: 'carried', progress: null, carrier: 6 };
    const events = engine.step(10);
    expect(engine.state.eggs[0]).toEqual({ id: 1, status: 'escaped', progress: null, carrier: null });
    expect(engine.state).toMatchObject({ phase: 'battle', gold: 120, enemiesKilled: 0 });
    expect(events).toContainEqual({ type: 'message', text: 'A raider escaped with an egg!' });
  });

  it('ends immediately when the last egg escapes and applies the result reward once', () => {
    const carrier = enemy({ carryingEgg: 5, returning: true, progress: 0.01, spd: 1 });
    const engine = battle({ bankedGold: 100, enemiesKilled: 9, enemiesSummoned: 15, enemies: [carrier, enemy({ id: 7, hp: 1, poison: 100, poisonD: 1 })], spawnSchedule: [{ kind: 'chief', hp: 900, spd: 0.4, at: 1000 }], projectiles: [shot(carrier)] });
    engine.state.eggs.forEach(egg => { egg.status = 'escaped'; });
    engine.state.eggs[4] = { id: 5, status: 'carried', progress: null, carrier: 6 };
    const events = engine.step(10);
    expect(engine.state).toMatchObject({ phase: 'lost', gold: 120, rewardGold: 9, bankedGold: 109, rewardsApplied: true, enemiesKilled: 9, enemiesSummoned: 15, enemies: [], projectiles: [], spawnSchedule: [] });
    expect(events.filter(event => event.type === 'result')).toHaveLength(1);
    const result = engine.snapshot();
    expect(engine.step(100000)).toEqual([]);
    engine.restore(JSON.parse(JSON.stringify(result)) as GameState);
    expect(engine.step(100000)).toEqual([]);
    expect(engine.snapshot()).toEqual(result);
  });

  it('wins after the final wave and rewards all intact eggs, including dropped eggs', () => {
    const target = enemy({ hp: 20 });
    const engine = battle({ wave: 5, bankedGold: 80, enemiesKilled: 30, enemiesSummoned: 50, enemies: [target], projectiles: [shot(target)] });
    engine.state.eggs[0].status = 'escaped';
    engine.state.eggs[1] = { id: 2, status: 'dropped', progress: 8, carrier: null };
    const events = engine.step(10);
    expect(engine.state).toMatchObject({ phase: 'won', gold: 120 + 12 + 75, enemiesKilled: 31, enemiesSummoned: 50, rewardGold: 71, bankedGold: 151, rewardsApplied: true });
    expect(events.filter(event => event.type === 'result')).toEqual([{ type: 'result' }]);
    expect(events).toContainEqual({ type: 'save' });
    const state = engine.snapshot();
    engine.step(10);
    expect(engine.snapshot()).toEqual(state);
  });

  it('does not clear a wave while scheduled enemies remain', () => {
    const engine = battle({ enemies: [], spawnSchedule: [{ kind: 'scout', hp: 45, spd: 0.72, at: 500 }] });
    engine.step(10);
    expect(engine.state).toMatchObject({ phase: 'battle', gold: 120 });
  });

  it('completes an undefended run with a loss and five escaped eggs', () => {
    const engine = new GameEngine();
    engine.dispatch({ type: 'startWave' });
    const results = [];
    for (let i = 0; i < 3000 && engine.state.phase === 'battle'; i++) results.push(...engine.step(10).filter(event => event.type === 'result'));
    expect(engine.state.phase).toBe('lost');
    expect(engine.state.eggs.every(egg => egg.status === 'escaped')).toBe(true);
    expect(engine.state).toMatchObject({ enemiesKilled: 0, rewardGold: 0, rewardsApplied: true, bankedGold: 0 });
    expect(results).toHaveLength(1);
  });
});

describe('snapshot and exact restore', () => {
  it('copies every mutable collection in construction, snapshots, and restores', () => {
    const state = battle({ towers: [{ type: 'fire', level: 1, cooldown: 100 }, null, null, null, null], projectiles: [shot(enemy())], spawnSchedule: [{ kind: 'scout', hp: 45, spd: 0.72, at: 500 }], knownMonsters: ['scout'] }).snapshot();
    const engine = new GameEngine(state);
    const expected = engine.snapshot();
    const snapshot = engine.snapshot();
    snapshot.towers[0]!.level = 20;
    snapshot.enemies[0].hp = 0;
    snapshot.projectiles[0].damage = 10000;
    snapshot.eggs[0].status = 'escaped';
    snapshot.spawnSchedule[0].at = 0;
    snapshot.knownMonsters.push('chief');
    expect(engine.snapshot()).toEqual(expected);
    state.enemies[0].hp = 1;
    expect(engine.snapshot()).toEqual(expected);
    engine.restore(expected);
    expected.enemies[0].hp = 0;
    expect(engine.state.enemies[0].hp).toBe(45);
  });

  it('restores a running battle exactly without force-pausing or normalizing any fields', () => {
    const carrier = enemy({ returning: true, carryingEgg: 1, progress: 10, slow: 33, poison: 650, poisonD: 123 });
    const state = battle({ speed: 2, simulationTime: 1234, enemies: [carrier], projectiles: [shot(carrier)], towers: [{ type: 'poison', level: 2, cooldown: 356 }, null, null, null, null], chosen: 'ice', selected: 0, nextEntityId: 21, spawnSchedule: [{ kind: 'chief', hp: 900, spd: 0.4, at: 1678 }] }).snapshot();
    state.eggs[0] = { id: 1, status: 'carried', progress: null, carrier: 6 };
    const engine = new GameEngine();
    engine.restore(state);
    expect(engine.snapshot()).toEqual(state);
    expect(engine.state.paused).toBe(false);
    state.paused = true;
    engine.restore(state);
    expect(engine.snapshot()).toEqual(state);
  });

  it('continues identically after a JSON round trip in the middle of combat', () => {
    const live = new GameEngine();
    live.dispatch({ type: 'choose', dragon: 'poison' });
    live.dispatch({ type: 'perch', index: 0 });
    live.dispatch({ type: 'choose', dragon: 'ice' });
    live.dispatch({ type: 'perch', index: 2 });
    live.dispatch({ type: 'speed', speed: 1.5 });
    live.dispatch({ type: 'startWave' });
    for (let i = 0; i < 123; i++) live.step(10);
    const resumed = new GameEngine();
    resumed.restore(JSON.parse(JSON.stringify(live.snapshot())) as GameState);
    for (let i = 0; i < 1500; i++) expect(resumed.step(10)).toEqual(live.step(10));
    expect(resumed.snapshot()).toEqual(live.snapshot());
  });
});
