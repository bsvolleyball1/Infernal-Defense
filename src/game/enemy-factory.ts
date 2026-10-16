import { enemyRoster, enemyTraits, isDefenseMonster, movementSpeed } from '../content/enemies';
import { defenseRules } from '../content/defense-rules';
import type { Enemy, GameState, MonsterKind } from './types';

export interface DefenseEnemy extends Enemy {
  frozen: number;
  poisonDamage: number;
  untargetable: number;
  ghostTriggered: boolean;
  invulnerable: number;
  deathDelay: number;
  lastHitAgo: number;
  summonClock: number;
  summonPause: number;
  empowered: boolean;
}

/** Fills timers older saves omit, using the same defaults as a newly created defense enemy. */
export function withDefenseTimers(enemy: Enemy): DefenseEnemy {
  enemy.frozen ??= 0;
  enemy.poisonDamage ??= 0;
  enemy.untargetable ??= 0;
  enemy.ghostTriggered ??= false;
  enemy.invulnerable ??= 0;
  enemy.deathDelay ??= 0;
  enemy.lastHitAgo ??= 0;
  enemy.summonClock ??= enemyTraits(enemy.kind).summoner?.travelMs ?? defenseRules.defaultSummonClockMs;
  enemy.summonPause ??= 0;
  enemy.empowered ??= false;
  return enemy as DefenseEnemy;
}

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
          invulnerable: enemyTraits(kind).spawnInvulnerableMs ?? 0,
          deathDelay: 0,
          lastHitAgo: 0,
          summonClock: enemyTraits(kind).summoner?.travelMs ?? defenseRules.defaultSummonClockMs,
          summonPause: 0,
          empowered: false,
        }
      : {}),
  };
}
export function summonEnemy(state: GameState, kind: MonsterKind, parent: Enemy): void {
  if (!isDefenseMonster(kind) || state.enemies.length + state.spawnSchedule.length >= defenseRules.summonCap) return;
  const stats = enemyRoster[kind];
  state.enemies.push(createEnemy(state, kind, stats.hp, movementSpeed(stats.rating), parent.progress, parent.routeId));
  state.enemiesSummoned++;
}
