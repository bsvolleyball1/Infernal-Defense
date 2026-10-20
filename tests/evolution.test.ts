import { describe, expect, it } from 'vitest';
import { dragonForms, formsForColors, colorForDragon, dragonTypeForColor } from '../src/content/dragon-forms';
import { battlefields, getMap, challengeAllowsDragon } from '../src/content/maps';
import { towerGridCellAt } from '../src/content/tower-grid';
import { nodeIndex } from '../src/content/upgrades';
import { createDefenseState, nextBattle, rankTotal } from '../src/game/defense-state';
import { GameEngine, createInitialState } from '../src/game/engine';
import { createEnemy } from '../src/game/enemy-factory';
import { createEvolutionTower } from '../src/game/evolution';
import { canPlaceTower, isClearTowerPosition } from '../src/game/geometry';
import { tickDefenseTowers, tickDefenseProjectiles } from '../src/game/defense-combat';
import { applyDamage } from '../src/game/damage';
import { tickEnemyAbilities } from '../src/game/enemy-abilities';
import { towerBonus } from '../src/game/tower-bonuses';
import { SaveRepository } from '../src/services/storage';
import { presentBattle, presentPlacement } from '../src/ui/battle-view-model';
import { presentEvolutionChoices } from '../src/ui/evolution-view-model';
import type { DefenseBattle, DragonColor, DragonForm, Level } from '../src/game/types';

// Expected color paths are the intended gameplay catalog, independent of the resolver.
const paths: [DragonColor[], DragonForm[]][] = [
  [['red'], ['red']],
  [['blue'], ['blue']],
  [['yellow'], ['yellow']],
  [['red', 'red'], ['red2']],
  [['red', 'blue'], ['purple']],
  [['red', 'yellow'], ['orange']],
  [['blue', 'blue'], ['blue2']],
  [['blue', 'yellow'], ['green']],
  [['yellow', 'yellow'], ['yellow2']],
  [['red', 'red', 'red'], ['red3']],
  [
    ['red', 'red', 'blue'],
    ['bloodRed', 'purple2'],
  ],
  [
    ['red', 'red', 'yellow'],
    ['pink', 'orange2'],
  ],
  [['blue', 'blue', 'blue'], ['blue3']],
  [
    ['blue', 'blue', 'red'],
    ['black', 'purple2'],
  ],
  [
    ['blue', 'blue', 'yellow'],
    ['gray', 'green2'],
  ],
  [['yellow', 'yellow', 'yellow'], ['yellow3']],
  [
    ['red', 'yellow', 'yellow'],
    ['sun', 'orange2'],
  ],
  [
    ['blue', 'yellow', 'yellow'],
    ['turquoise', 'green2'],
  ],
  [['red', 'blue', 'yellow'], ['white']],
];
const forms = [...new Set(paths.flatMap(([, values]) => values))];
function permutations<T>(items: T[]): T[][] {
  return items.length <= 1
    ? [items]
    : items.flatMap((item, i) => permutations(items.filter((_, j) => j !== i)).map((rest) => [item, ...rest]));
}
function storage() {
  const values = new Map<string, string>();
  const repo = new SaveRepository({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  });
  return { repo, values };
}
function fresh(level: Level = 'level1', sandbox = false) {
  return createDefenseState(level, undefined, sandbox, 'defense-2');
}
function battle(form: DragonForm = 'red'): DefenseBattle {
  const state = fresh();
  const colors = paths.find(([, names]) => names.includes(form))![0];
  const tower = createEvolutionTower(dragonTypeForColor[colors[0]], { x: 75, y: 225 });
  tower.evolution = { colors: [...colors], form };
  tower.level = colors.length;
  state.towers[0] = tower;
  state.selected = 0;
  state.phase = 'battle';
  state.wave = 1;
  state.enemies = [1, 1.03, 1.06].map((progress) => createEnemy(state, 'demon', 10000, 0.01, progress));
  state.enemiesSummoned = state.enemies.length;
  return state;
}

