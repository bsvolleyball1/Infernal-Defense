import { describe, expect, it } from 'vitest';
import { dragonPortrait } from '../src/ui/dragon-art';

describe('dragon tier portraits', () => {
  it.each(['fire', 'ice', 'poison'] as const)('uses a distinct image for each %s tier', (dragon) => {
    const tiers = [1, 2, 3].map((level) => dragonPortrait(dragon, level));
    expect(new Set(tiers).size).toBe(3);
    expect(dragonPortrait(dragon, 0)).toBe(tiers[0]);
    expect(dragonPortrait(dragon, 4)).toBe(tiers[2]);
  });
});
