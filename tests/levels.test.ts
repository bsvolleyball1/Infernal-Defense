import { describe, expect, it } from 'vitest';
import { getMap, routesFor } from '../src/content/catalog';
import { GameEngine, createInitialState } from '../src/game/engine';
import { entityPosition } from '../src/game/geometry';
import { moveEnemy, dropEgg } from '../src/game/eggs';
import { updateTowers, updateProjectiles } from '../src/game/combat';
import { SaveRepository } from '../src/services/storage';
import { battlefieldArtwork } from '../src/ui/battlefield';
import type { Enemy, GameEvent, GameState, Level } from '../src/game/types';

function enemy(routeId: number, progress = 5): Enemy {
  return { id: routeId + 6, kind: 'scout', hp: 45, max: 45, spd: .72, progress,
    slow: 0, poison: 0, poisonD: 0, carryingEgg: null,
    returning: false, escaped: false, rewarded: false, routeId };
}
function forkBattle(): GameState {
  const state = createInitialState('volcanic');
  state.phase = 'battle'; state.wave = 1;
  state.enemies = [enemy(0), enemy(1)]; state.enemiesSummoned = 2; state.nextEntityId = 8;
  return state;
}
function storage(state: GameState) {
  const key = 'infernalDefense.save.0';
  const raw = JSON.stringify({ version: 2, savedAt: 123, state });
  const data = new Map([[key, raw]]);
  const repository = new SaveRepository({ getItem: k => data.get(k) ?? null,
    setItem: (k, v) => { data.set(k, v); } });
  return { repository, data, key, raw };
}

