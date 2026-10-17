import { entityPosition, towerPosition } from './geometry';
import { towerRange, battleRules } from './rules';
import { rank, rankTotal, randomValue } from './defense-state';
import { applyDamage, damageMultiplier } from './damage';
import type { Enemy, GameEvent, GameState, Tower } from './types';
import { attackIndex, fireLevels, iceLevels, poisonLevels } from '../content/dragon-attacks';
import { towerDamageMultiplier, towerRangeMultiplier } from './tower-bonuses';
import { dragonForms, formForTower } from '../content/dragon-forms';

export function defenseRange(state: GameState, tower: Tower): number {
  const index = state.towers.indexOf(tower);
  return towerRange(tower) *
    (tower.type === 'ice' ? 1 + rankTotal(state, 'ice') * 0.01 : 1) *
    towerRangeMultiplier(state, index);
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
    if (tower.form || tower.colors) {
      tickEvolvedTower(state, tower, index, targets, dt, events);
      return;
    }
    if (tower.type === 'fire') {
      const profile = fireLevels[attackIndex(tower.level)],
        base = profile.dps;
      const affected = profile.area ? targets : targets.slice(0, profile.beams);
      tower.beamIds = tower.level < 5 ? affected.map((e) => e.id) : [];
      if (tower.level >= 5) {
        if (tower.cooldown > 1e-7) return;
        tower.cooldown = 1000;
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
            remaining: 350,
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
      const capacity = iceLevels[attackIndex(tower.level)].capacity + rank(state, 'ice', 2);
      if (tower.charges === undefined) {
        tower.charges = capacity;
        tower.chargeTimer = 1000;
      }
      if (tower.charges < capacity) {
        tower.chargeTimer = (tower.chargeTimer ?? 1000) - dt;
        while (tower.chargeTimer <= 1e-7 && tower.charges < capacity) {
          tower.charges++;
          tower.chargeTimer += 1000;
        }
      }
      if (tower.charges >= capacity) tower.chargeTimer = 1000;
      if (!targets.length || !tower.charges) return;
      const p = towerPosition(state, index);
      targets.sort((a, b) => {
        const [ax, ay] = entityPosition(state, a),
          [bx, by] = entityPosition(state, b);
        return Math.hypot(ax - p.x, ay - p.y) - Math.hypot(bx - p.x, by - p.y) || a.id - b.id;
      });
      for (let i = 0; i < tower.charges; i++) fireProjectile(state, tower, index, targets[0]);
      tower.charges = 0;
      tower.chargeTimer = 1000;
    } else {
      if (!targets.length || tower.cooldown > 1e-7) return;
      fireProjectile(state, tower, index, targets[0]);
      tower.cooldown = 250 / (1 + rankTotal(state, 'poison') * 0.01);
    }
    events.push({ type: 'sound', dragon: tower.type });
  });
}

