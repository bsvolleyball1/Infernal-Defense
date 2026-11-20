import { dragonForms } from '../content/dragon-forms';
import type { DragonFormDefinition } from '../content/dragon-forms';
import { defenseRules } from '../content/defense-rules';
import { getMap } from '../content/catalog';
import { applyDamage, damageMultiplier } from './damage';
import { rankOf, rankTotal } from './defense-state';
import { byDistanceFrom, entityPosition } from './geometry';
import type { TowerContext } from './tower-bonuses';
import type { DefenseBattle, Enemy, EvolutionTower, GameEvent, Point } from './types';

export const mapBeamWidth = 24;

export function mapBeamEndpoint(state: DefenseBattle, origin: Point, target: Enemy): Point {
  const [tx, ty] = entityPosition(state, target);
  const dx = tx - origin.x;
  const dy = ty - origin.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return { ...origin };
  const direction = { x: dx / distance, y: dy / distance };
  const geometry = getMap(state.activeLevel, state.defense.ruleset, state.defense.mobileLayout);
  let furthest = Number.POSITIVE_INFINITY;
  if (direction.x !== 0)
    for (const boundary of [0, geometry.width])
      if (Number.isFinite((boundary - origin.x) / direction.x)) {
        const candidate = (boundary - origin.x) / direction.x;
        if (candidate > 0 && candidate < furthest) furthest = candidate;
      }
  if (direction.y !== 0)
    for (const boundary of [0, geometry.height])
      if (Number.isFinite((boundary - origin.y) / direction.y)) {
        const candidate = (boundary - origin.y) / direction.y;
        if (candidate > 0 && candidate < furthest) furthest = candidate;
      }
  return {
    x: origin.x + direction.x * furthest,
    y: origin.y + direction.y * furthest,
  };
}

/** New area effects obey the same targeting protections as direct attacks. */
export function formTargetable(enemy: Enemy): boolean {
  return (
    enemy.hp > 0 &&
    !enemy.rewarded &&
    !enemy.escaped &&
    (enemy.untargetable ?? 0) <= 0 &&
    (enemy.invulnerable ?? 0) <= 0 &&
    (enemy.deathDelay ?? 0) <= 0
  );
}

export function formInterval(state: DefenseBattle, tower: EvolutionTower): number {
  const rate = tower.type === 'poison' ? 1 + rankTotal(state, 'poison') * defenseRules.nonAttackRankBonus : 1;
  return dragonForms[tower.evolution.form].interval / rate;
}

export function tickEvolvedTower(
  state: DefenseBattle,
  tower: EvolutionTower,
  index: number,
  candidates: Enemy[],
  dt: number,
  events: GameEvent[],
  context: TowerContext,
): void {
  const profile = dragonForms[tower.evolution.form];
  const targets = candidates.filter(formTargetable);
  const damage = profile.damage * damageMultiplier(state, tower.type) * context.damageMultiplier;
  if (['beam', 'focus', 'mapBeam'].includes(profile.ability)) {
    if (profile.ability === 'mapBeam') {
      if (!targets.length) {
        tower.beamIds = [];
        return;
      }
      const trigger = targets[0];
      const [tx, ty] = entityPosition(state, trigger);
      const dx = tx - context.position.x;
      const dy = ty - context.position.y;
      const length = Math.hypot(dx, dy);
      const dirX = length > 0 ? dx / length : 0;
      const dirY = length > 0 ? dy / length : 0;
      const endpoint = mapBeamEndpoint(state, context.position, trigger);
      const rayLength = Math.hypot(endpoint.x - context.position.x, endpoint.y - context.position.y);
      const affected = state.enemies.filter((enemy) => {
        if (!formTargetable(enemy)) return false;
        const [x, y] = entityPosition(state, enemy);
        const ex = x - context.position.x;
        const ey = y - context.position.y;
        const along = ex * dirX + ey * dirY;
        const across = Math.abs(ex * dirY - ey * dirX);
        return along >= 0 && along <= rayLength + mapBeamWidth && across <= mapBeamWidth;
      });
      tower.beamIds = [trigger.id, ...affected.filter((enemy) => enemy.id !== trigger.id).map((enemy) => enemy.id)];
      for (const enemy of affected) applyDamage(state, enemy, (damage * dt) / 1000, tower.type, events);
      return;
    }
    const affected = targets.slice(0, profile.ability === 'focus' ? 1 : (profile.count ?? 1));
    tower.beamIds = affected.map((enemy) => enemy.id);
    for (const enemy of affected) applyDamage(state, enemy, (damage * dt) / 1000, tower.type, events);
    return;
  }
  if (profile.ability === 'charged') {
    tickCharges(state, tower, index, targets, dt, damage, context);
    return;
  }
  if (profile.ability === 'radius') {
    if (tower.cooldown > defenseRules.balanceEpsilon) return;
    const [radiusX, radiusY] = [context.position.x, context.position.y];
    const radius = context.range;
    const affected = state.enemies.filter((enemy) => {
      if (!formTargetable(enemy)) return false;
      const [x, y] = entityPosition(state, enemy);
      return Math.hypot(x - radiusX, y - radiusY) <= radius;
    });
    if (!affected.length) return;
    attackArea(state, tower, targets, damage, events, context, profile);
    tower.cooldown = formInterval(state, tower);
    events.push({ type: 'sound', dragon: tower.type });
    return;
  }
  if (!targets.length || tower.cooldown > defenseRules.balanceEpsilon) return;
  if (['rapid', 'acid', 'sniper'].includes(profile.ability)) {
    fireFormProjectile(state, tower, index, targets[0], damage, context, profile);
  } else {
    attackArea(state, tower, targets, damage, events, context, profile);
  }
  tower.cooldown = formInterval(state, tower);
  events.push({ type: 'sound', dragon: tower.type });
}

