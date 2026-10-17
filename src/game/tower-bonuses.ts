import { bonusAreaAt } from '../content/maps';
import { defenseRules } from '../content/defense-rules';
import { getMap } from '../content/catalog';
import { towerPosition } from './geometry';
import type { BonusAreaKind } from '../content/maps';
import type { DefenseBattle, GameState, Point } from './types';

export interface TowerBonus {
  kind: BonusAreaKind;
  damageMultiplier: number;
  rangeMultiplier: number;
  manaPerSecond: number;
  foodPerSecond: number;
  goldPerSecond: number;
}

export function towerBonus(state: GameState, index: number): TowerBonus | null {
  const tower = state.towers[index];
  if (!tower) return null;
  const match = bonusAreaAt(getMap(state.activeLevel), towerPosition(state, index));
  if (!match) return null;
  for (let other = 0; other < index; other++) {
    if (
      state.towers[other] &&
      bonusAreaAt(getMap(state.activeLevel), towerPosition(state, other))?.index === match.index
    )
      return null;
  }
  const level = tower.level;
  return {
    kind: match.area.kind,
    damageMultiplier: match.area.kind === 'damage' ? 1 + defenseRules.bonusDamagePerLevel * level : 1,
    rangeMultiplier: match.area.kind === 'range' ? 1 + defenseRules.bonusRangePerLevel * level : 1,
    manaPerSecond: match.area.kind === 'mana' ? defenseRules.bonusManaPerSecondPerLevel * level : 0,
    foodPerSecond: match.area.kind === 'food' ? defenseRules.bonusFoodPerSecondPerLevel * level : 0,
    goldPerSecond: match.area.kind === 'gold' ? defenseRules.bonusGoldPerSecondPerLevel * level : 0,
  };
}

export interface TowerContext {
  position: Point;
  range: number;
  damageMultiplier: number;
  bonus: TowerBonus | null;
}

/** One bonus-area scan for a tower. Attack and rendering reuse this for the whole tick. */
export function towerContext(state: GameState, index: number, baseRange: number): TowerContext {
  const bonus = towerBonus(state, index);
  return {
    position: towerPosition(state, index),
    range: baseRange * (bonus?.rangeMultiplier ?? 1),
    damageMultiplier: bonus?.damageMultiplier ?? 1,
    bonus,
  };
}

export function towerDamageMultiplier(state: GameState, index: number): number {
  return towerBonus(state, index)?.damageMultiplier ?? 1;
}

export function towerRangeMultiplier(state: GameState, index: number): number {
  return towerBonus(state, index)?.rangeMultiplier ?? 1;
}

/** Journey battles bank food, campaign gold and mana; sandbox battles earn nothing. */
export function produceJourneyBonusResources(state: DefenseBattle, elapsedMs: number): void {
  const defense = state.defense;
  if (defense.mode !== 'journey') return;
  for (let index = 0; index < state.towers.length; index++) {
    const bonus = towerBonus(state, index);
    if (!bonus) continue;
    state.gold += (bonus.foodPerSecond * elapsedMs) / 1000;
    state.bankedGold += (bonus.goldPerSecond * elapsedMs) / 1000;
    if (defense.mana < defense.maxMana)
      defense.mana = Math.min(defense.maxMana, defense.mana + (bonus.manaPerSecond * elapsedMs) / 1000);
  }
}