function tickEvolvedTower(
  state: GameState,
  tower: Tower,
  index: number,
  targets: Enemy[],
  dt: number,
  events: GameEvent[],
): void {
  const profile = dragonForms[formForTower(tower)];
  const damage = profile.damage * damageMultiplier(state, tower.type) * towerDamageMultiplier(state, index);
  if (profile.ability === 'beam' || profile.ability === 'focus' || profile.ability === 'mapBeam') {
    const affected = profile.ability === 'mapBeam'
      ? state.enemies.filter(enemy => enemy.hp > 0 && !enemy.rewarded && !(enemy.untargetable! > 0))
      : targets.slice(0, profile.ability === 'focus' ? 1 : profile.count ?? 1);
    tower.beamIds = affected.map(enemy => enemy.id);
    for (const enemy of affected)
      applyDamage(state, enemy, damage * dt / 1000, tower.type, events);
    return;
  }
  if (profile.ability === 'charged') {
    const capacity = profile.count ?? 1;
    if (tower.charges === undefined) {
      tower.charges = capacity;
      tower.chargeTimer = 1000;
    }
    if (tower.charges < capacity) {
      tower.chargeTimer = (tower.chargeTimer ?? 1000) - dt;
      while (tower.chargeTimer <= 1e-7 && tower.charges < capacity) {
        tower.charges++;
        tower.chargeTimer += 1000;
      }
    }
    if (tower.charges >= capacity) tower.chargeTimer = 1000;
    if (!targets.length || !tower.charges) return;
    for (const enemy of targets.slice(0, tower.charges))
      fireFormProjectile(state, tower, index, enemy, damage);
    tower.charges = 0;
    tower.chargeTimer = 1000;
    events.push({ type: 'sound', dragon: tower.type });
    return;
  }
  if (profile.ability === 'rapid' || profile.ability === 'acid' || profile.ability === 'sniper') {
    if (!targets.length || tower.cooldown > 1e-7) return;
    fireFormProjectile(state, tower, index, targets[0], damage, profile.ability === 'acid' ? profile.duration : undefined);
    tower.cooldown = profile.interval / (1 + rankTotal(state, tower.type) * 0.01);
    events.push({ type: 'sound', dragon: tower.type });
    return;
  }
  if (!targets.length || tower.cooldown > 1e-7) return;
  const target = targets[0];
  const [centerX, centerY] = entityPosition(state, target);
  const area = profile.ability === 'cone'
    ? targets.filter(enemy => inBreathCone(state, tower, index, enemy, target, profile.radius ?? 45))
    : profile.ability === 'explosion' || profile.ability === 'radius' ||
        profile.ability === 'tar' || profile.ability === 'earthquake'
      ? state.enemies.filter(enemy => {
          const [x, y] = entityPosition(state, enemy);
          return enemy.hp > 0 && Math.hypot(x - centerX, y - centerY) <= (profile.radius ?? 48);
        })
      : [target];
  for (const enemy of area) {
    if (profile.ability === 'nullify') enemy.nullified = Math.max(enemy.nullified ?? 0, profile.duration ?? 4000);
    applyDamage(state, enemy, damage, tower.type, events);
    if (profile.ability === 'tar') enemy.slow = Math.max(enemy.slow, profile.duration ?? 2000);
    if (profile.ability === 'earthquake') enemy.frozen = Math.max(enemy.frozen ?? 0, profile.duration ?? 1500);
  }
  const position = profile.ability === 'explosion' || profile.ability === 'radius' ||
      profile.ability === 'tar' || profile.ability === 'earthquake'
    ? { x: centerX, y: centerY }
    : towerPosition(state, index);
  state.defense!.visuals.push({
    id: state.nextEntityId++,
    kind: tower.type === 'fire' ? 'fire' : tower.type === 'ice' ? 'ice' : 'poison',
    x: position.x,
    y: position.y,
    radius: profile.radius ?? 38,
    remaining: 350,
    color: profile.color,
  });
  tower.cooldown = profile.interval;
  events.push({ type: 'sound', dragon: tower.type });
}

function inBreathCone(
  state: GameState,
  tower: Tower,
  index: number,
  candidate: Enemy,
  target: Enemy,
  width: number,
): boolean {
  const origin = towerPosition(state, index);
  const [targetX, targetY] = entityPosition(state, target);
  const [candidateX, candidateY] = entityPosition(state, candidate);
  const dx = targetX - origin.x;
  const dy = targetY - origin.y;
  const distance = Math.hypot(dx, dy) || 1;
  const cx = candidateX - origin.x;
  const cy = candidateY - origin.y;
  const along = (cx * dx + cy * dy) / distance;
  const across = Math.abs(cx * dy - cy * dx) / distance;
  return along >= 0 && along <= defenseRange(state, tower) && across <= Math.min(width, along * 0.55);
}

