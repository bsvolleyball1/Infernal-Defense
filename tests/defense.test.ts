import { describe, it, expect } from 'vitest';
import { GameEngine, createInitialState } from '../src/game/engine';
import { createDefenseState, nextBattle } from '../src/game/defense-state';
import { playableMonsters, movementSpeed } from '../src/content/enemies';
import { createEnemy } from '../src/game/enemy-factory';
import { applyDamage } from '../src/game/damage';
import { tickEnemyAbilities } from '../src/game/enemy-abilities';
import { tickDefenseTowers, tickDefenseProjectiles, defenseRange } from '../src/game/defense-combat';
import { castSpell, tickSpells } from '../src/game/spells';
import { moveEnemy, dropEgg } from '../src/game/eggs';
import { entityPosition } from '../src/game/geometry';
import { finishBattle } from '../src/game/rewards';
import { upgradedEggCount } from '../src/content/defense-rules';
import { SaveRepository } from '../src/services/storage';
import { createJourney, recordJourneyResult } from '../src/game/journey';
import type { GameState, MonsterKind } from '../src/game/types';

function battle(kind: MonsterKind = 'demon'): GameState {
  const state = createDefenseState();
  state.phase = 'battle';
  state.wave = 1;
  state.enemies = [createEnemy(state, kind, 100, 1, 3)];
  state.enemiesSummoned = 1;
  return state;
}
function storage() {
  const data = new Map<string, string>();
  return {
    data,
    repo: new SaveRepository({
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => {
        data.set(k, v);
      },
    }),
  };
}

