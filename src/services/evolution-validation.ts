import { colorForDragon, dragonColors, dragonForms, dragonTypeForColor, formsForColors } from '../content/dragon-forms';
import { challengeAllowsDragon } from '../content/maps';
import type { Battlefield } from '../content/maps';
import type { DragonColor, DragonForm, DragonType } from '../domain/model';
import { array, check, choice, object, own } from './validation/primitives';
import type { RecordValue } from './validation/primitives';

export function validateEvolution(tower: RecordValue, geometry: Battlefield, evolved: boolean): void {
  if (!evolved) {
    check(
      !own(tower, 'evolution') && !own(tower, 'colors') && !own(tower, 'form'),
      'Evolution requires the new battle rules.',
    );
    return;
  }
  object(tower.evolution, 'Evolution');
  const evolution = tower.evolution;
  array(evolution.colors, 'Evolution colors');
  check(evolution.colors.length === tower.level && evolution.colors.length <= 3, 'Colors must match the dragon tier.');
  for (const color of evolution.colors) {
    choice(color, dragonColors, 'Evolution color');
    check(
      challengeAllowsDragon(geometry, dragonTypeForColor[color as DragonColor]),
      'Evolution color violates this challenge.',
    );
  }
  check(evolution.colors.includes(colorForDragon[tower.type as DragonType]), 'Evolution must contain its base color.');
  const forms =
    tower.level === 1 ? [colorForDragon[tower.type as DragonType]] : formsForColors(evolution.colors as DragonColor[]);
  choice(evolution.form, forms, 'Evolution form');
  const ability = dragonForms[evolution.form as DragonForm].ability;
  check(
    ability === 'charged' || (!own(tower, 'charges') && !own(tower, 'chargeTimer')),
    'Only charged forms store charges.',
  );
  check(
    ['beam', 'focus', 'mapBeam'].includes(ability) || !own(tower, 'beamIds'),
    'Only beam forms store beam targets.',
  );
}