function fireFormProjectile(
  state: GameState,
  tower: Tower,
  index: number,
  target: Enemy,
  damage: number,
  poisonDuration?: number,
): void {
  const position = towerPosition(state, index);
  state.projectiles.push({
    id: state.nextEntityId++,
    x: position.x,
    y: position.y - 18,
    targetId: target.id,
    dragon: tower.type,
    damage,
    speed: tower.type === 'fire' ? 6 : 5,
    level: tower.level,
    towerIndex: index,
    ...(poisonDuration ? { poisonDuration } : {}),
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
    y: p.y - 18,
    targetId: target.id,
    dragon: tower.type,
    damage: base * damageMultiplier(state, tower.type) * towerDamageMultiplier(state, index),
    ...(towerDamageMultiplier(state, index) > 1
      ? { damageMultiplier: towerDamageMultiplier(state, index) }
      : {}),
    speed: 5,
    level: tower.level,
    towerIndex: index,
    freezeChance: tower.type === 'ice' ? ice.freeze : 0,
    poisonDuration: tower.type === 'poison' ? poison.poison : 0,
    slowDuration: tower.type === 'poison' ? poison.slow : 0,
  });
}
export function tickDefenseProjectiles(state: GameState, dt: number, events: GameEvent[]): void {
  for (const shot of state.projectiles) {
    let target = state.enemies.find(
      (e) => e.id === shot.targetId && e.hp > 0 && !e.rewarded && !(e.untargetable! > 0),
    );
    if (!target && shot.dragon === 'ice' && shot.towerIndex !== undefined) {
      const tower = state.towers[shot.towerIndex];
      if (tower) {
        const perch = towerPosition(state, shot.towerIndex);
        target = targetsInRange(state, tower, shot.towerIndex).sort((a, b) => {
          const [ax, ay] = entityPosition(state, a),
            [bx, by] = entityPosition(state, b);
          return (
            Math.hypot(ax - perch.x, ay - perch.y) - Math.hypot(bx - perch.x, by - perch.y) || a.id - b.id
          );
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
    if (distance < travel + 3) {
      applyDamage(state, target, shot.damage, shot.dragon, events);
      if (target.hp > 0 && !target.deathDelay && !target.invulnerable) {
        if (shot.freezeChance && randomValue(state) < shot.freezeChance)
          target.frozen = Math.max(target.frozen ?? 0, 1000);
        if (shot.poisonDuration) {
          target.poison = shot.poisonDuration;
          target.poisonD = 1000;
          target.poisonDamage =
            target.max * 0.01 * damageMultiplier(state, shot.dragon) * (shot.damageMultiplier ?? 1);
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
  if (tower.form || tower.colors) {
    const form = dragonForms[formForTower(tower)];
    if (form.ability === 'beam' || form.ability === 'focus' || form.ability === 'mapBeam')
      return `${form.description} · ${(form.damage * damage).toFixed(1)} DPS`;
    if (form.ability === 'charged')
      return `${form.count ?? 1} charge(s) · ${(form.damage * damage).toFixed(1)} damage`;
    if (form.ability === 'rapid' || form.ability === 'acid' || form.ability === 'sniper')
      return `${(form.damage * damage).toFixed(1)} damage · ${(1000 / form.interval).toFixed(2)} shots/s`;
    return `${form.description} · ${(form.damage * damage).toFixed(1)} damage`;
  }
  if (tower.type === 'fire') {
    const profile = fireLevels[index];
    return `${profile.area ? 'Area waves' : `${profile.beams} beam(s)`} · ${(profile.dps * damage).toFixed(1)} DPS`;
  }
  if (tower.type === 'ice') {
    const profile = iceLevels[index],
      capacity = profile.capacity + rank(state, 'ice', 2);
    return `${tower.charges ?? capacity} / ${capacity} charges · ${(profile.damage * damage).toFixed(1)} damage · ${profile.freeze * 100}% freeze`;
  }
  const profile = poisonLevels[index];
  return `${(profile.damage * damage).toFixed(1)} damage · ${(4 * (1 + rankTotal(state, 'poison') * 0.01)).toFixed(2)} shots/s${profile.poison ? ' · poison' : ''}${profile.slow ? ' · 50% slow' : ''}`;
}
