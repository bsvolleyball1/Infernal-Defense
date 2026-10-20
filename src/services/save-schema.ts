import { validateEvolution } from './evolution-validation';
import { challengeAllowsDragon } from '../content/maps';
import { towerGridCellAt, towerGridCellKey } from '../content/tower-grid';
import type { DefenseProfile } from '../domain/model';
import { dragons, monsters } from '../content/catalog';
import { battlefields, getMap, gorge as map, routesFor } from '../content/maps';
import type { Battlefield } from '../content/maps';
import { isClearTowerPosition, isValidTowerGridPosition } from '../game/geometry';
import type { JourneyProgress } from '../game/journey';
import type { GameState } from '../game/types';
import { validateDefense, validateDefenseEntities } from './defense-validation';
import { array, boolean, check, choice, integer, number, object, own } from './validation/primitives';
import type { RecordValue } from './validation/primitives';

export interface SaveDataV2 {
  version: 2;
  savedAt: number;
  state: GameState;
  /** Absent in older battle-only saves; imported by the application. */
  journey?: JourneyProgress;
}

export function monster(value: unknown): void {
  choice(value, Object.keys(monsters), 'Monster kind');
}

export function dragon(value: unknown): void {
  choice(value, Object.keys(dragons), 'Dragon type');
}

export function progress(value: unknown, geometry = map, routeId = 0): void {
  number(value, 'Path progress', 0, routesFor(geometry)[routeId].length - 1);
}

export function route(value: RecordValue, geometry: Battlefield): number {
  const count = routesFor(geometry).length;
  if (count > 1 || own(value, 'routeId')) integer(value.routeId, 'Route id', 0, count - 1);
  return (value.routeId as number | undefined) ?? 0;
}

export function kinds(value: unknown, unique = true): asserts value is string[] {
  array(value, 'Bestiary');
  for (const kind of value) monster(kind);
  if (unique) check(new Set(value).size === value.length, 'Bestiary contains duplicate kinds.');
}

export function tower(value: unknown, geometry: Battlefield, legacy = false, profile?: DefenseProfile): void {
  if (value === null) return;
  object(value, 'Tower');
  dragon(value.type);
  check(
    challengeAllowsDragon(geometry, value.type as GameState['chosen'] & string),
    'Tower does not match this level challenge.',
  );
  integer(value.level, 'Tower level', 1);
  validateEvolution(value, geometry, profile === 'defense-2');
  if (profile === 'defense-2') check(own(value, 'position'), 'Grid towers require a position.');
  if (own(value, 'position')) {
    object(value.position, 'Tower position');
    number(value.position.x, 'Tower x', 0, geometry.width);
    number(value.position.y, 'Tower y', 0, geometry.height);
    check(
      (profile === 'defense-2' ? isValidTowerGridPosition : isClearTowerPosition)(
        { x: value.position.x as number, y: value.position.y as number },
        geometry,
      ),
      'Tower cannot touch the road or map edge.',
    );
  }
  if (legacy) {
    if (own(value, 'last')) number(value.last, 'Legacy tower timer');
  } else number(value.cooldown, 'Tower cooldown');
}

export function towers(
  value: unknown,
  geometry: Battlefield,
  legacy = false,
  count = map.perches.length,
  profile?: DefenseProfile,
): asserts value is unknown[] {
  array(value, 'Towers');
  check(value.length >= count || (legacy && value.length === 5), 'Tower slots must match the battlefield.');
  const occupied = new Set<string>();
  for (const item of value) {
    tower(item, geometry, legacy, profile);
    if (profile === 'defense-2' && item !== null) {
      const position = (item as { position: { x: number; y: number } }).position;
      const cell = towerGridCellAt(geometry, position);
      check(cell !== null, 'Invalid grid cell.');
      const key = towerGridCellKey(cell!);
      check(!occupied.has(key), 'Two towers occupy one grid cell.');
      occupied.add(key);
    }
  }
}

export function egg(value: unknown, legacy = false, geometry = map, count = 5): asserts value is RecordValue {
  object(value, 'Egg');
  integer(value.id, 'Egg id', 1, count);
  choice(value.status, ['nest', 'carried', 'dropped', 'escaped'], 'Egg status');
  const routeId =
    value.status === 'dropped' || value.status === 'carried' || own(value, 'routeId') ? route(value, geometry) : 0;
  if (value.progress !== null) progress(value.progress, geometry, routeId);
  if (value.status === 'nest') check(!own(value, 'routeId'), 'A nest egg cannot have a route.');
  if (value.carrier !== null) {
    // Original enemy ids were Math.random(), not integer entity ids.
    if (legacy) number(value.carrier, 'Legacy egg carrier');
    else integer(value.carrier, 'Egg carrier', 1);
  }
  if (value.status === 'carried') {
    check(value.carrier !== null, 'A carried egg requires a carrier.');
    if (!legacy) check(value.progress === null, 'A carried egg cannot have dropped progress.');
  } else check(value.carrier === null, 'Only carried eggs can have a carrier.');
  if (value.status === 'dropped') check(value.progress !== null, 'A dropped egg requires progress.');
  if (value.status === 'nest') check(value.progress === null, 'A nest egg cannot have path progress.');
}

