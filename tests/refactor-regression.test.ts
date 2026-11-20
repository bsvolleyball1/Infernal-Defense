import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { GameEngine, createInitialState } from '../src/game/engine';
import type { DragonType, GameCommand, GameSpeed } from '../src/game/types';

// Freeze the original geometry for the original CLEAN oracle. The redesigned
// battlefield is tested separately; an intentional map change is not a combat regression.
vi.mock('../src/content/catalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/content/catalog')>();
  const legacyMap = {
    ...actual.map,
    path: [
      [-30, 300],
      [80, 300],
      [145, 280],
      [195, 220],
      [195, 165],
      [180, 105],
      [250, 105],
      [315, 115],
      [350, 155],
      [385, 205],
      [440, 207],
      [492, 176],
      [540, 172],
      [570, 205],
      [590, 250],
      [625, 253],
      [663, 185],
    ] as [number, number][],
    perches: [
      { x: 90, y: 202 },
      { x: 260, y: 68 },
      { x: 355, y: 279 },
      { x: 485, y: 83 },
      { x: 563, y: 307 },
    ],
  };
  return {
    ...actual,
    map: legacyMap,
    getMap: () => legacyMap,
    positionAt: (progress: number) => actual.positionAt(progress, legacyMap),
  };
});

// Rebaselined after standardizing upgraded dragon ranges to the Red dragon's starting range.
// Each digest covers every command event, step event, and complete state snapshot.
const originalTraces: [GameSpeed, string][] = [
  [1, '2156fdf83a89bdc72cee5bd2c340f6c33ee9779223f9d4dbcf4b8e29e6306226'],
  [1.5, '253c13ab95c7eb017ee377c08ef2a3b29868a48e705ec587a4b6bbd548c91697'],
  [2, '016c2ef007ee6e503f9206545e63ee596b9895122b80177d2ea8fe0fb02d34a1'],
];

describe('combat trace regression', () => {
  it.each(originalTraces)('matches the recorded 4,000-step trace at %sx', (speed, expected) => {
    const initial = createInitialState();
    initial.gold = 1000;
    initial.speed = speed;
    const engine = new GameEngine(initial);
    const hash = createHash('sha256');
    const dispatch = (command: GameCommand) => hash.update(JSON.stringify(engine.dispatch(command)));
    const placements: DragonType[] = ['fire', 'ice', 'poison', 'fire', 'ice'];
    for (const [index, dragon] of placements.entries()) {
      dispatch({ type: 'choose', dragon });
      dispatch({ type: 'perch', index });
    }
    for (let tick = 0; tick < 4000; tick++) {
      if (engine.state.phase === 'ready') dispatch({ type: 'startWave' });
      if (tick === 100 || tick === 700) {
        dispatch({ type: 'perch', index: 2 });
        dispatch({ type: 'upgrade' });
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
