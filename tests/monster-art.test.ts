import { describe, expect, it } from 'vitest';
import { playableMonsters } from '../src/content/enemies';
import { monsterPortrait } from '../src/ui/monster-art';

describe('monster portraits', () => {
  it('provides a distinct portrait for every playable monster', () => {
    const portraits = playableMonsters.map(monsterPortrait);
    expect(new Set(portraits).size).toBe(playableMonsters.length);
    expect(portraits.every(portrait => portrait.endsWith('.png'))).toBe(true);
  });

  it('uses matching portraits for the legacy raider types', () => {
    expect(monsterPortrait('scout')).toBe(monsterPortrait('imp'));
    expect(monsterPortrait('shield')).toBe(monsterPortrait('gargoyle'));
    expect(monsterPortrait('runner')).toBe(monsterPortrait('seaSerpent'));
    expect(monsterPortrait('chief')).toBe(monsterPortrait('devil'));
  });
});
