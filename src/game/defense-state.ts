import { createInitialState } from './state';
import { defenseRules, upgradedEggCount } from '../content/defense-rules';
import type { DefenseState, DragonType, GameState, Level, Tower } from './types';

export function createDefenseState(
  level: Level = 'level1',
  previous?: GameState,
  sandbox = false,
): GameState {
  const state = createInitialState(level, previous?.bankedGold ?? 0);
  const ranks: DefenseState['ranks'] = previous?.defense
    ? structuredClone(previous.defense.ranks)
    : { fire: [0, 0, 0, 0, 0, 0], ice: [0, 0, 0, 0, 0, 0], poison: [0, 0, 0, 0, 0, 0] };
  if (sandbox) for (const dragon of ['fire', 'ice', 'poison'] as const) ranks[dragon][1] = 3;
  state.defense = {
    ruleset: 'defense-1',
    mode: sandbox ? 'sandbox' : 'journey',
    ranks,
    mana: Math.min(200 + 25 * ranks.fire[0], 10 * ranks.poison[0]),
    maxMana: 200 + 25 * ranks.fire[0],
    rng: 0x12345678,
    countdown: null,
    spellCooldowns: { fire: 0, ice: 0, poison: 0 },
    targeting: null,
    preview: null,
    impacts: [],
    visuals: [],
    testWave: { imp: 3 },
  };
  state.gold += 25 * ranks.ice[0];
  const count = upgradedEggCount(ranks.poison[2]);
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
export const rank = (state: GameState, dragon: DragonType, node: number): number =>
  state.defense?.ranks[dragon][node] ?? 0;
export const rankTotal = (state: GameState, dragon: DragonType): number =>
  state.defense?.ranks[dragon].slice(0, 5).reduce((sum, n) => sum + n, 0) ?? 0;
export const levelCap = (state: GameState, tower: Tower): number =>
  state.defense ? Math.min(defenseRules.maximumDragonLevel, 3 + rank(state, tower.type, 1)) : Infinity;
export function randomValue(state: GameState): number {
  const defense = state.defense!;
  let x = defense.rng;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  defense.rng = x >>> 0;
  return defense.rng / 0x100000000;
}