function tickCharges(
  state: DefenseBattle,
  tower: EvolutionTower,
  index: number,
  targets: Enemy[],
  dt: number,
  damage: number,
  context: TowerContext,
): void {
  const profile = dragonForms[tower.evolution.form];
  const capacity = (profile.count ?? 1) + rankOf(state, 'ice', 'moreCharges');
  tower.charges ??= capacity;
  tower.chargeTimer ??= defenseRules.iceChargeIntervalMs;
  if (tower.charges < capacity) {
    tower.chargeTimer -= dt;
    while (tower.chargeTimer <= defenseRules.balanceEpsilon && tower.charges < capacity) {
      tower.charges++;
      tower.chargeTimer += defenseRules.iceChargeIntervalMs;
    }
  }
  if (tower.charges >= capacity) tower.chargeTimer = defenseRules.iceChargeIntervalMs;
  // An epsilon-inclusive recharge can otherwise leave 1000 + rounding residue in a valid save.
  tower.chargeTimer = Math.min(defenseRules.iceChargeIntervalMs, Math.max(0, tower.chargeTimer));
  const target = [...targets].sort(byDistanceFrom(state, context.position))[0];
  if (!target) return;
  for (let charge = 0; charge < tower.charges; charge++)
    fireFormProjectile(state, tower, index, target, damage, context, profile);
  tower.charges = 0;
}

function fireFormProjectile(
  state: DefenseBattle,
  tower: EvolutionTower,
  index: number,
  target: Enemy,
  damage: number,
  context: TowerContext,
  profile: DragonFormDefinition,
): void {
  state.projectiles.push({
    id: state.nextEntityId++,
    x: context.position.x,
    y: context.position.y - defenseRules.projectileOriginOffset,
    targetId: target.id,
    dragon: tower.type,
    damage,
    speed: defenseRules.projectileSpeed,
    level: tower.level,
    towerIndex: index,
    color: profile.color,
    ...(tower.type === 'ice' ? { retarget: { origin: { ...context.position }, range: context.range } } : {}),
    effect:
      profile.ability === 'acid'
        ? {
            kind: 'poison',
            duration: profile.duration ?? 5000,
            slow: defenseRules.poisonSlowMs,
            tickDamage:
              target.max *
              defenseRules.poisonShotHealthFraction *
              damageMultiplier(state, tower.type) *
              context.damageMultiplier,
          }
        : { kind: 'none' },
  });
}

function attackArea(
  state: DefenseBattle,
  tower: EvolutionTower,
  targets: Enemy[],
  damage: number,
  events: GameEvent[],
  context: TowerContext,
  profile: DragonFormDefinition,
): void {
  const target = targets[0];
  const targetPosition = target ? entityPosition(state, target) : null;
  const centerX = profile.ability === 'radius' ? context.position.x : (targetPosition?.[0] ?? context.position.x);
  const centerY = profile.ability === 'radius' ? context.position.y : (targetPosition?.[1] ?? context.position.y);
  const centered = ['explosion', 'radius', 'tar', 'earthquake'].includes(profile.ability);
  const affected =
    profile.ability === 'cone'
      ? targets.filter((enemy) => inCone(state, enemy, target, context, profile.radius ?? 45))
      : centered
        ? state.enemies.filter((enemy) => {
            const [x, y] = entityPosition(state, enemy);
            const radius = profile.ability === 'radius' ? context.range : (profile.radius ?? 48);
            return formTargetable(enemy) && Math.hypot(x - centerX, y - centerY) <= radius;
          })
        : [target];
  for (const enemy of affected) {
    if (profile.ability === 'nullify') enemy.nullified = Math.max(enemy.nullified ?? 0, profile.duration ?? 4000);
    applyDamage(state, enemy, damage, tower.type, events);
    if (!formTargetable(enemy)) continue;
    if (profile.ability === 'tar') enemy.slow = Math.max(enemy.slow, profile.duration ?? 2000);
    if (profile.ability === 'earthquake') enemy.frozen = Math.max(enemy.frozen ?? 0, profile.duration ?? 1500);
  }
  state.defense.visuals.push({
    id: state.nextEntityId++,
    kind: tower.type,
    x: centered ? centerX : context.position.x,
    y: centered ? centerY : context.position.y,
    radius: profile.ability === 'radius' ? context.range : (profile.radius ?? 38),
    remaining: defenseRules.fireWaveVisualMs,
    color: profile.color,
    ...(profile.ability === 'cone'
      ? {
          shape: 'cone' as const,
          targetId: target.id,
          length: context.range,
          directionX:
            (centerX - context.position.x) /
            (Math.hypot(centerX - context.position.x, centerY - context.position.y) || 1),
          directionY:
            (centerY - context.position.y) /
            (Math.hypot(centerX - context.position.x, centerY - context.position.y) || 1),
        }
      : {}),
  });
}

function inCone(state: DefenseBattle, candidate: Enemy, target: Enemy, context: TowerContext, width: number): boolean {
  const [tx, ty] = entityPosition(state, target),
    [cx, cy] = entityPosition(state, candidate);
  const dx = tx - context.position.x,
    dy = ty - context.position.y;
  const distance = Math.hypot(dx, dy) || 1;
  const x = cx - context.position.x,
    y = cy - context.position.y;
  const along = (x * dx + y * dy) / distance;
  const across = Math.abs(x * dy - y * dx) / distance;
  return along >= 0 && along <= context.range && across <= Math.min(width, along * 0.55);
}
