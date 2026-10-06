import { map, positionAt } from '../content/catalog';
import { moveEnemy } from './eggs';
import { defeatEnemy, finishBattle } from './rewards';
import { battleRules, towerAttackInterval, towerDamage, towerRange } from './rules';
import type { DragonType, Enemy, GameEvent, GameState, Projectile, Tower } from './types';

const projectileEffects: Record<DragonType, (target: Enemy) => void> = {
  fire: () => {},
  ice: target => { target.slow = Math.max(target.slow, battleRules.freezeDurationMs); },
  poison: target => {
    target.poison = battleRules.poisonDurationMs;
    target.poisonD = battleRules.initialPoisonTickMs;
  },
};

export function updateEnemies(state: GameState, elapsedMs: number, events: GameEvent[]): void {
  for (const enemy of state.enemies) {
    if (enemy.hp > 0) {
      if (moveEnemy(state, enemy, elapsedMs)) {
        events.push({ type: 'message', text: 'A raider escaped with an egg!' });
        if (state.eggs.every(egg => egg.status === 'escaped')) finishBattle(state, false, events);
      }
      if (state.phase !== 'battle') return;
      applyPoisonTick(enemy, elapsedMs);
    }
    if (enemy.hp <= 0 && !enemy.escaped) defeatEnemy(state, enemy, events);
  }
  state.enemies = state.enemies.filter(enemy => enemy.hp > 0);
}

function applyPoisonTick(enemy: Enemy, elapsedMs: number): void {
  if (enemy.hp <= 0 || enemy.poison <= 0) return;
  enemy.poison = Math.max(0, enemy.poison - elapsedMs);
  enemy.poisonD -= elapsedMs;
  if (enemy.poisonD <= 0) {
    enemy.hp -= battleRules.poisonTickDamage;
    enemy.poisonD = battleRules.poisonTickIntervalMs;
  }
}

function selectTarget(enemies: Enemy[], tower: Tower, perch: { x: number; y: number }): Enemy | undefined {
  const range = towerRange(tower);
  let target: Enemy | undefined;
  for (const enemy of enemies) {
    const [x, y] = positionAt(enemy.progress);
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
    const perch = map.perches[index];
    const target = selectTarget(state.enemies, tower, perch);
    if (!target) return;
    state.projectiles.push({
      id: state.nextEntityId++, x: perch.x, y: perch.y - battleRules.projectileOriginOffset,
      targetId: target.id, dragon: tower.type, damage: towerDamage(tower),
      speed: tower.type === 'fire' ? battleRules.fireProjectileSpeed : battleRules.otherProjectileSpeed,
      level: tower.level,
    });
    tower.cooldown = towerAttackInterval(tower);
    events.push({ type: 'sound', dragon: tower.type });
  });
}

export function updateProjectiles(state: GameState, elapsedMs: number, events: GameEvent[]): void {
  const remaining: Projectile[] = [];
  for (const shot of state.projectiles) {
    const target = state.enemies.find(enemy => enemy.id === shot.targetId);
    if (!target || target.hp <= 0) continue;
    const [x, y] = positionAt(target.progress);
    const dx = x - shot.x;
    const dy = y - shot.y;
    const distance = Math.hypot(dx, dy);
    const travel = shot.speed * elapsedMs * battleRules.projectileTravelPerMillisecond;
    if (distance < travel + battleRules.projectileHitTolerance) {
      target.hp -= shot.damage;
      projectileEffects[shot.dragon](target);
      if (target.hp <= 0) defeatEnemy(state, target, events);
    } else {
      shot.x += dx / distance * travel;
      shot.y += dy / distance * travel;
      remaining.push(shot);
    }
  }
  state.projectiles = remaining.filter(shot => state.enemies.some(enemy => enemy.id === shot.targetId && enemy.hp > 0));
  state.enemies = state.enemies.filter(enemy => enemy.hp > 0);
}
