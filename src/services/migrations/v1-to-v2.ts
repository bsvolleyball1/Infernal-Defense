import { eggReturnDelay, maximumMana, upgradedEggCount } from '../../content/defense-rules';
import { gorge as map } from '../../content/maps';
import { createDefenseState } from '../../game/defense-state';
import { nodeIndex } from '../../content/upgrades';
import { terminalRewardGold } from '../../game/rewards';
import { createInitialState } from '../../game/state';
import type { GameState } from '../../game/types';
import { eggs, kinds, towers, validateSave } from '../save-schema';
import type { SaveDataV2 } from '../save-schema';
import { array, check, choice, integer, number, object, own } from '../validation/primitives';
import type { RecordValue } from '../validation/primitives';

function numeric(value: RecordValue, key: string, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  if (!own(value, key)) return fallback;
  integer(value[key], `Legacy ${key}`, 0, max);
  return value[key] as number;
}

function numericRank(value: unknown): number {
  integer(value, 'Legacy attack rank', 0, 1000);
  return value;
}

/** v1 stores a restartable checkpoint, never an exact combat snapshot. */
export function migrateV1ToV2(value: RecordValue): SaveDataV2 {
  const expanded = own(value, 'mana') || own(value, 'permanentRanks') || own(value, 'permanentUpgrades');
  const state = expanded ? createDefenseState() : createInitialState();
  const savedAt = numeric(value, 'savedAt', 0);
  state.gold = numeric(value, 'gold', state.gold);
  state.bankedGold = numeric(value, 'bankedGold', 0);
  state.wave = numeric(value, 'wave', 0, 5);
  state.enemiesKilled = numeric(value, 'enemiesKilled', 0);
  state.enemiesSummoned = numeric(value, 'enemiesSummoned', state.enemiesKilled);
  if (expanded) {
    const defense = state.defense!;
    for (const [source, dest] of [
      ['fire', 'fire'],
      ['green', 'poison'],
      ['blue', 'ice'],
    ] as const) {
      if (own(value, 'permanentRanks')) {
        object(value.permanentRanks, 'Legacy upgrade ranks');
        const ranks = value.permanentRanks[source];
        array(ranks, 'Legacy ranks');
        check(ranks.length === 5, 'Legacy ranks must contain five nodes.');
        ranks.forEach((n) => integer(n, 'Legacy rank', 0, 1000));
        defense.ranks[dest] = [...(ranks as number[]), 0];
      }
      if (own(value, 'permanentUpgrades')) {
        object(value.permanentUpgrades, 'Legacy attack upgrades');
        defense.ranks[dest][nodeIndex(dest, 'attackPower')] = numericRank(value.permanentUpgrades[source]);
      }
    }
    defense.maxMana = maximumMana(defense.ranks.fire[nodeIndex('fire', 'totalMana')]);
    if (own(value, 'maxMana')) {
      number(value.maxMana, 'Legacy maximum mana', 1);
      defense.maxMana = value.maxMana as number;
    }
    if (own(value, 'mana')) {
      number(value.mana, 'Legacy mana', 0, defense.maxMana);
      defense.mana = value.mana as number;
    }
    const count = Array.isArray(value.eggs)
      ? value.eggs.length
      : Math.max(upgradedEggCount(defense.ranks.poison[nodeIndex('poison', 'moreEggs')]), numeric(value, 'lives', 0, 8));
    check(count >= 3 && count <= 8, 'Invalid legacy egg count.');
    state.eggs = Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      status: 'nest',
      progress: null,
      carrier: null,
    }));
    state.nextEntityId = state.eggs.length + 1;
  }
  const lives = numeric(value, 'lives', state.eggs.length, state.eggs.length);
  if (own(value, 'activeLevel')) {
    choice(value.activeLevel, ['level1', 'tutorial'], 'Legacy level');
    state.activeLevel = value.activeLevel as GameState['activeLevel'];
  }
  if (own(value, 'knownMonsters')) {
    kinds(value.knownMonsters, false);
    state.knownMonsters = [...new Set(value.knownMonsters as string[])];
  }
  if (own(value, 'towers')) {
    towers(value.towers, map, true);
    state.towers = (value.towers as unknown[]).map((item) => {
      if (item === null) return null;
      const tower = item as RecordValue;
      return { type: tower.type, level: tower.level, cooldown: 0 } as NonNullable<GameState['towers'][number]>;
    });
    while (state.towers.length < map.perches.length) state.towers.push(null);
  }
  if (own(value, 'eggs')) {
    eggs(value.eggs, true, map, state.eggs.length);
    state.eggs = (value.eggs as RecordValue[]).map((item) => ({
      id: item.id,
      status: item.status === 'carried' ? 'dropped' : item.status,
      progress: item.status === 'carried' ? (item.progress ?? map.path.length - 1) : item.progress,
      carrier: null,
    })) as GameState['eggs'];
  } else {
    state.eggs = state.eggs.map((item, i) => ({ ...item, status: i < lives ? 'nest' : 'escaped' }));
  }
  const remaining = state.eggs.filter((item) => item.status !== 'escaped').length;
  if (state.defense)
    for (const egg of state.eggs)
      if (egg.status === 'dropped') egg.returnTimer = eggReturnDelay(state.defense.ranks.fire[nodeIndex('fire', 'eggReturn')]);
  state.phase = remaining === 0 ? 'lost' : state.wave === 5 ? 'won' : 'ready';
  state.rewardsApplied = state.phase === 'won' || state.phase === 'lost';
  // Terminal v1 saves already banked this reward; adding it again would duplicate it.
  state.rewardGold = state.rewardsApplied ? terminalRewardGold(state.enemiesKilled, remaining) : 0;
  const data: SaveDataV2 = { version: 2, savedAt, state };
  validateSave(data);
  return data;
}
