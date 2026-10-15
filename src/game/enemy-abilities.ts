import { isDefenseMonster, enemyTraits } from '../content/enemies';
import { entityPosition } from './geometry';
import { randomValue } from './defense-state';
import { applyDamage } from './damage';
import { summonEnemy } from './enemy-factory';
import { defeatEnemy } from './rewards';
import { defenseRules } from '../content/defense-rules';
import type { Enemy, GameEvent, GameState } from './types';

/** Returns false while an ability holds the enemy in place. */
export function tickEnemyAbilities(state: GameState, enemy: Enemy, dt: number, events: GameEvent[]): boolean {
  enemy.untargetable = Math.max(0, (enemy.untargetable ?? 0) - dt);
  enemy.invulnerable = Math.max(0, (enemy.invulnerable ?? 0) - dt);
  enemy.lastHitAgo = (enemy.lastHitAgo ?? 0) + dt;
  if ((enemy.deathDelay ?? 0) > 0) {
    enemy.deathDelay = Math.max(0, enemy.deathDelay! - dt);
    if (enemy.deathDelay < defenseRules.balanceEpsilon) {
      enemy.hp = 0;
      defeatEnemy(state, enemy, events);
    }
    return false;
  }
  if (enemy.poison > 0) {
    const active = Math.min(dt, enemy.poison);
    enemy.poison -= active;
    enemy.poisonD -= active;
    while (enemy.poisonD <= defenseRules.balanceEpsilon && enemy.hp > 0) {
      applyDamage(state, enemy, enemy.poisonDamage ?? 0, enemy.poisonSource ?? 'poison', events);
      enemy.poisonD += defenseRules.poisonTickMs;
    }
  }
  if (enemy.hp <= 0) return false;
  const traits = enemyTraits(enemy.kind);
  if (traits.regen && enemy.lastHitAgo >= traits.regen.delayMs)
    enemy.hp = Math.min(enemy.max, enemy.hp + (enemy.max * traits.regen.fractionPerSecond * dt) / 1000);
  if (traits.healAura) {
    const [x, y] = entityPosition(state, enemy);
    for (const other of state.enemies) {
      if (other === enemy || other.hp <= 0 || (other.deathDelay ?? 0) > 0) continue;
      const [ox, oy] = entityPosition(state, other);
      if (Math.hypot(x - ox, y - oy) <= traits.healAura.radius)
        other.hp = Math.min(other.max, other.hp + (other.max * traits.healAura.fractionPerSecond * dt) / 1000);
    }
  }
  if (traits.summoner) return tickSummoner(state, enemy, dt, traits.summoner);
  return true;
}

function tickSummoner(
  state: GameState,
  enemy: Enemy,
  dt: number,
  summoner: { travelMs: number; pauseMs: number },
): boolean {
  if ((enemy.summonPause ?? 0) > 0) {
    enemy.summonPause = Math.max(0, enemy.summonPause! - dt);
    if (enemy.summonPause < defenseRules.balanceEpsilon) {
      const candidates = state.knownMonsters.filter(isDefenseMonster);
      if (candidates.length)
        summonEnemy(state, candidates[Math.floor(randomValue(state) * candidates.length)], enemy);
      enemy.summonClock = summoner.travelMs;
    }
    return false;
  }
  enemy.summonClock = (enemy.summonClock ?? summoner.travelMs) - dt;
  if (enemy.summonClock <= defenseRules.balanceEpsilon) {
    enemy.summonPause = summoner.pauseMs;
    return false;
  }
  return true;
}