describe('evolution catalog and transactions', () => {
  it('contains exactly the 22 intended forms', () => {
    expect(forms).toHaveLength(22);
    expect(Object.keys(dragonForms).sort()).toEqual([...forms].sort());
  });
  it.each(paths.filter(([colors]) => colors.length > 1))('resolves every ordering of %j', (colors, expected) => {
    for (const order of permutations(colors)) expect(formsForColors(order)).toEqual(expected);
  });
  it.each(paths.filter(([colors]) => colors.length > 1))('purchases the legal paths for %j', (colors, expected) => {
    for (const form of expected) {
      const engine = new GameEngine(fresh('level1', true));
      engine.dispatch({ type: 'choose', dragon: dragonTypeForColor[colors[0]] });
      engine.dispatch({ type: 'place', point: { x: 75, y: 225 } });
      const second = formsForColors(colors.slice(0, 2))[0];
      engine.dispatch({ type: 'evolve', color: colors[1], form: second });
      if (colors.length === 3) engine.dispatch({ type: 'evolve', color: colors[2], form });
      expect(engine.state.towers[0]).toMatchObject({
        level: colors.length,
        evolution: { colors: [...colors].sort(), form },
      });
      expect(engine.state.gold).toBe(120);
    }
  });
  it('invalid or unaffordable choices change neither currency nor state', () => {
    const engine = new GameEngine(battle('red'));
    const before = engine.snapshot();
    expect(engine.dispatch({ type: 'evolve', color: 'blue', form: 'white' })).toEqual([]);
    expect(engine.state).toEqual(before);
    engine.state.gold = 0;
    expect(engine.dispatch({ type: 'evolve', color: 'blue', form: 'purple' })).toEqual([]);
    expect(engine.state.towers[0]?.level).toBe(1);
    expect(engine.dispatch({ type: 'upgrade' })).toEqual([]);
  });
  it('preserves historical upgrade commands and changes rules only at a new battle', () => {
    const old = createDefenseState();
    old.towers[0] = { type: 'fire', level: 5, cooldown: 123, position: { x: 90, y: 202 } };
    old.defense.ranks.fire[1] = 3;
    old.gold = 500;
    old.bankedGold = 123;
    const engine = new GameEngine(old);
    engine.state.selected = 0;
    engine.dispatch({ type: 'upgrade' });
    expect(engine.state.towers[0]?.level).toBe(6);
    const next = nextBattle(engine.state, 'meadow');
    expect(next.defense.ruleset).toBe('defense-2');
    expect(next.bankedGold).toBe(123);
    expect(next.defense.ranks).toEqual(old.defense.ranks);
    expect(next.towers.every((tower) => tower === null)).toBe(true);
    const { repo } = storage();
    expect(repo.saveSlot(0, engine.state)).toEqual({ ok: true });
    const read = repo.readSlot(0);
    expect(read.status === 'valid' && read.data.state).toEqual(engine.state);
  });
  it('retains old max-level passive bonuses while preventing new purchases', () => {
    const state = fresh();
    state.bankedGold = 500;
    state.defense.ranks.fire[nodeIndex('fire', 'maxLevel')] = 3;
    expect(rankTotal(state, 'fire')).toBe(3);
    const engine = new GameEngine(state),
      before = engine.snapshot();
    expect(engine.dispatch({ type: 'buyPermanent', dragon: 'fire', node: nodeIndex('fire', 'maxLevel') })).toEqual([]);
    expect(engine.state).toEqual(before);
  });
});

