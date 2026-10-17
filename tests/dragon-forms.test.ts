import { describe, expect, it } from 'vitest';
import { formsForColors } from '../src/content/dragon-forms';
import type { DragonColor } from '../src/game/types';

describe('unordered dragon color combinations', () => {
  it.each([
    [['red', 'red'], ['red2']],
    [['red', 'blue'], ['purple']],
    [['red', 'yellow'], ['orange']],
    [['blue', 'blue'], ['blue2']],
    [['blue', 'yellow'], ['green']],
    [['yellow', 'yellow'], ['yellow2']],
  ] as const)('maps %j to %j', (colors, forms) => {
    expect(formsForColors([...colors] as DragonColor[])).toEqual(forms);
    expect(formsForColors([...colors].reverse() as DragonColor[])).toEqual(forms);
  });

  it.each([
    [['red', 'red', 'red'], ['red3']],
    [['red', 'red', 'blue'], ['bloodRed', 'purple2']],
    [['red', 'red', 'yellow'], ['pink', 'orange2']],
    [['red', 'blue', 'blue'], ['black', 'purple2']],
    [['blue', 'blue', 'blue'], ['blue3']],
    [['blue', 'blue', 'yellow'], ['gray', 'green2']],
    [['blue', 'yellow', 'yellow'], ['turquoise', 'green2']],
    [['yellow', 'yellow', 'yellow'], ['yellow3']],
    [['red', 'yellow', 'yellow'], ['sun', 'orange2']],
    [['red', 'blue', 'yellow'], ['white']],
  ] as const)('maps tier-three %j to all resulting forms', (colors, forms) => {
    expect(formsForColors([...colors] as DragonColor[])).toEqual(forms);
    expect(formsForColors([...colors].reverse() as DragonColor[])).toEqual(forms);
  });
});
