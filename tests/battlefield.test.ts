import { describe, expect, it } from 'vitest';
import { getMap, map, positionAt } from '../src/content/catalog';
import { battlefields } from '../src/content/maps';
import { GameEngine, createInitialState } from '../src/game/engine';
import { updateTowers } from '../src/game/combat';
import { canPlaceTower, isClearTowerPosition } from '../src/game/geometry';
import { SaveRepository } from '../src/services/storage';
import { battlefieldArtwork } from '../src/ui/battlefield';
import type { Enemy, Level } from '../src/game/types';

function enemy(routeId: number, progress = 8): Enemy {
  return { id: 12, kind: 'scout', hp: 45, max: 45, spd: .72, progress,
    slow: 0, poison: 0, poisonD: 0, carryingEgg: null,
    returning: false, escaped: false, rewarded: false, routeId };
}

function storage() {
  const values = new Map<string, string>();
  const repository = new SaveRepository({
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
  });
  return { repository };
}

describe('free-placement gorge battlefield', () => {
  it('shows five valid bonus areas on every battlefield and reserves each for one dragon', () => {
    const kinds = ['damage', 'range', 'mana', 'food', 'gold'].sort();
    for (const level of Object.keys(battlefields) as Level[]) {
      const geometry = getMap(level);
      expect(geometry.bonusAreas.map(area => area.kind).sort()).toEqual(kinds);
      for (const area of geometry.bonusAreas) {
        expect(isClearTowerPosition({ x: area.x, y: area.y }, geometry), `${level}: ${area.kind} zone`).toBe(true);
      }
      expect(battlefieldArtwork(level)).toContain('class="bonus-area');
    }

    const geometry = getMap('meadow');
    const state = createInitialState();
    state.activeLevel = 'meadow';
    state.towers[0] = { type: 'fire', level: 1, cooldown: 0, position: { x: 510, y: 223 } };
    const secondTower = { x: 510, y: 267 };
    expect(isClearTowerPosition(secondTower, geometry)).toBe(true);
    expect(canPlaceTower(state, secondTower)).toBe(false);
  });

  it('draws the same route the engine traverses, with a nest at the endpoint', () => {
    const route = map.path.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x} ${y}`).join(' ');
    expect(battlefieldArtwork()).toContain(`id="battle-route" d="${route}"`);
    expect(positionAt(map.path.length - 1)).toEqual([map.nest.x, map.nest.y + 21]);
    expect(battlefieldArtwork()).toContain('id="gorgeWater"');
  });

  it('draws no fixed roosts and allows arbitrary, unlimited placement away from the road', () => {
    const artwork = battlefieldArtwork();
    expect(artwork).not.toContain('class="perch"');
    const state = createInitialState();
    state.gold = 100000;
    const engine = new GameEngine(state);
    const placed: { x: number; y: number }[] = [];
    for (let y = 20; y <= map.height - 20 && placed.length <= map.perches.length; y += 30) {
      for (let x = 20; x <= map.width - 20 && placed.length <= map.perches.length; x += 30) {
        const point = { x, y };
        engine.dispatch({ type: 'choose', dragon: 'fire' });
        if (engine.dispatch({ type: 'place', point }).some((event) => event.type === 'save')) placed.push(point);
      }
    }
    expect(placed.length).toBeGreaterThan(map.perches.length);
    expect(engine.state.towers.filter(Boolean)).toHaveLength(placed.length);
    expect(engine.state.towers.filter(Boolean).map((tower) => tower?.position)).toEqual(placed);

    engine.dispatch({ type: 'choose', dragon: 'fire' });
    expect(engine.dispatch({ type: 'place', point: { x: 350, y: 315 } })).toContainEqual({
      type: 'message',
      text: 'Choose a clear area away from the road and other dragons',
    });
    expect(engine.state.towers.filter(Boolean)).toHaveLength(placed.length);
  });

  it('uses arbitrary tower coordinates for range, combat, and exact save restoration', () => {
    const state = createInitialState();
    state.phase = 'battle';
    state.wave = 1;
    state.gold = 500;
    state.nextEntityId = 13;
    state.enemies = [enemy(0)];
    state.enemiesSummoned = 1;
    const engine = new GameEngine(state);
    engine.dispatch({ type: 'choose', dragon: 'fire' });
    engine.dispatch({ type: 'place', point: { x: 230, y: 155 } });
    expect(engine.state.towers[0]?.position).toEqual({ x: 230, y: 155 });
    updateTowers(engine.state, 1000 / 60, []);
    expect(engine.state.projectiles[0]).toMatchObject({ x: 230, y: 137, targetId: 12 });
    const { repository } = storage();
    expect(repository.saveSlot(0, engine.snapshot())).toEqual({ ok: true });
    const read = repository.readSlot(0);
    expect(read.status).toBe('valid');
    if (read.status !== 'valid') throw new Error('Free-placement save did not load');
    expect(read.data.state.towers[0]?.position).toEqual({ x: 230, y: 155 });
  });

  it('keeps existing roost-coordinate commands compatible with older battles', () => {
    const state = createInitialState();
    state.gold = 1000;
    const engine = new GameEngine(state);
    for (const [index] of map.perches.entries()) {
      engine.dispatch({ type: 'choose', dragon: 'fire' });
      engine.dispatch({ type: 'perch', index });
    }
    expect(engine.snapshot().towers.every(tower => tower?.type === 'fire')).toBe(true);
    engine.dispatch({ type: 'upgrade' });
    expect(engine.state.towers[7]?.level).toBe(2);
    engine.dispatch({ type: 'sell' });
    expect(engine.state.towers[7]).toBeNull();
  });

  it('expands an old five-tower v2 battle only in memory, preserving all other saved fields', () => {
    const engine = new GameEngine();
    engine.dispatch({ type: 'choose', dragon: 'ice' });
    engine.dispatch({ type: 'perch', index: 0 });
    engine.dispatch({ type: 'startWave' });
    engine.step(100);
    const old = engine.snapshot();
    old.towers = old.towers.slice(0, 5);
    const raw = JSON.stringify({ version: 2, savedAt: 123, state: old });
    const values = new Map([['infernalDefense.save.0', raw]]);
    const repository = new SaveRepository({
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); },
    });
    const read = repository.readSlot(0);
    expect(read.status).toBe('valid');
    if (read.status !== 'valid') throw new Error('Legacy battle did not load');
    expect(read.migrated).toBe(true);
    expect(read.data.state).toEqual({ ...old, towers: [...old.towers, null, null, null] });
    expect(values.get('infernalDefense.save.0')).toBe(raw);
    expect(repository.saveSlot(0, read.data.state)).toEqual({ ok: true });
    expect(repository.readSlot(0)).toMatchObject({ status: 'valid', migrated: false });
  });

  it('saves and restores a selected eighth tower and identical subsequent battle events', () => {
    const state = createInitialState();
    state.gold = 1000;
    const original = new GameEngine(state);
    original.dispatch({ type: 'choose', dragon: 'poison' });
    original.dispatch({ type: 'perch', index: 7 });
    original.dispatch({ type: 'startWave' });
    original.step(100);
    const restored = new GameEngine(original.snapshot());
    for (let step = 0; step < 1000; step++) {
      expect(restored.step(1000 / 60)).toEqual(original.step(1000 / 60));
    }
    expect(restored.snapshot()).toEqual(original.snapshot());
  });
});
