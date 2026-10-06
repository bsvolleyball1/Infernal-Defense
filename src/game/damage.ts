import { defeatEnemy } from './rewards';
import { rank, rankTotal } from './defense-state';
import type { DragonType, Enemy, GameEvent, GameState } from './types';

export type DamageSource = DragonType | 'spell';
export function damageMultiplier(state: GameState, source: DamageSource): number {
  if (source === 'spell') return 1;
  return 1 + rank(state, source, 5) * 0.05 + (source === 'fire' ? rankTotal(state, 'fire') * 0.01 : 0);
}
export function applyDamage(
  state: GameState,
  enemy: Enemy,
  amount: number,
  source: DamageSource,
  events: GameEvent[],
): void {
  if (
    enemy.hp <= 0 ||
    enemy.escaped ||
    enemy.rewarded ||
    (enemy.invulnerable ?? 0) > 0 ||
    (enemy.deathDelay ?? 0) > 0
  )
    return;
  if (source === 'spell' && enemy.kind === 'witch') return;
  let resistance = 1;
  if (source !== 'spell') {
    if (enemy.kind === 'skeleton') resistance = 0.5;
    if (
      (enemy.kind === 'hellhound' && source === 'fire') ||
      (enemy.kind === 'fury' && source === 'poison') ||
      (enemy.kind === 'devil' && source === 'ice')
    )
      resistance = 0.25;
  }
  const damage = amount * resistance * (enemy.carryingEgg !== null ? 1 + rank(state, 'ice', 4) * 0.1 : 1);
  if (damage <= 0) return;
  enemy.lastHitAgo = 0;
  if (enemy.kind === 'gargoyle' && enemy.hp <= damage) {
    enemy.hp = 0.01;
    enemy.deathDelay = 2000;
    return;
  }
  enemy.hp = Math.max(0, enemy.hp - damage);
  if (enemy.hp === 0) defeatEnemy(state, enemy, events);
  else if (enemy.kind === 'ghost' && source !== 'spell' && !enemy.ghostTriggered) {
    enemy.ghostTriggered = true;
    enemy.untargetable = 3000;
  }
}
