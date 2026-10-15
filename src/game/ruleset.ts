import { stepDefense } from './defense-simulation';
import { stepLegacy } from './legacy/simulation';
import type { DefenseBattle, GameEvent, GameState, LegacyBattle } from './types';

export interface Currency {
  name: 'gold' | 'food';
  icon: string;
}

/** Behavior that differs between the original rules and `defense-1`. */
export interface Ruleset<S extends GameState> {
  readonly currency: Currency;
  /** Whether simulation time advances in the current phase while unpaused. */
  isSimulating(state: S): boolean;
  step(state: S, elapsedMs: number): GameEvent[];
}

export const legacyRuleset: Ruleset<LegacyBattle> = {
  currency: { name: 'gold', icon: '✦' },
  isSimulating: (state) => state.phase === 'battle',
  step: stepLegacy,
};

/** Ready phases also simulate, for mana regeneration and the wave countdown. */
export const defenseRuleset: Ruleset<DefenseBattle> = {
  currency: { name: 'food', icon: '🥩' },
  isSimulating: (state) => state.phase === 'battle' || state.phase === 'ready',
  step: stepDefense,
};

// The only place that chooses a ruleset from the state's tag.

export function isSimulating(state: GameState): boolean {
  return state.defense ? defenseRuleset.isSimulating(state) : legacyRuleset.isSimulating(state);
}

export function stepBattle(state: GameState, elapsedMs: number): GameEvent[] {
  return state.defense ? defenseRuleset.step(state, elapsedMs) : legacyRuleset.step(state, elapsedMs);
}

export function currencyOf(state: GameState): Currency {
  return state.defense ? defenseRuleset.currency : legacyRuleset.currency;
}
