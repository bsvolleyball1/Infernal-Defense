import { dragonForms } from '../content/dragon-forms';
import { defenseRules } from '../content/defense-rules';
import { isDefenseMonster } from '../content/enemies';
import type { DefenseState, GameState } from '../game/types';

const check = (ok: unknown, message: string): void => {
  if (!ok) throw new Error(`Defense save: ${message}`);
};
function record(value: unknown): asserts value is Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), 'Expected an object.');
}
const finite = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): boolean =>
  typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): boolean =>
  finite(n, min, max) && Number.isSafeInteger(n);
function point(value: unknown): void {
  record(value);
  check(finite(value.x, 0, 700) && finite(value.y, 0, 430), 'Invalid spell coordinates.');
}

export function validateDefense(value: unknown): asserts value is DefenseState {
  record(value);
  check(['defense-1', 'defense-2'].includes(value.ruleset as string), 'Unknown combat ruleset.');
  check(value.mode === 'journey' || value.mode === 'sandbox', 'Invalid mode.');
  record(value.ranks);
  for (const type of ['fire', 'ice', 'poison']) {
    const ranks = value.ranks[type];
    check(
      Array.isArray(ranks) && ranks.length === 6 && ranks.every((n) => integer(n, 0, 1000)),
      'Invalid upgrade ranks.',
    );
  }
  check(finite(value.maxMana, 200) && finite(value.mana, 0, value.maxMana as number), 'Invalid mana.');
  check(integer(value.rng, 1, 0xffffffff), 'Invalid RNG state.');
  check(value.countdown === null || finite(value.countdown, 0, 5000), 'Invalid wave countdown.');
  record(value.spellCooldowns);
  for (const key of ['fire', 'ice', 'poison'])
    check(finite(value.spellCooldowns[key], 0, 5000), 'Invalid spell cooldown.');
  check(
    value.targeting === null || value.targeting === 'fire' || value.targeting === 'poison',
    'Invalid spell targeting.',
  );
  if (value.preview !== null) point(value.preview);
  check(Array.isArray(value.impacts) && Array.isArray(value.visuals), 'Invalid spell effects.');
  for (const impact of value.impacts as unknown[]) {
    record(impact);
    point(impact);
    check(integer(impact.id, 1) && finite(impact.remaining, 0, 500) && finite(impact.damage), 'Invalid impact.');
  }
  for (const visual of value.visuals as unknown[]) {
    record(visual);
    point(visual);
    if (visual.color !== undefined)
      check(typeof visual.color === 'string' && /^#[0-9a-f]{6}$/i.test(visual.color), 'Invalid visual color.');
    check(
      integer(visual.id, 1) &&
        ['fire', 'ice', 'poison'].includes(visual.kind as string) &&
        finite(visual.remaining, 0, 3000) &&
        finite(visual.radius, 0, 10000),
      'Invalid spell visual.',
    );
  }
  record(value.testWave);
  check(
    Object.entries(value.testWave).every(([kind, n]) => isDefenseMonster(kind) && integer(n, 0, 999)),
    'Invalid test wave.',
  );
}

export function validateDefenseEntities(state: GameState): void {
  const d = state.defense;
  if (!d) return;
  check(state.eggs.length >= 3 && state.eggs.length <= 8, 'Invalid upgraded egg count.');
  for (const tower of state.towers)
    if (tower) {
      check(tower.level <= (d.ruleset === 'defense-2' ? 3 : 6), 'Dragon exceeds this battle tier cap.');
      if (tower.charges !== undefined)
        check(
          integer(
            tower.charges,
            0,
            (tower.evolution ? (dragonForms[tower.evolution.form].count ?? 1) : 3) + d.ranks.ice[2],
          ),
          'Invalid ice charges.',
        );
      if (tower.evolution)
        check(
          (tower.charges === undefined) === (tower.chargeTimer === undefined),
          'Charges and recharge timer must be saved together.',
        );
      if (tower.chargeTimer !== undefined) check(finite(tower.chargeTimer, 0, 1000), 'Invalid charge timer.');
      if (tower.beamIds !== undefined)
        check(
          Array.isArray(tower.beamIds) &&
            new Set(tower.beamIds).size === tower.beamIds.length &&
            tower.beamIds.every((id) => state.enemies.some((e) => e.id === id)),
          'Invalid beam target.',
        );
    }
  for (const enemy of state.enemies) {
    for (const key of [
      'frozen',
      'poisonDamage',
      'poisonDamageMultiplier',
      'untargetable',
      'nullified',
      'invulnerable',
      'deathDelay',
      'lastHitAgo',
      'summonPause',
    ] as const)
      if (enemy[key] !== undefined) check(finite(enemy[key]), `Invalid ${key}.`);
    // A 5000ms travel at the 1000/60 step undershoots zero by a rounding error.
    if (enemy.summonClock !== undefined)
      check(finite(enemy.summonClock, -defenseRules.balanceEpsilon), 'Invalid summonClock.');
    for (const key of ['ghostTriggered', 'empowered'] as const)
      if (enemy[key] !== undefined) check(typeof enemy[key] === 'boolean', `Invalid ${key}.`);
    if (enemy.poisonSource !== undefined)
      check(['fire', 'ice', 'poison', 'spell'].includes(enemy.poisonSource), 'Invalid poison source.');
  }
  for (const shot of state.projectiles) {
    if (shot.effect !== undefined) {
      record(shot.effect);
      check(['none', 'freeze', 'poison'].includes(shot.effect.kind), 'Invalid projectile effect.');
      if (shot.effect.kind === 'freeze') check(finite(shot.effect.chance, 0, 1), 'Invalid freeze payload.');
      if (shot.effect.kind === 'poison') {
        check(finite(shot.effect.duration, 0, 5000) && finite(shot.effect.slow), 'Invalid poison payload.');
        if (shot.effect.tickDamage !== undefined)
          check(finite(shot.effect.tickDamage), 'Invalid poison damage payload.');
      }
    }
    if (shot.retarget !== undefined) {
      record(shot.retarget);
      point(shot.retarget.origin);
      check(finite(shot.retarget.range, 0, 10000), 'Invalid retarget range.');
    }
    if (shot.color !== undefined) check(/^#[0-9a-f]{6}$/i.test(shot.color), 'Invalid projectile color.');
    if (shot.damageMultiplier !== undefined)
      check(finite(shot.damageMultiplier, 1, 10), 'Invalid projectile damage multiplier.');
    if (shot.freezeChance !== undefined) check(finite(shot.freezeChance, 0, 1), 'Invalid freeze chance.');
    for (const key of ['poisonDuration', 'slowDuration'] as const)
      if (shot[key] !== undefined) check(finite(shot[key]), 'Invalid projectile payload.');
    if (shot.towerIndex !== undefined)
      check(integer(shot.towerIndex, 0, state.towers.length - 1), 'Invalid projectile origin.');
  }
  for (const egg of state.eggs) {
    if (egg.returnTimer !== undefined)
      check(egg.status === 'dropped' && finite(egg.returnTimer, 0, 30000), 'Invalid egg return.');
    if (egg.direct !== undefined) check(typeof egg.direct === 'boolean', 'Invalid direct egg route.');
  }
  const ids = new Set([...state.eggs, ...state.enemies, ...state.projectiles].map((e) => e.id));
  for (const effect of [...d.impacts, ...d.visuals]) {
    check(!ids.has(effect.id) && effect.id < state.nextEntityId, 'Invalid spell entity ID.');
    ids.add(effect.id);
  }
}
