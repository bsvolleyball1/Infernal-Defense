import { entityPosition } from '../geometry';
import { moveEnemy } from '../eggs';
import { defeatEnemy, finishBattle } from '../rewards';
import { battleRules, towerAttackInterval, towerDamage, towerRange } from '../rules';
import type { DragonType, Enemy, GameEvent, GameState, Projectile } from '../types';
import { towerContext } from '../tower-bonuses';
import { advanceProjectile } from '../projectile-motion';

const projectileEffects: Record<DragonType, (target: Enemy, damageMultiplier: number) => void> = {
  fire: () => {},
  ice: (target) => {
    target.slow = Math.max(target.slow, battleRules.freezeDurationMs);
  },
  poison: (target, damageMultiplier) => {
    target.poison = battleRules.poisonDurationMs;
    target.poisonD = battleRules.initialPoisonTickMs;
    if (damageMultiplier > 1) target.poisonDamageMultiplier = damageMultiplier;
    else delete target.poisonDamageMultiplier;
  },
};

/** Original-rules enemy movement and poison. Defense battles use defense-simulation instead. */
export function updateEnemies(state: GameState, elapsedMs: number, events: GameEvent[]): void {
  for (const enemy of state.enemies) {
    if (enemy.hp > 0) {
      if (moveEnemy(state, enemy, elapsedMs)) {
        events.push({ type: 'message', text: 'A raider escaped with an egg!' });
        if (state.eggs.every((egg) => egg.status === 'escaped')) finishBattle(state, false, events);
      }
      if (state.phase !== 'battle') return;
      applyPoisonTick(enemy, elapsedMs);
    }
    if (enemy.hp <= 0 && !enemy.escaped) defeatEnemy(state, enemy, events);
  }
  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
}

function applyPoisonTick(enemy: Enemy, elapsedMs: number): void {
  if (enemy.hp <= 0 || enemy.poison <= 0) return;
  enemy.poison = Math.max(0, enemy.poison - elapsedMs);
  enemy.poisonD -= elapsedMs;
  if (enemy.poisonD <= 0) {
    enemy.hp -= battleRules.poisonTickDamage * (enemy.poisonDamageMultiplier ?? 1);
    enemy.poisonD = battleRules.poisonTickIntervalMs;
  }
}

function selectTarget(state: GameState, perch: { x: number; y: number }, range: number): Enemy | undefined {
  let target: Enemy | undefined;
  for (const enemy of state.enemies) {
    const [x, y] = entityPosition(state, enemy);
    const withinRange = (x - perch.x) ** 2 + (y - perch.y) ** 2 < range ** 2;
    if (withinRange && (!target || enemy.progress > target.progress)) target = enemy;
  }
  return target;
}

export function updateTowers(state: GameState, elapsedMs: number, events: GameEvent[]): void {
  state.towers.forEach((tower, index) => {
    if (!tower) return;
    tower.cooldown = Math.max(0, tower.cooldown - elapsedMs);
    if (tower.cooldown > 0) return;
    const context = towerContext(state, index, towerRange(tower));
    const target = selectTarget(state, context.position, context.range);
    if (!target) return;
    state.projectiles.push({
      id: state.nextEntityId++,
      x: context.position.x,
      y: context.position.y - battleRules.projectileOriginOffset,
      targetId: target.id,
      dragon: tower.type,
      damage: towerDamage(tower) * context.damageMultiplier,
      speed: tower.type === 'fire' ? battleRules.fireProjectileSpeed : battleRules.otherProjectileSpeed,
      level: tower.level,
      ...(context.damageMultiplier > 1 ? { damageMultiplier: context.damageMultiplier } : {}),
    });
    tower.cooldown = towerAttackInterval(tower);
    events.push({ type: 'sound', dragon: tower.type });
  });
}

export function updateProjectiles(state: GameState, elapsedMs: number, events: GameEvent[]): void {
  const remaining: Projectile[] = [];
  for (const shot of state.projectiles) {
    const target = state.enemies.find((enemy) => enemy.id === shot.targetId);
    if (!target || target.hp <= 0) continue;
    if (!advanceProjectile(state, shot, target, elapsedMs, battleRules.projectileHitTolerance)) {
      remaining.push(shot);
      continue;
    }
    target.hp -= shot.damage;
    projectileEffects[shot.dragon](target, shot.damageMultiplier ?? 1);
    if (target.hp <= 0) defeatEnemy(state, target, events);
  }
  state.projectiles = remaining.filter((shot) =>
    state.enemies.some((enemy) => enemy.id === shot.targetId && enemy.hp > 0),
  );
  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
}
