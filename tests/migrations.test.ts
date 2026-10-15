import { describe, expect, it } from 'vitest';
import { gorge } from '../src/content/maps';
import { maximumMana } from '../src/content/defense-rules';
import { terminalRewardGold } from '../src/game/rewards';
import { battleRules } from '../src/game/rules';
import { expandFiveTowerSlots } from '../src/services/migrations/expand-five-towers';
import { migrateV1ToV2 } from '../src/services/migrations/v1-to-v2';
import { readMigratedSave } from '../src/services/migrations/pipeline';
import { createInitialState } from '../src/game/state';

describe('save migrations', () => {
  it('pays a finished v1 checkpoint with the same reward formula as a finished battle', () => {
    const data = migrateV1ToV2({ version: 1, savedAt: 4, wave: 5, lives: 2, enemiesKilled: 7, enemiesSummoned: 7 });
    expect(data.state.phase).toBe('won');
    expect(data.state.rewardGold).toBe(terminalRewardGold(7, 2));
    expect(data.state.rewardGold).toBe(7 + 2 * battleRules.survivingEggGold);
    expect(data.state.bankedGold).toBe(0);
  });

  it('derives legacy maximum mana from the total-mana rank', () => {
    const data = migrateV1ToV2({
      version: 1,
      savedAt: 1,
      mana: 40,
      permanentRanks: { fire: [2, 0, 0, 0, 0], green: [0, 0, 0, 0, 0], blue: [0, 0, 0, 0, 0] },
    });
    expect(data.state.defense?.maxMana).toBe(maximumMana(2));
    expect(data.state.defense?.mana).toBe(40);
  });

  it('expands a five-tower gorge save without changing the original object', () => {
    const original = {
      version: 2,
      savedAt: 1,
      state: { ...createInitialState('level1'), towers: Array.from({ length: 5 }, () => null) },
    };
    const expanded = expandFiveTowerSlots(original);
    expect(expanded.expanded).toBe(true);
    expect((expanded.value.state as { towers: unknown[] }).towers).toHaveLength(gorge.perches.length);
    expect((original.state as { towers: unknown[] }).towers).toHaveLength(5);
  });

  it('leaves an eight-tower save in place', () => {
    const save = { version: 2, savedAt: 1, state: createInitialState() };
    const read = readMigratedSave(save);
    expect(read.migrated).toBe(false);
    expect(read.data.state.towers).toHaveLength(gorge.perches.length);
  });
});
