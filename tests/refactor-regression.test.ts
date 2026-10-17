import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { GameEngine, createInitialState } from '../src/game/engine';
import type { DragonType, GameCommand, GameSpeed } from '../src/game/types';
import { colorForDragon, nextForms } from '../src/content/dragon-forms';

// Freeze the original geometry for the original CLEAN oracle. The redesigned
// battlefield is tested separately; an intentional map change is not a combat regression.
vi.mock('../src/content/catalog', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/content/catalog')>();
  const legacyMap = {
      ...actual.map,
      path: [[-30, 300], [80, 300], [145, 280], [195, 220], [195, 165], [180, 105], [250, 105], [315, 115], [350, 155], [385, 205], [440, 207], [492, 176], [540, 172], [570, 205], [590, 250], [625, 253], [663, 185]] as [number, number][],
      perches: [{ x: 90, y: 202 }, { x: 260, y: 68 }, { x: 355, y: 279 }, { x: 485, y: 83 }, { x: 563, y: 307 }],
  };
  return { ...actual, map: legacyMap, getMap: () => legacyMap,
    positionAt: (progress: number) => actual.positionAt(progress, legacyMap) };
});

// Each digest covers every command event, step event, and complete state snapshot.
const evolutionTraces: [GameSpeed, string][] = [
  [1, '64eae6ecacbd21657b392bb7e5c3bbf11b053207e73a90ad1cfeb7b9ce3d2491'],
  [1.5, 'de9dcd385495f0481a81134af354907e569de0daf77b093e43468cad9ca54904'],
  [2, '91f0c5d59abb947bc437efc2d97fdec75f1d058c3347985119a02bf9058a5144'],
];

describe('deterministic evolution gameplay trace', () => {
  it.each(evolutionTraces)('matches the 4,000-step trace at %sx', (speed, expected) => {
    const initial = createInitialState();
    initial.gold = 1000;
    initial.speed = speed;
    const engine = new GameEngine(initial);
    const hash = createHash('sha256');
    const dispatch = (command: GameCommand) => hash.update(JSON.stringify(engine.dispatch(command)));
    const upgrade = () => {
      const tower = engine.state.towers[engine.state.selected ?? -1];
      if (!tower) return dispatch({ type: 'upgrade' });
      const color = colorForDragon[tower.type];
      const form = nextForms(tower, color)[0];
      return form
        ? dispatch({ type: 'upgrade', color, form })
        : dispatch({ type: 'upgrade' });
    };
    const placements: DragonType[] = ['fire', 'ice', 'poison', 'fire', 'ice'];
    for (const [index, dragon] of placements.entries()) {
      dispatch({ type: 'choose', dragon });
      dispatch({ type: 'perch', index });
    }
    for (let tick = 0; tick < 4000; tick++) {
      if (engine.state.phase === 'ready') dispatch({ type: 'startWave' });
      if (tick === 100 || tick === 700) {
        dispatch({ type: 'perch', index: 2 });
        upgrade();
      }
      if (tick === 300) dispatch({ type: 'pause' });
      if (tick === 320) dispatch({ type: 'resume' });
      if (tick === 600) engine.restore(engine.snapshot());
      hash.update(JSON.stringify(engine.step(1000 / 60)));
      hash.update(JSON.stringify(engine.snapshot()));
    }
    expect(hash.digest('hex')).toBe(expected);
  });
});
