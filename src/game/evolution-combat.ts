import { dragonForms } from '../content/dragon-forms';
import type { DragonFormDefinition } from '../content/dragon-forms';
import { defenseRules } from '../content/defense-rules';
import { applyDamage, damageMultiplier } from './damage';
import { rankOf, rankTotal } from './defense-state';
import { entityPosition } from './geometry';
import type { TowerContext } from './tower-bonuses';
import type { DefenseBattle, Enemy, EvolutionTower, GameEvent } from './types';

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
    const affected =
      profile.ability === 'mapBeam'
        ? state.enemies.filter(formTargetable)
        : targets.slice(0, profile.ability === 'focus' ? 1 : (profile.count ?? 1));
    tower.beamIds = affected.map((enemy) => enemy.id);
    for (const enemy of affected) applyDamage(state, enemy, (damage * dt) / 1000, tower.type, events);
    return;
  }
  if (profile.ability === 'charged') {
    tickCharges(state, tower, index, targets, dt, damage, context);
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
  const spent = targets.slice(0, tower.charges);
  for (const enemy of spent) fireFormProjectile(state, tower, index, enemy, damage, context, profile);
  // Only charges that actually fired are spent; recharge progress is not reset on every shot.
  tower.charges -= spent.length;
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
            slow: 0,
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
  const [centerX, centerY] = entityPosition(state, target);
  const centered = ['explosion', 'radius', 'tar', 'earthquake'].includes(profile.ability);
  const affected =
    profile.ability === 'cone'
      ? targets.filter((enemy) => inCone(state, enemy, target, context, profile.radius ?? 45))
      : centered
        ? state.enemies.filter((enemy) => {
            const [x, y] = entityPosition(state, enemy);
            return formTargetable(enemy) && Math.hypot(x - centerX, y - centerY) <= (profile.radius ?? 48);
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
    radius: profile.radius ?? 38,
    remaining: defenseRules.fireWaveVisualMs,
    color: profile.color,
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
