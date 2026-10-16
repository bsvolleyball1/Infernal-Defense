import { withDefenseTimers } from './enemy-factory';
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
  const subject = withDefenseTimers(enemy);
  if (subject.hp <= 0 || subject.escaped || subject.rewarded || subject.invulnerable > 0 || subject.deathDelay > 0)
    return;
  const traits = enemyTraits(subject.kind);
  if (source === 'spell' && traits.spellImmune) return;
  let resistance = 1;
  if (source !== 'spell' && traits.resist) resistance = traits.resist[source] ?? traits.resist.all ?? 1;
  const damage =
    amount *
    resistance *
    (subject.carryingEgg !== null ? 1 + rankOf(state, 'ice', 'carrierDamage') * defenseRules.carrierDamagePerRank : 1);
  if (damage <= 0) return;
  subject.lastHitAgo = 0;
  if (traits.lethalDelay && subject.hp <= damage) {
    subject.hp = traits.lethalDelay.residualHp;
    subject.deathDelay = traits.lethalDelay.delayMs;
    return;
  }
  subject.hp = Math.max(0, subject.hp - damage);
  if (subject.hp === 0) defeatEnemy(state, subject, events);
  else if (traits.untargetableAfterHitMs && source !== 'spell' && !subject.ghostTriggered) {
    subject.ghostTriggered = true;
    subject.untargetable = traits.untargetableAfterHitMs;
  }
}
