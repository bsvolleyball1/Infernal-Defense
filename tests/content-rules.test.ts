import { describe, expect, it } from 'vitest';
import { enemyTraits } from '../src/content/enemies';
import { nodeIndex } from '../src/content/upgrades';
import { createDefenseState, rankOf, rankTotal } from '../src/game/defense-state';
import { clampToBattlefield, isInsideBattlefield } from '../src/game/geometry';
import { gorge } from '../src/content/maps';

describe('upgrade nodes', () => {
  it('keeps saved rank indexes stable while callers use node ids', () => {
    expect(nodeIndex('fire', 'placementMana')).toBe(2);
    expect(nodeIndex('fire', 'eggReturn')).toBe(4);
    expect(nodeIndex('poison', 'iceDuration')).toBe(3);
    expect(nodeIndex('poison', 'foodFromKills')).toBe(4);
    expect(nodeIndex('ice', 'carrierDamage')).toBe(4);
    expect(nodeIndex('ice', 'attackPower')).toBe(5);
    const state = createDefenseState();
    state.defense!.ranks.fire[nodeIndex('fire', 'placementMana')] = 2;
    state.defense!.ranks.poison = [1, 1, 1, 1, 1, 4];
    expect(rankOf(state, 'fire', 'placementMana')).toBe(2);
    expect(rankTotal(state, 'poison')).toBe(5);
  });
});

describe('enemy traits', () => {
  it('describes resistances and spell immunity without a kind switch', () => {
    expect(enemyTraits('hellhound').resist).toEqual({ fire: 0.25 });
    expect(enemyTraits('skeleton').resist).toEqual({ all: 0.5 });
    expect(enemyTraits('witch').spellImmune).toBe(true);
    expect(enemyTraits('shade').directPath).toBe(true);
    expect(enemyTraits('scout')).toEqual({});
  });
});

describe('battlefield bounds', () => {
  it('clamps spell points to the active map', () => {
    expect(clampToBattlefield({ x: -4, y: 900 }, gorge)).toEqual({ x: 0, y: gorge.height });
    expect(isInsideBattlefield({ x: gorge.width, y: gorge.height }, gorge)).toBe(true);
    expect(isInsideBattlefield({ x: gorge.width + 1, y: 0 }, gorge)).toBe(false);
  });
});
