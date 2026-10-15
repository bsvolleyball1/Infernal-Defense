import { towerBonus } from '../tower-bonuses';
import type { LegacyBattle } from '../types';

/** The original rules have one currency, so food and gold areas both pay battle gold. */
export function produceLegacyBonusGold(state: LegacyBattle, elapsedMs: number): void {
  for (let index = 0; index < state.towers.length; index++) {
    const bonus = towerBonus(state, index);
    if (bonus) state.gold += ((bonus.foodPerSecond + bonus.goldPerSecond) * elapsedMs) / 1000;
  }
}
