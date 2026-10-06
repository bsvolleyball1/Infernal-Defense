import { describe, expect, it } from 'vitest';
import { map, positionAt } from '../src/content/catalog';
import { GameEngine, createInitialState } from '../src/game/engine';
import { SaveRepository } from '../src/services/storage';
import { battlefieldArtwork } from '../src/ui/battlefield';

describe('eight-roost gorge battlefield', () => {
  it('draws the same route the engine traverses, with a nest at the endpoint', () => {
    const route = map.path.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x} ${y}`).join(' ');
    expect(battlefieldArtwork()).toContain(`id="battle-route" d="${route}"`);
    expect(positionAt(map.path.length - 1)).toEqual([map.nest.x, map.nest.y + 21]);
    expect(battlefieldArtwork()).toContain('id="gorgeWater"');
  });

  it('generates exactly eight roosts from the catalog with independent placement', () => {
    const artwork = battlefieldArtwork();
    expect(artwork.match(/class="perch"/g)).toHaveLength(8);
    const state = createInitialState();
    state.gold = 1000;
    const engine = new GameEngine(state);
    for (const [index, perch] of map.perches.entries()) {
      expect(artwork).toContain(`data-id="${index}" transform="translate(${perch.x} ${perch.y})"`);
      expect(perch.x).toBeGreaterThan(27);
      expect(perch.y).toBeGreaterThan(27);
      expect(perch.x).toBeLessThan(map.width - 27);
      expect(perch.y).toBeLessThan(map.height - 27);
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
