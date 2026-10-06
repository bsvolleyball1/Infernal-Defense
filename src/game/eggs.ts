import { map } from '../content/catalog';
import { battleRules } from './rules';
import type { Enemy, Egg, GameState } from './types';

function carryEgg(enemy: Enemy, egg: Egg): void {
  egg.status = 'carried';
  egg.carrier = enemy.id;
  egg.progress = null;
  enemy.carryingEgg = egg.id;
  enemy.returning = true;
}

export function dropEgg(state: GameState, enemy: Enemy): void {
  if (enemy.carryingEgg === null) return;
  const egg = state.eggs.find(item => item.id === enemy.carryingEgg);
  if (egg) {
    egg.status = 'dropped';
    egg.progress = enemy.progress;
    egg.carrier = null;
  }
  enemy.carryingEgg = null;
}

/** Returns true only when a carrier escapes with an egg. */
export function moveEnemy(state: GameState, enemy: Enemy, elapsedMs: number): boolean {
  if (enemy.slow > 0) {
    enemy.slow = Math.max(0, enemy.slow - elapsedMs);
    return false;
  }
  const travel = enemy.spd * elapsedMs * battleRules.movementPerMillisecond;
  if (enemy.returning) return moveReturningEnemy(state, enemy, travel);
  const previous = enemy.progress;
  const next = Math.min(map.path.length - 1, previous + travel);
  const dropped = state.eggs.find(egg => egg.status === 'dropped'
    && egg.progress !== null && egg.progress >= previous && egg.progress <= next);
  if (dropped && dropped.progress !== null) {
    enemy.progress = dropped.progress;
    carryEgg(enemy, dropped);
    return false;
  }
  enemy.progress = next;
  if (enemy.progress >= map.path.length - 1) {
    const egg = state.eggs.find(item => item.status === 'nest');
    if (egg) carryEgg(enemy, egg);
    else enemy.returning = true;
  }
  return false;
}

function moveReturningEnemy(state: GameState, enemy: Enemy, travel: number): boolean {
  enemy.progress = Math.max(0, enemy.progress - travel);
  if (enemy.progress !== 0) return false;
  enemy.escaped = true;
  enemy.hp = 0;
  if (enemy.carryingEgg === null) return false;
  const egg = state.eggs.find(item => item.id === enemy.carryingEgg);
  if (egg) {
    egg.status = 'escaped';
    egg.carrier = null;
  }
  enemy.carryingEgg = null;
  return true;
}
