import { isDefenseMonster } from '../content/enemies';
import { entityPosition } from './geometry';
import { randomValue } from './defense-state';
import { applyDamage } from './damage';
import { summonEnemy } from './enemy-factory';
import { defeatEnemy } from './rewards';
import type { Enemy, GameEvent, GameState } from './types';

/** Returns false while an ability holds the enemy in place. */
export function tickEnemyAbilities(state: GameState, enemy: Enemy, dt: number, events: GameEvent[]): boolean {
  enemy.untargetable = Math.max(0, (enemy.untargetable ?? 0) - dt);
  enemy.invulnerable = Math.max(0, (enemy.invulnerable ?? 0) - dt);
  enemy.lastHitAgo = (enemy.lastHitAgo ?? 0) + dt;
  if ((enemy.deathDelay ?? 0) > 0) {
    enemy.deathDelay = Math.max(0, enemy.deathDelay! - dt);
    if (enemy.deathDelay < 1e-7) {
      enemy.hp = 0;
      defeatEnemy(state, enemy, events);
    }
    return false;
  }
  if (enemy.poison > 0) {
    const active = Math.min(dt, enemy.poison);
    enemy.poison -= active;
    enemy.poisonD -= active;
    while (enemy.poisonD <= 1e-7 && enemy.hp > 0) {
      applyDamage(state, enemy, enemy.poisonDamage ?? 0, enemy.poisonSource ?? 'poison', events);
      enemy.poisonD += 1000;
    }
  }
  if (enemy.hp <= 0) return false;
  if (enemy.kind === 'troll' && enemy.lastHitAgo >= 1000)
    enemy.hp = Math.min(enemy.max, enemy.hp + (enemy.max * 0.04 * dt) / 1000);
  if (enemy.kind === 'hag') {
    const [x, y] = entityPosition(state, enemy);
    for (const other of state.enemies) {
      if (other === enemy || other.hp <= 0 || (other.deathDelay ?? 0) > 0) continue;
      const [ox, oy] = entityPosition(state, other);
      if (Math.hypot(x - ox, y - oy) <= 50)
        other.hp = Math.min(other.max, other.hp + (other.max * 0.03 * dt) / 1000);
    }
  }
  if (enemy.kind === 'necromancer') {
    if ((enemy.summonPause ?? 0) > 0) {
      enemy.summonPause = Math.max(0, enemy.summonPause! - dt);
      if (enemy.summonPause < 1e-7) {
        const candidates = state.knownMonsters.filter(isDefenseMonster);
        if (candidates.length)
          summonEnemy(state, candidates[Math.floor(randomValue(state) * candidates.length)], enemy);
        enemy.summonClock = 5000;
      }
      return false;
    }
    enemy.summonClock = (enemy.summonClock ?? 5000) - dt;
    if (enemy.summonClock <= 1e-7) {
      enemy.summonPause = 1000;
      return false;
    }
  }
  return true;
}
