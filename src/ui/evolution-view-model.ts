import { dragonColors, dragonForms } from '../content/dragon-forms';
import { evolutionOptions } from '../game/evolution';
import { towerUpgradeCost } from '../game/rules';
import type { DragonColor, GameState } from '../game/types';

/** The identity includes the tier so an upgrade cannot leave an obsolete choice open. */
export function evolutionOwner(state: GameState): string {
  const tower = state.selected === null ? null : state.towers[state.selected];
  if (
    !tower?.evolution ||
    tower.level >= 3 ||
    state.paused ||
    state.phase === 'won' ||
    state.phase === 'lost' ||
    (state.defense?.mode !== 'sandbox' && state.gold < towerUpgradeCost(tower))
  )
    return '';
  return `${state.defense?.ruleset}:${state.activeLevel}:${state.selected}:${tower.evolution.form}`;
}

export function presentEvolutionChoices(state: GameState) {
  const tower = state.selected === null ? null : state.towers[state.selected];
  if (!tower || !evolutionOwner(state)) return [];
  return dragonColors.flatMap((color) => {
    const forms = evolutionOptions(state, tower, color);
    return forms.length
      ? [
          {
            color,
            name: color[0].toUpperCase() + color.slice(1),
            hex: dragonForms[color].color,
            forms: forms.map((form) => ({ form, ...dragonForms[form] })),
          },
        ]
      : [];
  });
}

export const colorName = (color: DragonColor): string => color[0].toUpperCase() + color.slice(1);