export function eggs(value: unknown, legacy = false, geometry = map, count = 5): asserts value is RecordValue[] {
  array(value, 'Eggs');
  check(value.length === count, 'Egg count must match the battle.');
  const ids = new Set<number>();
  for (const item of value) {
    egg(item, legacy, geometry, count);
    check(!ids.has(item.id as number), 'Egg ids must be unique.');
    ids.add(item.id as number);
  }
}

export function validateState(value: unknown): asserts value is GameState {
  object(value, 'State');
  if (own(value, 'defense')) validateDefense(value.defense);
  const eggCount = value.defense && Array.isArray(value.eggs) ? value.eggs.length : 5;
  check(eggCount >= (value.defense ? 3 : 5) && eggCount <= 8, 'Invalid egg count.');
  const sandbox = (value.defense as GameState['defense'])?.mode === 'sandbox';
  choice(value.phase, ['ready', 'battle', 'won', 'lost'], 'Phase');
  boolean(value.paused, 'Paused');
  number(value.simulationTime, 'Simulation time');
  check([1, 1.5, 2].includes(value.speed as number), 'Speed is invalid.');
  number(value.gold, 'Gold');
  number(value.bankedGold, 'Banked gold');
  integer(value.wave, 'Wave', 0, sandbox ? Number.MAX_SAFE_INTEGER : 5);
  integer(value.enemiesKilled, 'Enemies killed');
  integer(value.enemiesSummoned, 'Enemies summoned');
  check(value.enemiesKilled <= value.enemiesSummoned, 'Kill count exceeds summoned count.');
  number(value.rewardGold, 'Reward gold');
  boolean(value.rewardsApplied, 'Rewards applied');
  choice(value.activeLevel, Object.keys(battlefields), 'Level');
  const profile = (value.defense as GameState['defense'])?.ruleset;
  const geometry = getMap(value.activeLevel as GameState['activeLevel'], profile);
  kinds(value.knownMonsters);
  towers(value.towers, geometry, false, geometry.perches.length, profile);
  if (value.selected !== null) integer(value.selected, 'Selected dragon', 0, value.towers.length - 1);
  if (value.chosen !== null) {
    dragon(value.chosen);
    check(
      challengeAllowsDragon(geometry, value.chosen as GameState['chosen'] & string),
      'Chosen dragon does not match this level challenge.',
    );
  }
  check(value.selected === null || value.towers[value.selected as number] !== null, 'Selected dragon must exist.');
  eggs(value.eggs, false, geometry, eggCount);
  array(value.enemies, 'Enemies');
  array(value.projectiles, 'Projectiles');
  array(value.spawnSchedule, 'Spawn schedule');
  integer(value.nextEntityId, 'Next entity id', eggCount + 1);

  const ids = new Set<number>(value.eggs.map((item) => item.id as number));
  const enemies = new Map<number, RecordValue>();
  const claimId = (id: unknown) => {
    integer(id, 'Entity id', 1);
    check(!ids.has(id), 'Entity ids must be unique.');
    check(id < (value.nextEntityId as number), 'Next entity id must exceed existing entity ids.');
    ids.add(id);
    return id;
  };
  for (const enemy of value.enemies) {
    object(enemy, 'Enemy');
    const id = claimId(enemy.id);
    monster(enemy.kind);
    number(enemy.hp, 'Enemy health', Number.MIN_VALUE);
    number(enemy.max, 'Enemy maximum health', Number.MIN_VALUE);
    check(enemy.hp <= enemy.max, 'Enemy health exceeds maximum.');
    number(enemy.spd, 'Enemy speed', Number.MIN_VALUE);
    progress(enemy.progress, geometry, route(enemy, geometry));
    number(enemy.slow, 'Slow timer');
    number(enemy.poison, 'Poison timer');
    number(enemy.poisonD, 'Poison damage timer');
    if (own(enemy, 'poisonDamageMultiplier')) number(enemy.poisonDamageMultiplier, 'Poison damage multiplier', 1, 10);
    if (enemy.carryingEgg !== null) integer(enemy.carryingEgg, 'Carried egg id', 1, eggCount);
    boolean(enemy.returning, 'Returning');
    boolean(enemy.escaped, 'Escaped');
    boolean(enemy.rewarded, 'Rewarded');
    check(!enemy.escaped && !enemy.rewarded, 'Active enemies cannot be escaped or already rewarded.');
    enemies.set(id, enemy);
  }
  for (const projectile of value.projectiles) {
    object(projectile, 'Projectile');
    claimId(projectile.id);
    number(projectile.x, 'Projectile x', -Number.MAX_SAFE_INTEGER);
    number(projectile.y, 'Projectile y', -Number.MAX_SAFE_INTEGER);
    integer(projectile.targetId, 'Projectile target', 1);
    check(enemies.has(projectile.targetId), 'Projectile target does not exist.');
    dragon(projectile.dragon);
    number(projectile.damage, 'Projectile damage');
    number(projectile.speed, 'Projectile speed', Number.MIN_VALUE);
    integer(projectile.level, 'Projectile level', 1);
    if (own(projectile, 'damageMultiplier')) number(projectile.damageMultiplier, 'Projectile damage multiplier', 1);
  }
  let previousSpawnTime = 0;
  for (const item of value.spawnSchedule) {
    object(item, 'Spawn');
    monster(item.kind);
    number(item.hp, 'Spawn health', Number.MIN_VALUE);
    number(item.spd, 'Spawn speed', Number.MIN_VALUE);
    number(item.at, 'Spawn time');
    route(item, geometry);
    check(item.at >= previousSpawnTime, 'Spawn schedule must be ordered by time.');
    previousSpawnTime = item.at;
  }
  for (const item of value.eggs) {
    if (item.status === 'carried') {
      const carrier = enemies.get(item.carrier as number);
      check(
        carrier &&
          carrier.carryingEgg === item.id &&
          carrier.returning &&
          !carrier.escaped &&
          (carrier.hp as number) > 0,
        'Egg carrier reference is inconsistent.',
      );
      check((carrier.routeId ?? 0) === (item.routeId ?? 0), 'Egg carrier route is inconsistent.');
    }
  }
  for (const enemy of enemies.values()) {
    if (enemy.carryingEgg !== null) {
      check(
        value.eggs.some(
          (item) => item.id === enemy.carryingEgg && item.status === 'carried' && item.carrier === enemy.id,
        ),
        'Enemy carried egg reference is inconsistent.',
      );
    }
  }
  check(value.enemies.length <= value.enemiesSummoned, 'Live enemy count exceeds summoned count.');
  const remaining = value.eggs.filter((item) => item.status !== 'escaped').length;
  const terminal = value.phase === 'won' || value.phase === 'lost';
  check(value.rewardsApplied === terminal, 'Reward state does not match phase.');
  if (terminal) {
    check(
      value.enemies.length === 0 && value.projectiles.length === 0 && value.spawnSchedule.length === 0,
      'A finished run cannot contain active combat.',
    );
    check(
      value.phase === 'won' ? value.wave === 5 && remaining > 0 : remaining === 0,
      'Terminal phase does not match wave or eggs.',
    );
  } else {
    check(sandbox || value.wave < 5 || value.phase === 'battle', 'A completed fifth wave must be terminal.');
    check(remaining > 0, 'An active run must have eggs remaining.');
    check(value.rewardGold === 0, 'An active run cannot have a terminal reward.');
    if (value.phase === 'ready')
      check(
        value.enemies.length === 0 && value.projectiles.length === 0 && value.spawnSchedule.length === 0,
        'A ready checkpoint cannot contain active combat.',
      );
    else check(value.wave > 0, 'Battle requires a started wave.');
  }
  validateDefenseEntities(value as unknown as GameState);
}

