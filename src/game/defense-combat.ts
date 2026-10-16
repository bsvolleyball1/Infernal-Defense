import { byDistanceFrom, entityPosition, towerPosition } from './geometry';
import { advanceProjectile } from './projectile-motion';
import { towerRange } from './rules';
import { rankOf, rankTotal, randomValue } from './defense-state';
import { defenseRules } from '../content/defense-rules';
import { applyDamage, damageMultiplier } from './damage';
import type { DefenseBattle, Enemy, GameEvent, GameState, Projectile, ProjectileEffect, Tower } from './types';
import { attackIndex, fireLevels, iceLevels, poisonLevels } from '../content/dragon-attacks';
import { towerContext } from './tower-bonuses';
import type { TowerContext } from './tower-bonuses';

export function defenseRange(state: GameState, tower: Tower, index = state.towers.indexOf(tower)): number {
  return attackContext(state, tower, index).range;
}

function attackContext(state: GameState, tower: Tower, index: number): TowerContext {
  const ice = tower.type === 'ice' ? 1 + rankTotal(state, 'ice') * defenseRules.nonAttackRankBonus : 1;
  return towerContext(state, index, towerRange(tower) * ice);
}

export function targetsInRange(state: GameState, tower: Tower, index: number, context = attackContext(state, tower, index)): Enemy[] {
  return state.enemies
    .filter((e) => {
      const [x, y] = entityPosition(state, e);
      return e.hp > 0 && !e.rewarded && !((e.untargetable ?? 0) > 0) && Math.hypot(x - context.position.x, y - context.position.y) < context.range;
    })
    .sort((a, b) => b.progress - a.progress || a.id - b.id);
}
export function tickDefenseTowers(state: DefenseBattle, dt: number, events: GameEvent[]): void {
  state.towers.forEach((tower, index) => {
    if (!tower) return;
    const context = attackContext(state, tower, index);
    const targets = targetsInRange(state, tower, index, context);
    tower.cooldown = Math.max(0, tower.cooldown - dt);
    if (tower.type === 'fire') {
      tickFireTower(state, tower, targets, dt, events, context);
      return;
    }
    const fired =
      tower.type === 'ice'
        ? tickIceTower(state, tower, index, targets, dt, context)
        : tickPoisonTower(state, tower, index, targets, context);
    if (fired) events.push({ type: 'sound', dragon: tower.type });
  });
}

/** Levels 1-4 burn continuously along beams; level 5+ releases a periodic area wave. */
function tickFireTower(
  state: DefenseBattle,
  tower: Tower,
  targets: Enemy[],
  dt: number,
  events: GameEvent[],
  context: TowerContext,
): void {
  const profile = fireLevels[attackIndex(tower.level)];
  const damage = profile.dps * damageMultiplier(state, 'fire') * context.damageMultiplier;
  const affected = profile.area ? targets : targets.slice(0, profile.beams);
  tower.beamIds = tower.level < 5 ? affected.map((e) => e.id) : [];
  if (tower.level < 5) {
    for (const e of affected) applyDamage(state, e, (damage * dt) / 1000, 'fire', events);
    return;
  }
  if (tower.cooldown > defenseRules.balanceEpsilon) return;
  tower.cooldown = defenseRules.fireWaveCooldownMs;
  for (const e of affected) applyDamage(state, e, damage, 'fire', events);
  if (!affected.length) return;
  state.defense.visuals.push({
    id: state.nextEntityId++,
    kind: 'fire',
    x: context.position.x,
    y: context.position.y,
    radius: context.range,
    remaining: defenseRules.fireWaveVisualMs,
  });
}

/** Recharges over time, then spends every stored charge on the nearest target. Returns true when it fires. */
function tickIceTower(
  state: DefenseBattle,
  tower: Tower,
  index: number,
  targets: Enemy[],
  dt: number,
  context: TowerContext,
): boolean {
  const capacity = iceLevels[attackIndex(tower.level)].capacity + rankOf(state, 'ice', 'moreCharges');
  if (tower.charges === undefined) {
    tower.charges = capacity;
    tower.chargeTimer = defenseRules.iceChargeIntervalMs;
  }
  if (tower.charges < capacity) {
    tower.chargeTimer = (tower.chargeTimer ?? defenseRules.iceChargeIntervalMs) - dt;
    while (tower.chargeTimer <= defenseRules.balanceEpsilon && tower.charges < capacity) {
      tower.charges++;
      tower.chargeTimer += defenseRules.iceChargeIntervalMs;
    }
  }
  if (tower.charges >= capacity) tower.chargeTimer = defenseRules.iceChargeIntervalMs;
  if (!targets.length || !tower.charges) return false;
  targets.sort(byDistanceFrom(state, context.position));
  for (let i = 0; i < tower.charges; i++) fireProjectile(state, tower, index, targets[0], context);
  tower.charges = 0;
  tower.chargeTimer = defenseRules.iceChargeIntervalMs;
  return true;
}

/** Fires at the most advanced target whenever its cooldown allows. Returns true when it fires. */
function tickPoisonTower(
  state: DefenseBattle,
  tower: Tower,
  index: number,
  targets: Enemy[],
  context: TowerContext,
): boolean {
  if (!targets.length || tower.cooldown > defenseRules.balanceEpsilon) return false;
  fireProjectile(state, tower, index, targets[0], context);
  tower.cooldown =
    defenseRules.poisonShotIntervalMs / (1 + rankTotal(state, 'poison') * defenseRules.nonAttackRankBonus);
  return true;
}

