import { defeatEnemy } from './rewards';
import { rankOf, rankTotal } from './defense-state';
import { enemyTraits } from '../content/enemies';
import { defenseRules } from '../content/defense-rules';
import type { DragonType, Enemy, GameEvent, GameState } from './types';

export type DamageSource = DragonType | 'spell';
export function damageMultiplier(state: GameState, source: DamageSource): number {
  if (source === 'spell') return 1;
  return (
    1 +
    rankOf(state, source, 'attackPower') * defenseRules.attackPowerPerRank +
    (source === 'fire' ? rankTotal(state, 'fire') * defenseRules.nonAttackRankBonus : 0)
  );
}
export function applyDamage(
  state: GameState,
  enemy: Enemy,
  amount: number,
  source: DamageSource,
  events: GameEvent[],
): void {
  if (enemy.hp <= 0 || enemy.escaped || enemy.rewarded || (enemy.invulnerable ?? 0) > 0 || (enemy.deathDelay ?? 0) > 0)
    return;
  const traits = enemyTraits(enemy.kind);
  if (source === 'spell' && traits.spellImmune) return;
  let resistance = 1;
  if (source !== 'spell' && traits.resist)
    resistance = traits.resist[source] ?? traits.resist.all ?? 1;
  const damage =
    amount *
    resistance *
    (enemy.carryingEgg !== null ? 1 + rankOf(state, 'ice', 'carrierDamage') * defenseRules.carrierDamagePerRank : 1);
  if (damage <= 0) return;
  enemy.lastHitAgo = 0;
  if (traits.lethalDelay && enemy.hp <= damage) {
    enemy.hp = traits.lethalDelay.residualHp;
    enemy.deathDelay = traits.lethalDelay.delayMs;
    return;
  }
  enemy.hp = Math.max(0, enemy.hp - damage);
  if (enemy.hp === 0) defeatEnemy(state, enemy, events);
  else if (traits.untargetableAfterHitMs && source !== 'spell' && !enemy.ghostTriggered) {
    enemy.ghostTriggered = true;
    enemy.untargetable = traits.untargetableAfterHitMs;
  }
}
