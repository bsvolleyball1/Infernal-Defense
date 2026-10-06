import { enemyRoster, isDefenseMonster, movementSpeed } from '../content/enemies';
import type { Enemy, GameState, MonsterKind } from './types';

export function createEnemy(
  state: GameState,
  kind: MonsterKind,
  hp: number,
  spd: number,
  progress = 0,
  routeId?: number,
): Enemy {
  return {
    id: state.nextEntityId++,
    kind,
    hp,
    max: hp,
    spd,
    progress,
    slow: 0,
    poison: 0,
    poisonD: 0,
    carryingEgg: null,
    returning: false,
    escaped: false,
    rewarded: false,
    ...(routeId !== undefined ? { routeId } : {}),
    ...(state.defense
      ? {
          frozen: 0,
          poisonDamage: 0,
          untargetable: 0,
          ghostTriggered: false,
          invulnerable: kind === 'phantom' ? 3000 : 0,
          deathDelay: 0,
          lastHitAgo: 0,
          summonClock: 5000,
          summonPause: 0,
          empowered: false,
        }
      : {}),
  };
}
export function summonEnemy(state: GameState, kind: MonsterKind, parent: Enemy): void {
  if (!isDefenseMonster(kind) || state.enemies.length + state.spawnSchedule.length >= 500) return;
  const stats = enemyRoster[kind];
  state.enemies.push(
    createEnemy(state, kind, stats.hp, movementSpeed(stats.rating), parent.progress, parent.routeId),
  );
  state.enemiesSummoned++;
}
