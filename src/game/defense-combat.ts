import { entityPosition, towerPosition } from './geometry';
import { towerRange, battleRules } from './rules';
import { rankOf, rankTotal, randomValue } from './defense-state';
import { defenseRules } from '../content/defense-rules';
import { applyDamage, damageMultiplier } from './damage';
import type { Enemy, GameEvent, GameState, Tower } from './types';
import { attackIndex, fireLevels, iceLevels, poisonLevels } from '../content/dragon-attacks';
import { towerDamageMultiplier, towerRangeMultiplier } from './tower-bonuses';

export function defenseRange(state: GameState, tower: Tower): number {
  const index = state.towers.indexOf(tower);
  return (
    towerRange(tower) *
    (tower.type === 'ice' ? 1 + rankTotal(state, 'ice') * defenseRules.nonAttackRankBonus : 1) *
    towerRangeMultiplier(state, index)
  );
}
export function targetsInRange(state: GameState, tower: Tower, index: number): Enemy[] {
  const p = towerPosition(state, index),
    range = defenseRange(state, tower);
  return state.enemies
    .filter((e) => {
      const [x, y] = entityPosition(state, e);
      return e.hp > 0 && !e.rewarded && !(e.untargetable! > 0) && Math.hypot(x - p.x, y - p.y) < range;
    })
    .sort((a, b) => b.progress - a.progress || a.id - b.id);
}
export function tickDefenseTowers(state: GameState, dt: number, events: GameEvent[]): void {
  state.towers.forEach((tower, index) => {
    if (!tower) return;
    const targets = targetsInRange(state, tower, index);
    tower.cooldown = Math.max(0, tower.cooldown - dt);
    if (tower.type === 'fire') {
      const profile = fireLevels[attackIndex(tower.level)],
        base = profile.dps;
      const affected = profile.area ? targets : targets.slice(0, profile.beams);
      tower.beamIds = tower.level < 5 ? affected.map((e) => e.id) : [];
      if (tower.level >= 5) {
        if (tower.cooldown > defenseRules.balanceEpsilon) return;
        tower.cooldown = defenseRules.fireWaveCooldownMs;
        for (const e of affected)
          applyDamage(
            state,
            e,
            base * damageMultiplier(state, 'fire') * towerDamageMultiplier(state, index),
            'fire',
            events,
          );
        if (affected.length) {
          const p = towerPosition(state, index);
          state.defense!.visuals.push({
            id: state.nextEntityId++,
            kind: 'fire',
            x: p.x,
            y: p.y,
            radius: defenseRange(state, tower),
            remaining: defenseRules.fireWaveVisualMs,
          });
        }
      } else
        for (const e of affected)
          applyDamage(
            state,
            e,
            (base * damageMultiplier(state, 'fire') * towerDamageMultiplier(state, index) * dt) / 1000,
            'fire',
            events,
          );
      return;
    }
    if (tower.type === 'ice') {
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
      if (!targets.length || !tower.charges) return;
      const p = towerPosition(state, index);
      targets.sort((a, b) => {
        const [ax, ay] = entityPosition(state, a),
          [bx, by] = entityPosition(state, b);
        return Math.hypot(ax - p.x, ay - p.y) - Math.hypot(bx - p.x, by - p.y) || a.id - b.id;
      });
      for (let i = 0; i < tower.charges; i++) fireProjectile(state, tower, index, targets[0]);
      tower.charges = 0;
      tower.chargeTimer = defenseRules.iceChargeIntervalMs;
    } else {
      if (!targets.length || tower.cooldown > defenseRules.balanceEpsilon) return;
      fireProjectile(state, tower, index, targets[0]);
      tower.cooldown = defenseRules.poisonShotIntervalMs / (1 + rankTotal(state, 'poison') * defenseRules.nonAttackRankBonus);
    }
    events.push({ type: 'sound', dragon: tower.type });
  });
}
function fireProjectile(state: GameState, tower: Tower, index: number, target: Enemy): void {
  const p = towerPosition(state, index);
  const ice = iceLevels[attackIndex(tower.level)],
    poison = poisonLevels[attackIndex(tower.level)];
  const base = tower.type === 'ice' ? ice.damage : poison.damage;
  state.projectiles.push({
    id: state.nextEntityId++,
    x: p.x,
    y: p.y - defenseRules.projectileOriginOffset,
    targetId: target.id,
    dragon: tower.type,
    damage: base * damageMultiplier(state, tower.type) * towerDamageMultiplier(state, index),
    ...(towerDamageMultiplier(state, index) > 1 ? { damageMultiplier: towerDamageMultiplier(state, index) } : {}),
    speed: defenseRules.projectileSpeed,
    level: tower.level,
    towerIndex: index,
    freezeChance: tower.type === 'ice' ? ice.freeze : 0,
    poisonDuration: tower.type === 'poison' ? poison.poison : 0,
    slowDuration: tower.type === 'poison' ? poison.slow : 0,
  });
}
export function tickDefenseProjectiles(state: GameState, dt: number, events: GameEvent[]): void {
  for (const shot of state.projectiles) {
    let target = state.enemies.find((e) => e.id === shot.targetId && e.hp > 0 && !e.rewarded && !(e.untargetable! > 0));
    if (!target && shot.dragon === 'ice' && shot.towerIndex !== undefined) {
      const tower = state.towers[shot.towerIndex];
      if (tower) {
        const perch = towerPosition(state, shot.towerIndex);
        target = targetsInRange(state, tower, shot.towerIndex).sort((a, b) => {
          const [ax, ay] = entityPosition(state, a),
            [bx, by] = entityPosition(state, b);
          return Math.hypot(ax - perch.x, ay - perch.y) - Math.hypot(bx - perch.x, by - perch.y) || a.id - b.id;
        })[0];
      }
      if (target) shot.targetId = target.id;
    }
    if (!target) {
      shot.speed = 0;
      continue;
    }
    const [x, y] = entityPosition(state, target),
      dx = x - shot.x,
      dy = y - shot.y,
      distance = Math.hypot(dx, dy);
    const travel = shot.speed * dt * battleRules.projectileTravelPerMillisecond;
    if (distance < travel + defenseRules.projectileHitSlop) {
      applyDamage(state, target, shot.damage, shot.dragon, events);
      if (target.hp > 0 && !target.deathDelay && !target.invulnerable) {
        if (shot.freezeChance && randomValue(state) < shot.freezeChance)
          target.frozen = Math.max(target.frozen ?? 0, defenseRules.iceFreezeOnHitMs);
        if (shot.poisonDuration) {
          target.poison = shot.poisonDuration;
          target.poisonD = defenseRules.poisonTickMs;
          target.poisonDamage = target.max * defenseRules.poisonShotHealthFraction * damageMultiplier(state, shot.dragon) * (shot.damageMultiplier ?? 1);
          target.poisonSource = shot.dragon;
        }
        if (shot.slowDuration) target.slow = Math.max(target.slow, shot.slowDuration);
      }
      shot.speed = 0;
    } else {
      shot.x += (dx / distance) * travel;
      shot.y += (dy / distance) * travel;
    }
  }
  state.projectiles = state.projectiles.filter(
    (p) => p.speed > 0 && state.enemies.some((e) => e.id === p.targetId && e.hp > 0 && !e.rewarded),
  );
}
export function towerSummary(state: GameState, tower: Tower): string {
  const damage = damageMultiplier(state, tower.type) * towerDamageMultiplier(state, state.towers.indexOf(tower)),
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