export function validateSave(value: unknown): asserts value is SaveDataV2 {
  object(value, 'Save');
  check(value.version === 2, 'Unsupported save version.');
  integer(value.savedAt, 'Save timestamp');
  validateState(value.state);
  if (own(value, 'journey')) {
    object(value.journey, 'Journey');
    boolean(value.journey.activeBattle, 'Active battle');
    array(value.journey.completedLevels, 'Completed levels');
    for (const level of value.journey.completedLevels) choice(level, Object.keys(battlefields), 'Completed level');
    check(
      new Set(value.journey.completedLevels).size === value.journey.completedLevels.length,
      'Completed levels must be unique.',
    );
    const terminal = value.state.phase === 'won' || value.state.phase === 'lost';
    check(!terminal || value.journey.activeBattle === false, 'Finished battles cannot remain active.');
    if (value.state.phase === 'won')
      check(
        value.journey.completedLevels.includes(value.state.activeLevel),
        'Won level must be recorded in the journey.',
      );
    if (!terminal && !value.journey.activeBattle) {
      check(
        value.state.phase === 'ready' &&
          value.state.wave === 0 &&
          value.state.towers.every((t) => t === null) &&
          value.state.eggs.every((egg) => egg.status === 'nest'),
        'An inactive journey cannot contain an unfinished battle.',
      );
    }
  }
}
