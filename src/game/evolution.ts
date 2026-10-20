import { colorForDragon, dragonColors, dragonForms, formsForColors } from '../content/dragon-forms';
import { challengeAllowsDragon, getMap } from '../content/maps';
import { dragonTypeForColor } from '../content/dragon-forms';
import { towerUpgradeCost } from './rules';
import type { DragonColor, DragonForm, EvolutionTower, GameEvent, GameState, Tower } from './types';

export function evolutionOptions(state: GameState, tower: Tower, color: DragonColor): DragonForm[] {
  if (state.defense?.ruleset !== 'defense-2' || !tower.evolution || tower.level >= 3 || !dragonColors.includes(color))
    return [];
  if (!challengeAllowsDragon(getMap(state.activeLevel), dragonTypeForColor[color])) return [];
  return formsForColors([...tower.evolution.colors, color]);
}

export function createEvolutionTower(type: Tower['type'], position: { x: number; y: number }): EvolutionTower {
  const color = colorForDragon[type];
  return { type, level: 1, cooldown: 0, position: { ...position }, evolution: { colors: [color], form: color } };
}

/** Evolution is one transaction. A stale or illegal choice never spends food. */
export function evolveTower(state: GameState, color: DragonColor, form: DragonForm): GameEvent[] {
  const tower = state.selected === null ? null : state.towers[state.selected];
  if (!tower?.evolution || !evolutionOptions(state, tower, color).includes(form)) return [];
  const cost = towerUpgradeCost(tower);
  if (state.defense?.mode !== 'sandbox' && state.gold < cost) return [];
  if (state.defense?.mode !== 'sandbox') state.gold -= cost;
  tower.evolution = { colors: [...tower.evolution.colors, color].sort(), form };
  tower.level++;
  // The next attack waits a full new interval. Existing projectiles keep their payload.
  tower.cooldown = dragonForms[form].interval;
  delete tower.charges;
  delete tower.chargeTimer;
  delete tower.beamIds;
  if (dragonForms[form].ability === 'charged') {
    tower.charges = 0;
    tower.chargeTimer = 1000;
  }
  return [{ type: 'save' }, { type: 'message', text: `${dragonForms[form].name} · Tier ${tower.level}` }];
}
