import { describe, expect, it } from 'vitest';
import { getMap } from '../src/content/catalog';
import { createDefenseState } from '../src/game/defense-state';
import { defenseRange } from '../src/game/defense-combat';
import { towerBonus, produceTowerBonusResources } from '../src/game/tower-bonuses';
import { GameEngine, createInitialState } from '../src/game/engine';
import { updateEnemies, updateProjectiles, updateTowers } from '../src/game/combat';
import { towerDamage, towerRange } from '../src/game/rules';
import type { Enemy } from '../src/game/types';

describe('battlefield tower bonus areas', () => {
  it('scales damage and range by the occupying dragon level', () => {
    const state = createDefenseState('meadow');
    const map = getMap('meadow');
    const damage = map.bonusAreas.find((area) => area.kind === 'damage')!;
    const range = map.bonusAreas.find((area) => area.kind === 'range')!;
    state.towers[0] = { type: 'fire', level: 1, cooldown: 0, position: { x: damage.x, y: damage.y } };
    expect(towerBonus(state, 0)?.damageMultiplier).toBe(1.1);

    state.towers[0]!.level = 3;
    expect(towerBonus(state, 0)?.damageMultiplier).toBeCloseTo(1.3);
    state.towers[0]!.position = { x: range.x, y: range.y };
    expect(defenseRange(state, state.towers[0]!)).toBeCloseTo(towerRange(state.towers[0]!) * 1.3);
  });

  it('applies damage-area bonuses to shots and their poison damage-over-time', () => {
    const state = createInitialState();
    state.phase = 'battle';
    state.wave = 1;
    state.towers[0] = {
      type: 'poison',
      level: 1,
      cooldown: 0,
      position: { x: 240, y: 245 },
    };
    const target: Enemy = {
      id: 12,
      kind: 'scout',
      hp: 100,
      max: 100,
      spd: 0.72,
      progress: 8,
      slow: 0,
      poison: 0,
      poisonD: 0,
      carryingEgg: null,
      returning: false,
      escaped: false,
      rewarded: false,
    };
    state.enemies = [target];
    state.enemiesSummoned = 1;
    state.nextEntityId = 13;

    updateTowers(state, 1000 / 60, []);
    expect(state.projectiles[0]?.damage).toBeCloseTo(towerDamage(state.towers[0]!) * 1.1);
    updateProjectiles(state, 10000, []);
    expect(target.poisonDamageMultiplier).toBe(1.1);
    const hitPointsAfterShot = target.hp;
    updateEnemies(state, 10, []);
    expect(target.hp).toBeCloseTo(hitPointsAfterShot - 4.4);
  });

  it('produces food and banked gold continuously, and caps mana at its maximum', () => {
    const state = createDefenseState('meadow');
    const areas = getMap('meadow').bonusAreas;
    for (const [index, kind] of ['mana', 'food', 'gold'].entries()) {
      const area = areas.find((item) => item.kind === kind)!;
      state.towers[index] = { type: 'fire', level: 1, cooldown: 0, position: { x: area.x, y: area.y } };
    }
    state.defense!.mana = 199.8;
    const startingFood = state.gold;
    produceTowerBonusResources(state, 1000);
    expect(state.defense!.mana).toBe(200);
    expect(state.gold).toBeCloseTo(startingFood + 0.5);
    expect(state.bankedGold).toBeCloseTo(0.25);

    state.towers[0]!.level = 2;
    state.towers[1]!.level = 2;
    state.towers[2]!.level = 2;
    state.defense!.mana = 198;
    produceTowerBonusResources(state, 1000);
    expect(state.defense!.mana).toBe(199);
    expect(state.gold).toBeCloseTo(startingFood + 1.5);
    expect(state.bankedGold).toBeCloseTo(0.75);
  });

  it('accrues resource-area income during active simulation and stops while paused', () => {
    const state = createDefenseState('meadow');
    const mana = getMap('meadow').bonusAreas.find((area) => area.kind === 'mana')!;
    state.defense!.mana = 100;
    state.towers[0] = { type: 'fire', level: 1, cooldown: 0, position: { x: mana.x, y: mana.y } };
    const engine = new GameEngine(state);

    engine.step(1000);
    expect(engine.state.defense!.mana).toBeCloseTo(105.5);
    engine.state.paused = true;
    engine.step(1000);
    expect(engine.state.defense!.mana).toBeCloseTo(105.5);
  });
});