describe('grid placement and historical geometry', () => {
  it.each(Object.keys(battlefields) as Level[])('saves every allowed cell and all bonuses on %s', (level) => {
    const engine = new GameEngine(fresh(level, true)),
      map = getMap(level, 'defense-2');
    const type = (['fire', 'ice', 'poison'] as const).find((value) => challengeAllowsDragon(map, value))!;
    for (let y = 25; y < map.height; y += 50)
      for (let x = 25; x < map.width; x += 50) {
        const point = { x, y };
        if (!canPlaceTower(engine.state, point)) continue;
        engine.dispatch({ type: 'choose', dragon: type });
        engine.dispatch({ type: 'place', point: { x: x + 3, y: y + 2 } });
        expect(engine.state.towers[engine.state.selected!]?.position).toEqual(point);
        expect(canPlaceTower(engine.state, point)).toBe(false);
      }
    expect(engine.state.towers.filter(Boolean).length).toBeGreaterThan(30);
    for (const area of map.bonusAreas) {
      const index = engine.state.towers.findIndex(
        (tower) => tower?.position?.x === area.x && tower.position.y === area.y,
      );
      expect(index, `${level} ${area.kind}`).toBeGreaterThanOrEqual(0);
      expect(towerBonus(engine.state, index)?.kind).toBe(area.kind);
    }
    const { repo } = storage();
    expect(repo.saveSlot(0, engine.state)).toEqual({ ok: true });
    expect(repo.readSlot(0).status).toBe('valid');
  });
  it('accepts new cell centers near roads while retaining old position validation', () => {
    const point = { x: 125, y: 225 };
    expect(isClearTowerPosition(point, getMap('level1'))).toBe(false);
    const engine = new GameEngine(fresh());
    engine.dispatch({ type: 'choose', dragon: 'ice' });
    engine.dispatch({ type: 'place', point });
    expect(engine.state.towers[0]?.position).toEqual(point);
    expect(storage().repo.saveSlot(0, engine.state)).toEqual({ ok: true });
    expect(getMap('level1').bonusAreas[0]).toMatchObject({ x: 240, y: 245 });
    expect(getMap('level1', 'defense-2').bonusAreas[0]).toMatchObject({ x: 225, y: 25 });
  });
  it('rejects partial rows, non-finite points, blocked roads and perch bypasses', () => {
    const engine = new GameEngine(fresh());
    engine.dispatch({ type: 'choose', dragon: 'fire' });
    for (const point of [
      { x: 25, y: 415 },
      { x: NaN, y: 25 },
      { x: 25, y: Infinity },
      { x: 350, y: 315 },
      { x: -1, y: 25 },
    ]) {
      engine.dispatch({ type: 'place', point });
      expect(engine.state.towers.every((tower) => tower === null)).toBe(true);
    }
    expect(towerGridCellAt(getMap('level1'), { x: NaN, y: 0 })).toBeNull();
    expect(engine.dispatch({ type: 'perch', index: 0 })).toEqual([]);
    expect(engine.state.gold).toBe(120);
  });
  it('uses exactly the same snapped preview and placement', () => {
    const state = fresh();
    state.chosen = 'fire';
    expect(presentPlacement(state, { x: 73, y: 222 })).toMatchObject({ x: 75, y: 225, valid: true });
  });
  it('rejects overlapping grid towers in saves', () => {
    const state = fresh();
    state.towers[0] = createEvolutionTower('fire', { x: 75, y: 225 });
    state.towers[1] = createEvolutionTower('ice', { x: 75, y: 225 });
    expect(storage().repo.saveSlot(0, state).ok).toBe(false);
  });
});