describe('expanded lifecycle and boundary regressions', () => {
  it('starts with three eggs, caps actual capacity at six, and saves a fresh player', () => {
    expect([0, 1, 3, 10].map(upgradedEggCount)).toEqual([3, 4, 6, 6]);
    const state = createDefenseState(),
      { repo } = storage();
    expect(state.nextEntityId).toBe(4);
    expect(repo.saveSlot(0, state, createJourney())).toEqual({ ok: true });
    expect(repo.readSlot(0).status).toBe('valid');
  });
  it('placement grants five mana per rank and stores the initial ice charge', () => {
    const state = createDefenseState();
    state.defense!.ranks.fire[2] = 2;
    const engine = new GameEngine(state);
    engine.dispatch({ type: 'choose', dragon: 'ice' });
    engine.dispatch({ type: 'perch', index: 0 });
    expect(engine.state.defense!.mana).toBe(10);
    expect(engine.state.towers[0]).toMatchObject({ charges: 1, chargeTimer: 1000 });
  });
  it('continues passive upgrades after the effective egg and level caps', () => {
    const state = createDefenseState();
    state.bankedGold = 10000;
    state.defense!.ranks.poison[2] = 3;
    const engine = new GameEngine(state);
    engine.dispatch({ type: 'buyPermanent', dragon: 'poison', node: 2 });
    expect(engine.state.defense!.ranks.poison[2]).toBe(4);
    expect(nextBattle(engine.state, 'level1').eggs).toHaveLength(6);
  });
  it('pauses a wave countdown and grants the remaining early-wave mana', () => {
    const state = createDefenseState();
    state.wave = 1;
    state.defense!.countdown = 2500;
    const engine = new GameEngine(state);
    engine.dispatch({ type: 'pause' });
    const paused = engine.snapshot();
    engine.step(1000);
    expect(engine.snapshot()).toEqual(paused);
    engine.dispatch({ type: 'resume' });
    engine.dispatch({ type: 'startWave' });
    expect(engine.state.phase).toBe('battle');
    expect(engine.state.wave).toBe(2);
    expect(engine.state.defense!.mana).toBe(30);
    expect(engine.state.defense!.countdown).toBeNull();
  });
  it.each([1, 1.5, 2] as const)('scales countdown, spells, and regeneration together at %s', (speed) => {
    const state = createDefenseState();
    state.speed = speed;
    state.defense!.countdown = 5000;
    state.defense!.spellCooldowns.fire = 5000;
    const engine = new GameEngine(state);
    for (let i = 0; i < 300 / speed; i++) engine.step(1000 / 60);
    expect(engine.state.simulationTime).toBeCloseTo(5000);
    expect(engine.state.phase).toBe('battle');
    expect(engine.state.wave).toBe(1);
    expect(engine.state.defense!.mana).toBeCloseTo(25);
    expect(engine.state.defense!.spellCooldowns.fire).toBeCloseTo(0);
  });
  it('clears beam references when saving a won battle and never pays twice', () => {
    const state = battle();
    state.wave = 5;
    state.towers[0] = { type: 'fire', level: 1, cooldown: 0, beamIds: [state.enemies[0].id] };
    finishBattle(state, true, []);
    const { repo } = storage();
    expect(state.towers[0]?.beamIds).toEqual([]);
    expect(
      repo.saveSlot(0, state, recordJourneyResult({ ...createJourney(), activeBattle: true }, state)),
    ).toEqual({ ok: true });
    const read = repo.readSlot(0);
    expect(read.status).toBe('valid');
    if (read.status === 'valid') {
      const bank = read.data.state.bankedGold;
      const engine = new GameEngine(read.data.state);
      engine.step(1000);
      expect(engine.state.bankedGold).toBe(bank);
    }
  });
  it('escaping with all three eggs produces a durable defeat', () => {
    const state = createDefenseState();
    state.phase = 'battle';
    state.wave = 1;
    for (const egg of state.eggs) {
      const enemy = createEnemy(state, 'imp', 10, 1, 0.001);
      enemy.returning = true;
      enemy.carryingEgg = egg.id;
      egg.status = 'carried';
      egg.carrier = enemy.id;
      egg.direct = false;
      state.enemies.push(enemy);
    }
    state.enemiesSummoned = 3;
    const engine = new GameEngine(state);
    engine.step(1000 / 60);
    expect(engine.state.phase).toBe('lost');
    expect(engine.state.eggs.every((e) => e.status === 'escaped')).toBe(true);
    const { repo } = storage();
    expect(
      repo.saveSlot(
        0,
        engine.snapshot(),
        recordJourneyResult({ ...createJourney(), activeBattle: true }, engine.state),
      ),
    ).toEqual({ ok: true });
  });
  it('an unlimited sandbox wave completes without discovery, banked rewards or stolen eggs', () => {
    const engine = new GameEngine(createDefenseState('tutorial', undefined, true));
    engine.dispatch({ type: 'testWave', counts: { imp: 1 } });
    engine.dispatch({ type: 'startWave' });
    for (let i = 0; i < 2000 && engine.state.phase === 'battle'; i++) engine.step(1000 / 60);
    expect(engine.state.phase).toBe('ready');
    expect(engine.state.bankedGold).toBe(0);
    expect(engine.state.knownMonsters).toEqual([]);
    expect(engine.state.eggs.every((e) => e.status === 'nest')).toBe(true);
  });
  it('snapshot copies and preview commands do not share nested caller data', () => {
    const engine = new GameEngine(createDefenseState());
    engine.dispatch({ type: 'spellTarget', spell: 'fire' });
    const point = { x: 50, y: 50 };
    engine.dispatch({ type: 'previewSpell', point });
    point.x = 500;
    const copy = engine.snapshot();
    copy.defense!.ranks.fire[0] = 99;
    copy.defense!.preview!.y = 300;
    expect(engine.state.defense!.ranks.fire[0]).toBe(0);
    expect(engine.state.defense!.preview).toEqual({ x: 50, y: 50 });
  });
  it.each(['charges', 'beam', 'cooldown', 'impact', 'mana', 'rank'] as const)(
    'preserves unreadable %s state instead of replacing it',
    (field) => {
      const state = createDefenseState();
      state.towers[0] = { type: 'ice', level: 1, cooldown: 0 };
      if (field === 'charges') state.towers[0].charges = 100;
      if (field === 'beam') state.towers[0].beamIds = [999];
      if (field === 'cooldown') state.defense!.spellCooldowns.fire = -1;
      if (field === 'impact')
        state.defense!.impacts = [{ id: 999, x: 701, y: 0, remaining: 500, damage: 25 }];
      if (field === 'mana') state.defense!.mana = 201;
      if (field === 'rank') state.defense!.ranks.fire[0] = -1;
      const { data, repo } = storage(),
        raw = JSON.stringify({ version: 2, savedAt: 0, state });
      data.set('infernalDefense.save.0', raw);
      expect(repo.readSlot(0).status).toBe('error');
      expect(data.get('infernalDefense.save.0')).toBe(raw);
    },
  );
});
describe('expanded content and compatibility', () => {
  it('retains the legacy default and starts expanded journeys explicitly', () => {
    expect(createInitialState().defense).toBeUndefined();
    expect(createDefenseState().defense?.ruleset).toBe('defense-1');
    expect(playableMonsters).toHaveLength(17);
    expect(movementSpeed(5)).toBe(0.3125);
  });
  it('selects tutorial waves and revised campaign waves without changing maps', () => {
    const tutorial = new GameEngine(createDefenseState('tutorial'));
    tutorial.dispatch({ type: 'startWave' });
    expect(tutorial.state.spawnSchedule).toHaveLength(6);
    expect(tutorial.state.spawnSchedule.every((s) => s.kind === 'imp')).toBe(true);
    const normal = new GameEngine(createDefenseState('volcanic'));
    normal.dispatch({ type: 'startWave' });
    expect(normal.state.spawnSchedule.map((s) => s.routeId)).toEqual([0, 1, 0, 1, 0, 1, 0, 1, 0, 1]);
  });
  it('carries ranks, discoveries and banked gold between maps, not battle entities', () => {
    const s = battle();
    s.bankedGold = 112;
    s.knownMonsters = ['imp'];
    s.defense!.ranks.ice[0] = 2;
    s.defense!.ranks.poison[2] = 2;
    const next = nextBattle(s, 'meadow');
    expect(next.gold).toBe(170);
    expect(next.eggs).toHaveLength(5);
    expect(next.towers).toHaveLength(5);
    expect(next.bankedGold).toBe(112);
    expect(next.knownMonsters).toEqual(['imp']);
    expect(next.enemies).toEqual([]);
  });
});
describe('dragon strategies', () => {
  it.each([1, 2, 3, 4, 5, 6])('fire level %i has the specified target count and damage', (level) => {
    const s = battle();
    s.enemies = Array.from({ length: 4 }, () => createEnemy(s, 'demon', 100, 1, 3));
    s.enemiesSummoned = 4;
    // Perch 1 is close to path progress 3 in the gorge; find the closest path position.
    s.towers[0] = { type: 'fire', level, cooldown: 0 };
    for (const e of s.enemies) e.progress = 1;
    const before = s.enemies.map((e) => e.hp);
    tickDefenseTowers(s, 1000, []);
    const damaged = s.enemies.filter((e, i) => e.hp < before[i]);
    expect(damaged).toHaveLength(level >= 5 ? 4 : level >= 4 ? 3 : level >= 3 ? 2 : 1);
    expect(damaged[0].hp).toBe(100 - (level >= 6 ? 20 : level >= 2 ? 15 : 6));
  });
  it('ice spends all charges and restores one per simulation second', () => {
    const s = battle();
    s.enemies[0].progress = 1;
    s.towers[0] = { type: 'ice', level: 3, cooldown: 0 };
    tickDefenseTowers(s, 16, []);
    expect(s.projectiles).toHaveLength(3);
    expect(s.towers[0]?.charges).toBe(0);
    tickDefenseTowers(s, 500, []);
    expect(s.projectiles).toHaveLength(3);
    tickDefenseTowers(s, 500, []);
    expect(s.projectiles).toHaveLength(4);
  });
  it('poison fires four shots per second and captures its effect payload', () => {
    const s = battle();
    s.enemies[0].progress = 1;
    s.towers[0] = { type: 'poison', level: 4, cooldown: 0 };
    for (let i = 0; i < 4; i++) tickDefenseTowers(s, 250, []);
    expect(s.projectiles).toHaveLength(4);
    expect(s.projectiles[0]).toMatchObject({ damage: 4, poisonDuration: 5000, slowDuration: 1000 });
  });
  it('poison has five inclusive one-second ticks after the last hit', () => {
    const s = battle(),
      e = s.enemies[0];
    e.poison = 5000;
    e.poisonD = 1000;
    e.poisonDamage = 1;
    e.poisonSource = 'poison';
    for (let i = 0; i < 300; i++) tickEnemyAbilities(s, e, 1000 / 60, []);
    expect(e.hp).toBe(95);
  });
  it('ice retargets a surviving enemy without changing the shot payload', () => {
    const s = battle();
    s.enemies[0].progress = 1;
    s.towers[0] = { type: 'ice', level: 4, cooldown: 0 };
    tickDefenseTowers(s, 16, []);
    const payload = s.projectiles[0].damage;
    s.enemies[0].hp = 0;
    const second = createEnemy(s, 'demon', 100, 1, 1);
    s.enemies.push(second);
    s.enemiesSummoned++;
    tickDefenseProjectiles(s, 1, []);
    expect(s.projectiles[0].targetId).toBe(second.id);
    expect(s.projectiles[0].damage).toBe(payload);
  });
});
describe('enemy abilities and eggs', () => {
  it.each([
    ['hellhound', 'fire', 2.5],
    ['fury', 'poison', 2.5],
    ['devil', 'ice', 2.5],
    ['skeleton', 'fire', 5],
  ] as const)('%s resists %s', (kind, source, damage) => {
    const s = battle(kind);
    applyDamage(s, s.enemies[0], 10, source, []);
    expect(s.enemies[0].hp).toBe(100 - damage);
  });
  it('witch ignores spells but not dragons', () => {
    const s = battle('witch');
    applyDamage(s, s.enemies[0], 10, 'spell', []);
    expect(s.enemies[0].hp).toBe(100);
    applyDamage(s, s.enemies[0], 10, 'fire', []);
    expect(s.enemies[0].hp).toBe(90);
  });
  it('ghost is untargetable once after a nonlethal dragon hit', () => {
    const s = battle('ghost'),
      e = s.enemies[0];
    applyDamage(s, e, 1, 'fire', []);
    expect(e.untargetable).toBe(3000);
    tickEnemyAbilities(s, e, 3000, []);
    applyDamage(s, e, 1, 'fire', []);
    expect(e.untargetable).toBe(0);
  });
  it('gargoyle delays its death and rewards exactly once', () => {
    const s = battle('gargoyle'),
      e = s.enemies[0];
    applyDamage(s, e, 200, 'fire', []);
    expect(e.deathDelay).toBe(2000);
    expect(s.enemiesKilled).toBe(0);
    applyDamage(s, e, 200, 'fire', []);
    tickEnemyAbilities(s, e, 2000, []);
    expect(s.enemiesKilled).toBe(1);
    applyDamage(s, e, 200, 'fire', []);
    expect(s.enemiesKilled).toBe(1);
  });
  it('phantom invulnerability expires using simulation time', () => {
    const s = battle();
    s.enemies[0] = createEnemy(s, 'phantom', 80, 1, 0);
    const e = s.enemies[0];
    applyDamage(s, e, 10, 'fire', []);
    expect(e.hp).toBe(80);
    tickEnemyAbilities(s, e, 3000, []);
    applyDamage(s, e, 10, 'fire', []);
    expect(e.hp).toBe(70);
  });
  it('hag heals nearby allies, troll heals only after its quiet interval', () => {
    const s = battle('hag'),
      e = s.enemies[0],
      other = createEnemy(s, 'troll', 100, 1, 3);
    other.hp = 50;
    s.enemies.push(other);
    tickEnemyAbilities(s, e, 1000, []);
    expect(other.hp).toBe(53);
    tickEnemyAbilities(s, other, 1000, []);
    expect(other.hp).toBe(57);
    applyDamage(s, other, 1, 'fire', []);
    tickEnemyAbilities(s, other, 500, []);
    expect(other.hp).toBe(56);
  });
  it('necromancer pauses then summons a discovered monster', () => {
    const s = battle('necromancer'),
      e = s.enemies[0];
    s.knownMonsters = ['imp'];
    expect(tickEnemyAbilities(s, e, 5000, [])).toBe(false);
    expect(e.summonPause).toBe(1000);
    tickEnemyAbilities(s, e, 1000, []);
    expect(s.enemies[1].kind).toBe('imp');
    expect(s.enemiesSummoned).toBe(2);
  });
  it('zombie train releases 5–10 valid children on death', () => {
    const s = battle('zombieTrain');
    applyDamage(s, s.enemies[0], 200, 'fire', []);
    expect(s.enemies.length - 1).toBeGreaterThanOrEqual(5);
    expect(s.enemies.length - 1).toBeLessThanOrEqual(10);
    expect(s.enemies.slice(1).every((e) => ['imp', 'demon', 'seaSerpent'].includes(e.kind))).toBe(true);
  });
  it('lich pickup, death, dropped egg and recovery retain stable IDs', () => {
    const s = battle('lich'),
      e = s.enemies[0];
    e.progress = 15.99;
    moveEnemy(s, e, 100);
    expect(e.max).toBe(200);
    expect(e.empowered).toBe(true);
    const egg = s.eggs[0];
    dropEgg(s, e);
    expect(egg.status).toBe('dropped');
    const imp = createEnemy(s, 'imp', 10, 1, 15.9);
    s.enemies.push(imp);
    moveEnemy(s, imp, 100);
    expect(egg.carrier).toBe(imp.id);
  });
  it('shade uses a straight route and test mode reverses without stealing eggs', () => {
    const s = battle('shade'),
      e = s.enemies[0];
    expect(entityPosition(s, e)).not.toEqual(entityPosition({ ...s, defense: undefined }, e));
    const test = createDefenseState('tutorial', undefined, true),
      imp = createEnemy(test, 'imp', 10, 1, 16);
    test.enemies.push(imp);
    moveEnemy(test, imp, 1);
    expect(imp.returning).toBe(true);
    expect(test.eggs.every((e) => e.status === 'nest')).toBe(true);
  });
  it('an upgraded dropped egg returns on a simulation timer', () => {
    const s = battle();
    s.defense!.ranks.fire[4] = 1;
    s.enemies[0].progress = 16;
    moveEnemy(s, s.enemies[0], 1);
    dropEgg(s, s.enemies[0]);
    expect(s.eggs[0].returnTimer).toBe(25000);
    tickSpells(s, 25000, []);
    expect(s.eggs[0]).toMatchObject({ status: 'nest', progress: null, carrier: null });
  });
});
describe('spells, upgrades, sandbox and exact persistence', () => {
  it.each(['fire', 'ice', 'poison'] as const)('%s spends mana and sets a saved cooldown', (spell) => {
    const s = battle();
    s.defense!.mana = 200;
    const [x, y] = entityPosition(s, s.enemies[0]);
    castSpell(s, spell, { x, y });
    expect(s.defense!.mana).toBe(50);
    expect(s.defense!.spellCooldowns[spell]).toBe(5000);
    expect(castSpell(s, spell, { x, y })).toEqual([]);
  });
  it('Fire Rain lands after 500 simulation ms and never damages a witch', () => {
    const s = battle('witch');
    s.defense!.mana = 200;
    const [x, y] = entityPosition(s, s.enemies[0]);
    castSpell(s, 'fire', { x, y });
    tickSpells(s, 500, []);
    expect(s.enemies[0].hp).toBe(100);
    expect(s.defense!.impacts).toEqual([]);
  });
  it('permanent purchases deduct exact gold, cap levels and add range', () => {
    const s = createDefenseState();
    s.bankedGold = 1000;
    const engine = new GameEngine(s);
    engine.dispatch({ type: 'buyPermanent', dragon: 'ice', node: 1 });
    expect(engine.state.bankedGold).toBe(970);
    expect(engine.state.defense!.ranks.ice[1]).toBe(1);
    expect(defenseRange(engine.state, { type: 'ice', level: 1, cooldown: 0 })).toBeCloseTo(151 * 1.01);
  });
  it('sandbox resources stay finite in data and are unlimited by policy', () => {
    const s = createDefenseState('tutorial', undefined, true);
    s.gold = 0;
    const engine = new GameEngine(s);
    engine.dispatch({ type: 'choose', dragon: 'ice' });
    engine.dispatch({ type: 'perch', index: 0 });
    for (let i = 0; i < 8; i++) engine.dispatch({ type: 'upgrade' });
    expect(engine.state.towers[0]?.level).toBe(6);
    expect(engine.state.gold).toBe(0);
    engine.dispatch({ type: 'testWave', counts: { imp: 2, demon: 1 } });
    engine.dispatch({ type: 'startWave' });
    expect(engine.state.spawnSchedule).toHaveLength(3);
    expect(JSON.stringify(engine.snapshot())).not.toContain('null,"maxMana"');
  });
  it.each([1, 1.5, 2] as const)(
    'snapshot and restore produce identical continuation at speed %s',
    (speed) => {
      const s = battle('lich');
      s.speed = speed;
      s.defense!.mana = 200;
      s.defense!.ranks.fire[4] = 1;
      s.towers[0] = { type: 'ice', level: 6, cooldown: 0 };
      s.towers[1] = { type: 'poison', level: 4, cooldown: 120 };
      const carrier = s.enemies[0];
      carrier.progress = 16;
      moveEnemy(s, carrier, 1);
      const dropped = s.eggs[1];
      dropped.status = 'dropped';
      dropped.progress = 2;
      dropped.returnTimer = 12000;
      dropped.direct = false;
      s.spawnSchedule = [{ kind: 'phantom', hp: 80, spd: movementSpeed(2), at: 1200 }];
      s.enemies.push(createEnemy(s, 'ghost', 100, 1, 1));
      s.enemiesSummoned++;
      s.enemies[1].poison = 5000;
      s.enemies[1].poisonD = 1000;
      s.enemies[1].poisonDamage = 1;
      tickDefenseTowers(s, 16, []);
      castSpell(s, 'fire', { x: 90, y: 300 });
      const original = new GameEngine(s),
        { repo } = storage();
      expect(repo.saveSlot(0, original.snapshot(), { ...createJourney(), activeBattle: true })).toEqual({
        ok: true,
      });
      const read = repo.readSlot(0);
      expect(read.status).toBe('valid');
      if (read.status !== 'valid') return;
      const restored = new GameEngine(read.data.state);
      for (let i = 0; i < 400; i++) expect(restored.step(1000 / 60)).toEqual(original.step(1000 / 60));
      expect(restored.snapshot()).toEqual(original.snapshot());
    },
  );
  it('retains completed rewards and rejects malformed RNG without replacing storage', () => {
    const s = battle();
    s.wave = 5;
    finishBattle(s, true, []);
    const { repo, data } = storage(),
      journey = recordJourneyResult({ ...createJourney(), activeBattle: true }, s);
    expect(repo.saveSlot(0, s, journey)).toEqual({ ok: true });
    const bank = s.bankedGold;
    finishBattle(s, true, []);
    expect(s.bankedGold).toBe(bank);
    s.defense!.rng = 0;
    const raw = JSON.stringify({ version: 2, savedAt: 0, state: s });
    data.set('infernalDefense.save.1', raw);
    expect(repo.readSlot(1).status).toBe('error');
    expect(data.get('infernalDefense.save.1')).toBe(raw);
  });
  it('imports the upstream v1 checkpoint with mana, upgrades and discovered enemies', () => {
    const { repo, data } = storage();
    data.set(
      'infernalDefense.save.0',
      JSON.stringify({
        version: 1,
        gold: 120,
        lives: 5,
        wave: 2,
        bankedGold: 80,
        mana: 150,
        maxMana: 225,
        permanentUpgrades: { fire: 1, green: 2, blue: 3 },
        permanentRanks: { fire: [1, 0, 0, 0, 0], green: [0, 0, 0, 0, 0], blue: [0, 0, 0, 0, 0] },
        knownMonsters: ['imp', 'witch'],
      }),
    );
    const result = repo.readSlot(0);
    expect(result.status).toBe('valid');
    if (result.status === 'valid') {
      expect(result.data.state.defense).toMatchObject({ mana: 150, maxMana: 225 });
      expect(result.data.state.defense?.ranks.poison[5]).toBe(2);
      expect(result.data.state.wave).toBe(2);
    }
  });
});
