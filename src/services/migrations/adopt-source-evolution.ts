import type { RecordValue } from '../validation/primitives';

const record = (value: unknown): value is RecordValue =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Recognize only the source branch's complete tower shape. Normal validation runs next. */
export function adoptSourceEvolution(save: RecordValue): boolean {
  if (
    !record(save.state) ||
    !record(save.state.defense) ||
    save.state.defense.ruleset !== 'defense-1' ||
    !Array.isArray(save.state.towers)
  )
    return false;
  const towers = save.state.towers.filter((tower) => tower !== null);
  if (
    !towers.length ||
    !towers.every(
      (tower) =>
        record(tower) && Array.isArray(tower.colors) && typeof tower.form === 'string' && tower.evolution === undefined,
    )
  )
    return false;
  for (const tower of towers) {
    tower.evolution = { colors: tower.colors, form: tower.form };
    delete tower.colors;
    delete tower.form;
  }
  save.state.defense.ruleset = 'defense-2';
  return true;
}