describe('selectable battlefield definitions', () => {
  it.each<[Level, number, number]>([['level1', 8, 1], ['meadow', 5, 1], ['volcanic', 10, 2]])(
    '%s has %s independent roosts and %s routes', (level, count, routeCount) => {
      const map = getMap(level);
      const state = createInitialState(level); state.gold = 2000;
      const engine = new GameEngine(state);
      expect(state.towers).toHaveLength(count);
      expect(routesFor(map)).toHaveLength(routeCount);
      expect(battlefieldArtwork(level).match(/class="perch"/g)).toHaveLength(count);
      for (let i = 0; i < count; i++) {
        engine.dispatch({ type: 'choose', dragon: 'fire' }); engine.dispatch({ type: 'perch', index: i });
      }
      expect(engine.state.towers.every(tower => tower?.type === 'fire')).toBe(true);
      expect(engine.dispatch({ type: 'perch', index: count })).toEqual([]);
      engine.dispatch({ type: 'upgrade' }); expect(engine.state.towers[count - 1]?.level).toBe(2);
      engine.dispatch({ type: 'sell' }); expect(engine.state.towers[count - 1]).toBeNull();
      for (const path of routesFor(map)) {
        expect(path).toHaveLength(17);
        expect(path.at(-1)).toEqual([map.nest.x, map.nest.y + 21]);
        const d = path.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
        expect(battlefieldArtwork(level)).toContain(`d="${d}"`);
      }
    });

  it('assigns alternating routes across wave groups and future spawns', () => {
    const engine = new GameEngine(createInitialState('volcanic'));
    engine.dispatch({ type: 'startWave' });
    expect(engine.state.spawnSchedule.map(s => s.routeId)).toEqual([0, 1, 0, 1, 0, 1, 0, 1, 0, 1]);
    engine.step(1000 / 60); expect(engine.state.enemies[0].routeId).toBe(0);
    for (let i = 0; i < 60; i++) engine.step(1000 / 60);
    expect(engine.state.enemies.some(e => e.routeId === 1)).toBe(true);
  });

  it('keeps route positions separate between the split and merge', () => {
    const state = forkBattle();
    expect(entityPosition(state, state.enemies[0])).toEqual([270, 80]);
    expect(entityPosition(state, state.enemies[1])).toEqual([270, 350]);
    expect(entityPosition(state, { progress: 1.5, routeId: 0 })).toEqual(entityPosition(state, { progress: 1.5, routeId: 1 }));
    expect(entityPosition(state, { progress: 13.5, routeId: 0 })).toEqual(entityPosition(state, { progress: 13.5, routeId: 1 }));
  });

  it.each([0, 1])('picks up an egg at the nest and reverses along route %s', routeId => {
    const state = forkBattle(); const raider = state.enemies[routeId]; raider.progress = 15.99;
    moveEnemy(state, raider, 100);
    expect(raider).toMatchObject({ progress: 16, returning: true, carryingEgg: 1, routeId });
    expect(state.eggs[0]).toMatchObject({ status: 'carried', routeId, carrier: raider.id });
    moveEnemy(state, raider, 100);
    expect(raider.progress).toBeLessThan(16);
    dropEgg(state, raider);
    expect(state.eggs[0]).toMatchObject({ status: 'dropped', routeId, progress: raider.progress });
  });

  it('does not pick up a dropped egg on the other branch', () => {
    const state = forkBattle(); state.eggs[0] = { id: 1, status: 'dropped', progress: 5.02, carrier: null, routeId: 1 };
    moveEnemy(state, state.enemies[0], 100);
    expect(state.eggs[0].status).toBe('dropped');
    moveEnemy(state, state.enemies[1], 100);
    expect(state.eggs[0]).toMatchObject({ status: 'carried', carrier: 7, routeId: 1 });
  });

  it.each([1.02, 3, 13.02])('allows cross-route recovery on shared trail at %s', progress => {
    const state = forkBattle(); state.enemies[0].progress = progress - .01;
    state.eggs[0] = { id: 1, status: 'dropped', progress, carrier: null, routeId: 1 };
    moveEnemy(state, state.enemies[0], 100);
    expect(state.eggs[0]).toMatchObject({ status: 'carried', carrier: 6, routeId: 0 });
  });

  it('targets both branches and resolves projectiles against route-specific coordinates', () => {
    const state = forkBattle(); const events: GameEvent[] = [];
    state.towers[3] = { type: 'fire', level: 1, cooldown: 0 };
    state.towers[6] = { type: 'ice', level: 1, cooldown: 0 };
    updateTowers(state, 1000 / 60, events);
    expect(state.projectiles.map(p => p.targetId)).toEqual([6, 7]);
    state.projectiles.forEach(p => { const target = state.enemies.find(e => e.id === p.targetId)!;
      [p.x, p.y] = entityPosition(state, target); });
    updateProjectiles(state, 1000 / 60, events);
    expect(state.enemies[0].hp).toBeLessThan(45);
    expect(state.enemies[1].slow).toBeGreaterThan(0);
  });

  it.each([1, 1.5, 2] as const)('restores forked combat and future spawns exactly at %sx', speed => {
    const state = forkBattle(); state.speed = speed; state.nextEntityId = 9;
    state.enemies[0].carryingEgg = 1; state.enemies[0].returning = true;
    state.enemies[0].poison = 400; state.enemies[0].poisonD = 200;
    state.enemies[1].slow = 300;
    state.eggs[0] = { id: 1, status: 'carried', progress: null, carrier: 6, routeId: 0 };
    state.eggs[1] = { id: 2, status: 'dropped', progress: 8, carrier: null, routeId: 1 };
    state.towers[6] = { type: 'ice', level: 2, cooldown: 321 };
    state.projectiles = [{ id: 8, x: 275, y: 263, targetId: 7, dragon: 'ice', damage: 8, speed: 5, level: 2 }];
    state.spawnSchedule = [{ kind: 'shield', hp: 120, spd: .47, at: 1000, routeId: 1 }];
    const { repository } = storage(state);
    const read = repository.readSlot(0); expect(read.status).toBe('valid');
    if (read.status !== 'valid') throw new Error('Forked save did not load');
    const original = new GameEngine(state); const restored = new GameEngine(read.data.state);
    for (let i = 0; i < 1500; i++) expect(restored.step(1000 / 60)).toEqual(original.step(1000 / 60));
    expect(restored.snapshot()).toEqual(original.snapshot());
    expect(repository.saveSlot(0, restored.snapshot())).toEqual({ ok: true });
  });

  it.each<[(s: GameState) => void]>([
    [s => { s.enemies[0].routeId = 2; }], [s => { delete s.enemies[0].routeId; }],
    [s => { s.towers.pop(); }], [s => { s.selected = 10; }],
    [s => { s.spawnSchedule = [{ kind: 'scout', hp: 45, spd: .72, at: 100, routeId: 8 }]; }],
    [s => { s.eggs[0] = { id: 1, status: 'dropped', progress: 5, carrier: null }; }],
    [s => { s.enemies[0].carryingEgg = 1; s.enemies[0].returning = true;
      s.eggs[0] = { id: 1, status: 'carried', progress: null, carrier: 6, routeId: 1 }; }],
  ])('preserves unreadable forked saves with invalid geometry or references', mutate => {
    const state = forkBattle(); mutate(state); const { repository, data, key, raw } = storage(state);
    expect(repository.readSlot(0).status).toBe('error'); expect(data.get(key)).toBe(raw);
  });

  it('keeps the new five-roost level at five, without legacy gorge expansion', () => {
    const { repository } = storage(createInitialState('meadow'));
    expect(repository.readSlot(0)).toMatchObject({ status: 'valid', migrated: false, data: { state: { towers: [null, null, null, null, null] } } });
  });

  it.each([0, 1])('lets a carrier escape on route %s without duplicating kill gold', routeId => {
    const state = forkBattle(); const raider = state.enemies[routeId];
    raider.progress = .001; raider.returning = true; raider.carryingEgg = 1;
    state.eggs[0] = { id: 1, status: 'carried', progress: null, carrier: raider.id, routeId };
    expect(moveEnemy(state, raider, 100)).toBe(true);
    expect(raider).toMatchObject({ escaped: true, carryingEgg: null, hp: 0 });
    expect(state.eggs[0].status).toBe('escaped'); expect(state.gold).toBe(120);
  });
});
