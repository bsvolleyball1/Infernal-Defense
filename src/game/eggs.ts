import { routeFor, sharesTrail } from './geometry';
import { battleRules } from './rules';
import type { Enemy, Egg, GameState } from './types';
import { movementSpeed } from '../content/enemies';
import { rank } from './defense-state';
import { defenseRules, eggReturnDelay } from '../content/defense-rules';

function carryEgg(state: GameState, enemy: Enemy, egg: Egg): void {
  if (state.defense?.mode === 'sandbox') { enemy.returning = true; return; }
  egg.status = 'carried';
  egg.carrier = enemy.id;
  egg.progress = null;
  enemy.carryingEgg = egg.id;
  enemy.returning = true;
  if (enemy.routeId !== undefined) egg.routeId = enemy.routeId;
  if (state.defense) {
    delete egg.returnTimer;
    egg.direct = enemy.kind === 'shade';
    if (enemy.kind === 'lich' && !enemy.empowered) { enemy.max += 100; enemy.hp += 100; enemy.spd = movementSpeed(7); enemy.empowered = true; }
  }
}

export function dropEgg(state: GameState, enemy: Enemy): void {
  if (enemy.carryingEgg === null) return;
  const egg = state.eggs.find(item => item.id === enemy.carryingEgg);
  if (egg) {
    egg.status = 'dropped';
    egg.progress = enemy.progress;
    egg.carrier = null;
    if (enemy.routeId !== undefined) egg.routeId = enemy.routeId;
    if (state.defense) { egg.direct = enemy.kind === 'shade'; egg.returnTimer = eggReturnDelay(rank(state,'fire',4)); }
  }
  enemy.carryingEgg = null;
}

/** Returns true only when a carrier escapes with an egg. */
export function moveEnemy(state: GameState, enemy: Enemy, elapsedMs: number): boolean {
  if (state.defense) {
    if ((enemy.frozen ?? 0)>0) { enemy.frozen = Math.max(0,enemy.frozen!-elapsedMs); return false; }
    const slowed = enemy.slow>0;
    enemy.slow = Math.max(0,enemy.slow-elapsedMs);
    if (slowed) elapsedMs *= .5;
  }
  if (!state.defense && enemy.slow > 0) {
    enemy.slow = Math.max(0, enemy.slow - elapsedMs);
    return false;
  }
  let travel = enemy.spd * elapsedMs * battleRules.movementPerMillisecond;
  if (state.defense && enemy.kind === 'shade') {
    const route = routeFor(state,enemy.routeId), first=route[0], last=route[route.length-1];
    const distance = Math.hypot(last[0]-first[0],last[1]-first[1]);
    // Main expresses direct speed as a fraction of the entry-to-nest line.
    travel *= (route.length-1)**2 / Math.max(1,distance/defenseRules.directDistanceUnit);
  }
  if (enemy.returning) return moveReturningEnemy(state, enemy, travel);
  const previous = enemy.progress;
  const routeEnd = routeFor(state, enemy.routeId).length - 1;
  const next = Math.min(routeEnd, previous + travel);
  const dropped = state.eggs.find(egg => egg.status === 'dropped'
    && egg.progress !== null && egg.progress >= previous && egg.progress <= next
    && (!state.defense || !!egg.direct === (enemy.kind === 'shade'))
    && sharesTrail(state, enemy.routeId, egg.routeId, egg.progress));
  if (dropped && dropped.progress !== null) {
    enemy.progress = dropped.progress;
    carryEgg(state, enemy, dropped);
    return false;
  }
  enemy.progress = next;
  if (enemy.progress >= routeEnd) {
    const egg = state.eggs.find(item => item.status === 'nest');
    if (egg) carryEgg(state, enemy, egg);
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
