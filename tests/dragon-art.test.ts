import { describe, expect, it } from 'vitest';
import { dragonPortrait } from '../src/ui/dragon-art';
import black from '../src/assets/dragons/black.png';
import pink from '../src/assets/dragons/pink.png';
import bloodRed from '../src/assets/dragons/bloodRed.png';
import turquoise from '../src/assets/dragons/turquoise.png';
import green from '../src/assets/dragons/green.png';
import green2 from '../src/assets/dragons/green2.png';
import yellow1 from '../src/assets/dragons/yellow-1.png';

describe('dragon tier portraits', () => {
  it('uses the dedicated Yellow tier 1 portrait', () => {
    expect(dragonPortrait('poison', 1, false, 'yellow')).toBe(yellow1);
  });

  it('uses the dedicated tier 3 form portraits', () => {
    expect(dragonPortrait('ice', 3, true, 'black')).toBe(black);
    expect(dragonPortrait('fire', 3, true, 'pink')).toBe(pink);
    expect(dragonPortrait('fire', 3, true, 'bloodRed')).toBe(bloodRed);
    expect(dragonPortrait('ice', 3, true, 'turquoise')).toBe(turquoise);
  });
  it('uses the correct Green and Green 2 icons', () => {
    expect(dragonPortrait('ice', 2, true, 'green')).toBe(green2);
    expect(dragonPortrait('ice', 3, true, 'green2')).toBe(green);
  });
  it.each(['fire', 'ice', 'poison'] as const)('uses a distinct image for each %s tier', (dragon) => {
    const tiers = [1, 2, 3].map((level) => dragonPortrait(dragon, level));
    expect(new Set(tiers).size).toBe(3);
    expect(dragonPortrait(dragon, 0)).toBe(tiers[0]);
    expect(dragonPortrait(dragon, 4)).toBe(tiers[2]);
  });
});