describe('evolved combat and exact persistence', () => {
  it.each(forms)('%s attacks using its form and survives exact resume', (form) => {
    const state = battle(form);
    tickDefenseTowers(state, 100, []);
    tickDefenseProjectiles(state, 10000, []);
    expect(state.enemies.some((enemy) => enemy.hp < enemy.max)).toBe(true);
    const engine = new GameEngine(battle(form));
    for (let i = 0; i < 17; i++) engine.step(1000 / 60);
    const { repo } = storage();
    expect(repo.saveSlot(0, engine.snapshot())).toEqual({ ok: true });
    const read = repo.readSlot(0);
    if (read.status !== 'valid') throw Error(JSON.stringify(read));
    const restored = new GameEngine(read.data.state);
    for (let i = 0; i < 90; i++) {
      engine.step(1000 / 60);
      restored.step(1000 / 60);
    }
    expect(restored.snapshot()).toEqual(engine.snapshot());
  });
  it('snapshots do not share evolution, beam, effect or retarget collections', () => {
    const engine = new GameEngine(battle('blue'));
    tickDefenseTowers(engine.state as DefenseBattle, 16, []);
    const copy = engine.snapshot();
    copy.towers[0]!.evolution!.colors[0] = 'red';
    copy.projectiles[0].retarget!.origin.x = 600;
    copy.projectiles[0].effect = { kind: 'freeze', chance: 1 };
    expect(engine.state.towers[0]!.evolution!.colors).toEqual(['blue']);
    expect(engine.state.projectiles[0].retarget!.origin.x).toBe(75);
    expect(engine.state.projectiles[0].effect).toEqual({ kind: 'none' });
  });
  it('preserves unused charges and applies the extra-charge rank', () => {
    const state = battle('blue2');
    state.enemies = state.enemies.slice(0, 1);
    state.defense.ranks.ice[nodeIndex('ice', 'moreCharges')] = 2;
    tickDefenseTowers(state, 16, []);
    expect(state.projectiles).toHaveLength(1);
    expect(state.towers[0]!.charges).toBe(3);
    state.enemies = [];
    tickDefenseTowers(state, 1000, []);
    expect(state.towers[0]!.charges).toBe(4);
  });
  it('keeps partial recharge timers saveable at floating-point boundaries', () => {
    const state = battle('blue3');
    state.towers[0]!.charges = 0;
    state.towers[0]!.chargeTimer = 1000 / 60 + 1e-10;
    tickDefenseTowers(state, 1000 / 60, []);
    expect(state.towers[0]!.chargeTimer).toBe(1000);
    expect(storage().repo.saveSlot(0, state)).toEqual({ ok: true });
  });
  it('captures acid damage and retarget range before ranks or towers change', () => {
    const state = battle('green');
    tickDefenseTowers(state, 16, []);
    const payload = state.projectiles[0].effect;
    expect(payload?.kind).toBe('poison');
    state.defense.ranks.ice[5] = 100;
    state.towers[0] = null;
    tickDefenseProjectiles(state, 10000, []);
    const target = state.enemies.find((enemy) => enemy.poison > 0)!;
    expect(payload?.kind === 'poison' && target.poisonDamage).toBe(payload?.kind === 'poison' && payload.tickDamage);
  });
  it('expires nullification and restores resistance', () => {
    const state = battle('pink'),
      enemy = state.enemies[0];
    enemy.kind = 'skeleton';
    enemy.nullified = 500;
    applyDamage(state, enemy, 10, 'fire', []);
    expect(enemy.hp).toBe(9990);
    tickEnemyAbilities(state, enemy, 500, []);
    expect(enemy.nullified).toBe(0);
    applyDamage(state, enemy, 10, 'fire', []);
    expect(enemy.hp).toBe(9985);
  });
  it.each(['untargetable', 'invulnerable', 'deathDelay'] as const)('area attacks respect %s', (status) => {
    for (const form of ['orange', 'black', 'gray', 'pink', 'white'] as const) {
      const state = battle(form),
        protectedEnemy = state.enemies[0];
      protectedEnemy[status] = 1000;
      tickDefenseTowers(state, 16, []);
      expect(protectedEnemy.hp).toBe(protectedEnemy.max);
      expect(protectedEnemy.slow).toBe(0);
      expect(protectedEnemy.frozen).toBe(0);
      expect(protectedEnemy.nullified).toBeUndefined();
    }
  });
  it('area distance uses actual fork positions instead of equal progress', () => {
    const state = battle('black');
    state.activeLevel = 'volcanic';
    state.towers[0]!.position = { x: 275, y: 175 };
    state.enemies = [0, 1].map((route) => createEnemy(state, 'demon', 100, 0.01, 4, route));
    tickDefenseTowers(state, 16, []);
    expect(state.enemies[0].hp).toBeLessThan(100);
    expect(state.enemies[1].hp).toBe(100);
  });
  it('area deaths award each reward once', () => {
    const state = battle('orange');
    for (const enemy of state.enemies) {
      enemy.kind = 'imp';
      enemy.hp = 1;
      enemy.max = 1;
    }
    tickDefenseTowers(state, 16, []);
    tickDefenseTowers(state, 2000, []);
    expect(state.enemiesKilled).toBe(3);
  });
  it.each([1, 1.5, 2] as const)('effects use simulation time and pause at speed %s', (speed) => {
    const state = battle('red');
    state.speed = speed;
    state.enemies[0].nullified = 2000;
    const engine = new GameEngine(state);
    engine.step(100);
    expect(engine.state.enemies[0].nullified).toBe(2000 - speed * 100);
    engine.dispatch({ type: 'pause' });
    const before = engine.snapshot();
    engine.step(100);
    expect(engine.state).toEqual(before);
  });
});

