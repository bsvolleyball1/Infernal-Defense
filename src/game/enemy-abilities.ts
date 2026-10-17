import { isDefenseMonster, enemyTraits } from '../content/enemies';
import { entityPosition } from './geometry';
import { randomValue } from './defense-state';
import { applyDamage } from './damage';
import { summonEnemy, withDefenseTimers } from './enemy-factory';
import { defeatEnemy } from './rewards';
import { defenseRules } from '../content/defense-rules';
import type { DefenseEnemy } from './enemy-factory';
import type { DefenseBattle, Enemy, GameEvent } from './types';

/** Returns false while an ability holds the enemy in place. */
export function tickEnemyAbilities(state: DefenseBattle, enemy: Enemy, dt: number, events: GameEvent[]): boolean {
  const subject = withDefenseTimers(enemy);
  subject.untargetable = Math.max(0, subject.untargetable - dt);
  subject.invulnerable = Math.max(0, subject.invulnerable - dt);
  subject.lastHitAgo += dt;
  if (subject.deathDelay > 0) {
    subject.deathDelay = Math.max(0, subject.deathDelay - dt);
    if (subject.deathDelay < defenseRules.balanceEpsilon) {
      subject.hp = 0;
      defeatEnemy(state, subject, events);
    }
    return false;
  }
  if (subject.poison > 0) {
    const active = Math.min(dt, subject.poison);
    subject.poison -= active;
    subject.poisonD -= active;
    while (subject.poisonD <= defenseRules.balanceEpsilon && subject.hp > 0) {
      applyDamage(state, subject, subject.poisonDamage, subject.poisonSource ?? 'poison', events);
      subject.poisonD += defenseRules.poisonTickMs;
    }
  }
  if (subject.hp <= 0) return false;
  const traits = enemyTraits(subject.kind);
  if (traits.regen && subject.lastHitAgo >= traits.regen.delayMs)
    subject.hp = Math.min(subject.max, subject.hp + (subject.max * traits.regen.fractionPerSecond * dt) / 1000);
  if (traits.healAura) {
    const [x, y] = entityPosition(state, subject);
    for (const other of state.enemies) {
      if (other === subject || other.hp <= 0 || withDefenseTimers(other).deathDelay > 0) continue;
      const [ox, oy] = entityPosition(state, other);
      if (Math.hypot(x - ox, y - oy) <= traits.healAura.radius)
        other.hp = Math.min(other.max, other.hp + (other.max * traits.healAura.fractionPerSecond * dt) / 1000);
    }
  }
  if (traits.summoner) return tickSummoner(state, subject, dt, traits.summoner);
  return true;
}

function tickSummoner(
  state: DefenseBattle,
  enemy: DefenseEnemy,
  dt: number,
  summoner: { travelMs: number; pauseMs: number },
): boolean {
  if (enemy.summonPause > 0) {
    enemy.summonPause = Math.max(0, enemy.summonPause - dt);
    if (enemy.summonPause < defenseRules.balanceEpsilon) {
      const candidates = state.knownMonsters.filter(isDefenseMonster);
      if (candidates.length) summonEnemy(state, candidates[Math.floor(randomValue(state) * candidates.length)], enemy);
      enemy.summonClock = summoner.travelMs;
    }
    return false;
  }
  enemy.summonClock -= dt;
  if (enemy.summonClock <= defenseRules.balanceEpsilon) {
    enemy.summonPause = summoner.pauseMs;
    return false;
  }
  return true;
}
