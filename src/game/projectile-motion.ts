import { entityPosition } from './geometry';
import { battleRules } from './rules';
import type { Enemy, GameState, Projectile } from './types';

/** Moves a shot toward its target. Returns true, without moving it, when the shot lands this step. */
export function advanceProjectile(
  state: GameState,
  shot: Projectile,
  target: Enemy,
  elapsedMs: number,
  hitTolerance: number,
): boolean {
  const [x, y] = entityPosition(state, target);
  const dx = x - shot.x;
  const dy = y - shot.y;
  const distance = Math.hypot(dx, dy);
  const travel = shot.speed * elapsedMs * battleRules.projectileTravelPerMillisecond;
  if (distance < travel + hitTolerance) return true;
  shot.x += (dx / distance) * travel;
  shot.y += (dy / distance) * travel;
  return false;
}