describe('challenges and save validation', () => {
  it.each(['fireTrial', 'iceTrial', 'poisonTrial', 'noPoisonTrial', 'noIceTrial', 'noFireTrial'] as Level[])(
    '%s shares placement, evolution, HUD and save restrictions',
    (level) => {
      const state = fresh(level, true),
        map = getMap(level);
      const allowed = (['fire', 'ice', 'poison'] as const).filter((type) => challengeAllowsDragon(map, type));
      expect(
        presentBattle(state, false)
          .placement.filter((button) => !button.hidden)
          .map((button) => button.type),
      ).toEqual(allowed);
      const engine = new GameEngine(state);
      engine.dispatch({ type: 'choose', dragon: allowed[0] });
      engine.dispatch({ type: 'place', point: { x: 25, y: 25 } });
      const choices = presentEvolutionChoices(engine.state);
      expect(choices.map((choice) => choice.color).sort()).toEqual(allowed.map((type) => colorForDragon[type]).sort());
      expect(storage().repo.saveSlot(0, engine.state).ok).toBe(true);
      const forbidden = (['fire', 'ice', 'poison'] as const).find((type) => !allowed.includes(type))!;
      engine.state.chosen = forbidden;
      expect(storage().repo.saveSlot(0, engine.state).ok).toBe(false);
      engine.state.chosen = null;
      expect(engine.dispatch({ type: 'evolve', color: colorForDragon[forbidden], form: 'white' })).toEqual([]);
    },
  );
  it('imports complete source-branch evolution saves without moving towers', () => {
    const original = battle('purple'),
      raw = JSON.parse(JSON.stringify(original));
    raw.defense.ruleset = 'defense-1';
    for (const tower of raw.towers)
      if (tower) {
        Object.assign(tower, tower.evolution);
        delete tower.evolution;
      }
    const { repo, values } = storage(),
      serialized = JSON.stringify({ version: 2, savedAt: 1, state: raw });
    values.set('infernalDefense.save.0', serialized);
    const result = repo.readSlot(0);
    expect(result.status === 'valid' && result.migrated).toBe(true);
    expect(result.status === 'valid' && result.data.state).toEqual(original);
    expect(values.get('infernalDefense.save.0')).toBe(serialized);
  });
  it.each(['unknown-profile', 'bad-form', 'bad-colors', 'bad-tier', 'bad-payload'] as const)(
    'preserves unreadable %s saves',
    (fault) => {
      const state = JSON.parse(JSON.stringify(battle('green')));
      if (fault === 'unknown-profile') state.defense.ruleset = 'future-rules';
      if (fault === 'bad-form') state.towers[0].evolution.form = 'white';
      if (fault === 'bad-colors') state.towers[0].evolution.colors = ['purple', 'blue'];
      if (fault === 'bad-tier') state.towers[0].level = 4;
      if (fault === 'bad-payload') {
        tickDefenseTowers(state, 16, []);
        state.projectiles[0].effect.tickDamage = -1;
      }
      const { repo, values } = storage();
      const raw = JSON.stringify({ version: 2, savedAt: 1, state });
      values.set('infernalDefense.save.0', raw);
      expect(repo.readSlot(0).status).toBe('error');
      expect(values.get('infernalDefense.save.0')).toBe(raw);
    },
  );
  it('does not reinterpret an empty historical snapshot as evolution', () => {
    const { repo } = storage();
    const state = createInitialState();
    expect(repo.saveSlot(0, state)).toEqual({ ok: true });
    const read = repo.readSlot(0);
    expect(read.status === 'valid' && read.data.state).toEqual(state);
  });
});
