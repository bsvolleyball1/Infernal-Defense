import { withDefenseTimers } from '../../game/enemy-factory';
import type { GameState, Projectile, ProjectileEffect } from '../../game/types';

/** Fills defense timers older saves omit, and folds legacy projectile fields into `effect`. */
export function normalizeDefenseEntities(state: GameState): boolean {
  if (!state.defense) return false;
  let changed = false;
  for (const enemy of state.enemies) {
    const missing = enemy.frozen === undefined || enemy.summonClock === undefined || enemy.empowered === undefined;
    withDefenseTimers(enemy);
    if (missing) changed = true;
  }
  for (const shot of state.projectiles) if (adoptProjectileEffect(shot)) changed = true;
  return changed;
}

function adoptProjectileEffect(shot: Projectile): boolean {
  if (shot.effect) return false;
  if (shot.freezeChance === undefined && shot.poisonDuration === undefined && shot.slowDuration === undefined)
    return false;
  const effect: ProjectileEffect = shot.freezeChance
    ? { kind: 'freeze', chance: shot.freezeChance }
    : shot.poisonDuration || shot.slowDuration
      ? { kind: 'poison', duration: shot.poisonDuration ?? 0, slow: shot.slowDuration ?? 0 }
      : { kind: 'none' };
  shot.effect = effect;
  delete shot.freezeChance;
  delete shot.poisonDuration;
  delete shot.slowDuration;
  return true;
}