function projectileEffect(tower: Tower): ProjectileEffect {
  if (tower.type === 'ice') return { kind: 'freeze', chance: iceLevels[attackIndex(tower.level)].freeze };
  if (tower.type === 'poison') {
    const profile = poisonLevels[attackIndex(tower.level)];
    return { kind: 'poison', duration: profile.poison, slow: profile.slow };
  }
  return { kind: 'none' };
}

function fireProjectile(state: GameState, tower: Tower, index: number, target: Enemy, context: TowerContext): void {
  const ice = iceLevels[attackIndex(tower.level)],
    poison = poisonLevels[attackIndex(tower.level)];
  const base = tower.type === 'ice' ? ice.damage : poison.damage;
  const bonus = context.damageMultiplier;
  state.projectiles.push({
    id: state.nextEntityId++,
    x: context.position.x,
    y: context.position.y - defenseRules.projectileOriginOffset,
    targetId: target.id,
    dragon: tower.type,
    damage: base * damageMultiplier(state, tower.type) * bonus,
    ...(bonus > 1 ? { damageMultiplier: bonus } : {}),
    speed: defenseRules.projectileSpeed,
    level: tower.level,
    towerIndex: index,
    effect: projectileEffect(tower),
  });
}

/** Ice shots retarget the nearest enemy in range when theirs is gone; other shots fizzle. */
function liveTarget(state: DefenseBattle, shot: Projectile): Enemy | undefined {
  const target = state.enemies.find(
    (e) => e.id === shot.targetId && e.hp > 0 && !e.rewarded && !((e.untargetable ?? 0) > 0),
  );
  if (target || shot.dragon !== 'ice' || shot.towerIndex === undefined) return target;
  const tower = state.towers[shot.towerIndex];
  const replacement = tower
    ? targetsInRange(state, tower, shot.towerIndex).sort(
        byDistanceFrom(state, towerPosition(state, shot.towerIndex)),
      )[0]
    : undefined;
  if (replacement) shot.targetId = replacement.id;
  return replacement;
}

function shotEffect(shot: Projectile): ProjectileEffect {
  if (shot.effect) return shot.effect;
  if (shot.freezeChance) return { kind: 'freeze', chance: shot.freezeChance };
  if (shot.poisonDuration || shot.slowDuration)
    return { kind: 'poison', duration: shot.poisonDuration ?? 0, slow: shot.slowDuration ?? 0 };
  return { kind: 'none' };
}

function applyShotEffects(state: DefenseBattle, shot: Projectile, target: Enemy): void {
  if (target.hp <= 0 || target.deathDelay || target.invulnerable) return;
  const effect = shotEffect(shot);
  if (effect.kind === 'freeze' && effect.chance && randomValue(state) < effect.chance)
    target.frozen = Math.max(target.frozen ?? 0, defenseRules.iceFreezeOnHitMs);
  if (effect.kind === 'poison') {
    target.poison = effect.duration;
    target.poisonD = defenseRules.poisonTickMs;
    target.poisonDamage =
      target.max *
      defenseRules.poisonShotHealthFraction *
      damageMultiplier(state, shot.dragon) *
      (shot.damageMultiplier ?? 1);
    target.poisonSource = shot.dragon;
    target.slow = Math.max(target.slow, effect.slow);
  }
}

export function tickDefenseProjectiles(state: DefenseBattle, dt: number, events: GameEvent[]): void {
  for (const shot of state.projectiles) {
    const target = liveTarget(state, shot);
    if (!target) {
      shot.speed = 0;
      continue;
    }
    if (!advanceProjectile(state, shot, target, dt, defenseRules.projectileHitSlop)) continue;
    applyDamage(state, target, shot.damage, shot.dragon, events);
    applyShotEffects(state, shot, target);
    shot.speed = 0;
  }
  state.projectiles = state.projectiles.filter(
    (p) => p.speed > 0 && state.enemies.some((e) => e.id === p.targetId && e.hp > 0 && !e.rewarded),
  );
}

export function towerSummary(state: GameState, tower: Tower): string {
  const context = attackContext(state, tower, state.towers.indexOf(tower));
  const damage = damageMultiplier(state, tower.type) * context.damageMultiplier,
    index = attackIndex(tower.level);
  if (tower.type === 'fire') {
    const profile = fireLevels[index];
    return `${profile.area ? 'Area waves' : `${profile.beams} beam(s)`} · ${(profile.dps * damage).toFixed(1)} DPS`;
  }
  if (tower.type === 'ice') {
    const profile = iceLevels[index],
      capacity = profile.capacity + rankOf(state, 'ice', 'moreCharges');
    return `${tower.charges ?? capacity} / ${capacity} charges · ${(profile.damage * damage).toFixed(1)} damage · ${profile.freeze * 100}% freeze`;
  }
  const profile = poisonLevels[index];
  return `${(profile.damage * damage).toFixed(1)} damage · ${((1000 / defenseRules.poisonShotIntervalMs) * (1 + rankTotal(state, 'poison') * defenseRules.nonAttackRankBonus)).toFixed(2)} shots/s${profile.poison ? ' · poison' : ''}${profile.slow ? ' · 50% slow' : ''}`;
}
