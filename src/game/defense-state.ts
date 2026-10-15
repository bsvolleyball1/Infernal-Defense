import { createInitialState } from './state';
import { defenseRules, upgradedEggCount } from '../content/defense-rules';
import { nodeIndex } from '../content/upgrades';
import type { UpgradeNodeId } from '../content/upgrades';
import type { DefenseState, DragonType, GameState, Level, Tower } from './types';

export function createDefenseState(level: Level = 'level1', previous?: GameState, sandbox = false): GameState {
  const state = createInitialState(level, previous?.bankedGold ?? 0);
  const ranks: DefenseState['ranks'] = previous?.defense
    ? structuredClone(previous.defense.ranks)
    : { fire: [0, 0, 0, 0, 0, 0], ice: [0, 0, 0, 0, 0, 0], poison: [0, 0, 0, 0, 0, 0] };
  if (sandbox)
    for (const dragon of ['fire', 'ice', 'poison'] as const)
      ranks[dragon][nodeIndex(dragon, 'maxLevel')] = defenseRules.sandboxMaxLevelRank;
  const totalMana = ranks.fire[nodeIndex('fire', 'totalMana')];
  const startingMana = ranks.poison[nodeIndex('poison', 'startingMana')];
  const startingFood = ranks.ice[nodeIndex('ice', 'startingFood')];
  state.defense = {
    ruleset: 'defense-1',
    mode: sandbox ? 'sandbox' : 'journey',
    ranks,
    mana: Math.min(
      defenseRules.baseMana + defenseRules.manaPerTotalManaRank * totalMana,
      defenseRules.startingManaPerRank * startingMana,
    ),
    maxMana: defenseRules.baseMana + defenseRules.manaPerTotalManaRank * totalMana,
    rng: 0x12345678,
    countdown: null,
    spellCooldowns: { fire: 0, ice: 0, poison: 0 },
    targeting: null,
    preview: null,
    impacts: [],
    visuals: [],
    testWave: { imp: 3 },
  };
  state.gold += defenseRules.startingFoodPerRank * startingFood;
  const count = upgradedEggCount(ranks.poison[nodeIndex('poison', 'moreEggs')]);
  state.eggs = Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    status: 'nest',
    progress: null,
    carrier: null,
  }));
  state.nextEntityId = count + 1;
  state.knownMonsters = [...(previous?.knownMonsters ?? [])];
  return state;
}

export function nextBattle(previous: GameState, level: Level): GameState {
  return createDefenseState(level, previous);
}

export function rankOf(state: GameState, dragon: DragonType, id: UpgradeNodeId): number {
  return state.defense?.ranks[dragon][nodeIndex(dragon, id)] ?? 0;
}

/** Sums every node except attack power, which stays the last stored rank. */
export const rankTotal = (state: GameState, dragon: DragonType): number => {
  const attackPower = nodeIndex(dragon, 'attackPower');
  return state.defense?.ranks[dragon].reduce((sum, n, index) => (index === attackPower ? sum : sum + n), 0) ?? 0;
};

export const levelCap = (state: GameState, tower: Tower): number =>
  state.defense
    ? Math.min(defenseRules.maximumDragonLevel, defenseRules.baseDragonLevel + rankOf(state, tower.type, 'maxLevel'))
    : Infinity;

export function randomValue(state: GameState): number {
  const defense = state.defense!;
  let x = defense.rng;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  defense.rng = x >>> 0;
  return defense.rng / 0x100000000;
}
