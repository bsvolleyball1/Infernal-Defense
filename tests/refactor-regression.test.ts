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

// Captured from the working pre-CLEAN engine, not regenerated from the refactor.
// Each digest covers every command event, step event, and complete state snapshot.
const originalTraces: [GameSpeed, string][] = [
  [1, '3c54300af66bbbbdc494340cfe77ccbaa907e3d8a0763ee0e1a3a0995f46cdba'],
  [1.5, 'de38586462b953e1d7c26e59f86a2450a3c0c6dd3f4ff486320015cadfd6cf72'],
  [2, 'ddc4612ef6bec29888f5a97904b29b270ed2d102e4a13656a4a7411e755b3e89'],
];

describe('behavior-preserving CLEAN refactor', () => {
  it.each(originalTraces)('matches the pre-refactor 4,000-step trace at %sx', (speed, expected) => {
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
