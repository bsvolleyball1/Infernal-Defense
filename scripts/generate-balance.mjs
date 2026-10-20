import { writeFile } from 'node:fs/promises';
import { dragonForms, formsForColors } from '../src/content/dragon-forms.ts';
import { enemyRoster, movementSpeed } from '../src/content/enemies.ts';

const csv = (rows) =>
  rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n') + '\n';
const colors = ['red', 'blue', 'yellow'];
const combinations = [];
for (let a = 0; a < 3; a++) {
  combinations.push([colors[a]]);
  for (let b = a; b < 3; b++) {
    combinations.push([colors[a], colors[b]]);
    for (let c = b; c < 3; c++) combinations.push([colors[a], colors[b], colors[c]]);
  }
}
const towerRows = [
  [
    'Form',
    'Tier',
    'Color combinations',
    'Ability',
    'Damage per hit or DPS per target',
    'Interval ms',
    'Target count or charge capacity',
    'Area radius',
    'Effect duration ms',
    'Steady damage per target per second',
    'Notes',
  ],
];
for (const [id, form] of Object.entries(dragonForms)) {
  const recipes = combinations.filter((combination) =>
    combination.length === 1 ? combination[0] === id : formsForColors(combination).includes(id),
  );
  const continuous = ['beam', 'focus', 'mapBeam'].includes(form.ability);
  const dps = continuous
    ? form.damage
    : form.ability === 'charged'
      ? form.damage
      : (form.damage * 1000) / form.interval;
  towerRows.push([
    form.name,
    recipes[0].length,
    recipes.map((recipe) => recipe.join(' + ')).join(' or '),
    form.ability,
    form.damage,
    form.interval,
    form.ability === 'mapBeam'
      ? 'all eligible enemies'
      : ['cone', 'explosion', 'radius', 'tar', 'earthquake'].includes(form.ability)
        ? 'all eligible enemies in area'
        : (form.count ?? 1),
    form.radius,
    form.duration,
    dps.toFixed(2),
    form.ability === 'charged'
      ? 'One charge regenerates per second; capacity controls stored burst, not sustained DPS. Extra-charge ranks increase capacity.'
      : form.ability === 'acid'
        ? 'DPS excludes poison. Poison deals 1% of launch-target max HP per second for 5 seconds after the last hit; repeated hits reset its timer.'
        : continuous
          ? 'Per target; target cap and range depend on ability. Base-element ranks, resistances and bonus cells apply.'
          : 'Direct damage to each affected target. Base-element ranks, resistances and bonus cells apply.',
  ]);
}
await writeFile(new URL('../docs/tower-balance.csv', import.meta.url), csv(towerRows));
const monsterRows = [
  [
    'Monster',
    'Base HP',
    'Speed rating',
    'Movement progress per second',
    'Fire multiplier',
    'Ice multiplier',
    'Poison multiplier',
    'Spell multiplier',
    'Ability',
  ],
];
for (const enemy of Object.values(enemyRoster)) {
  const resistance = enemy.traits?.resist;
  monsterRows.push([
    enemy.name,
    enemy.hp,
    enemy.rating,
    (movementSpeed(enemy.rating) * 0.0045 * 0.5 * 1000).toFixed(4),
    resistance?.fire ?? resistance?.all ?? 1,
    resistance?.ice ?? resistance?.all ?? 1,
    resistance?.poison ?? resistance?.all ?? 1,
    enemy.traits?.spellImmune ? 0 : 1,
    enemy.description,
  ]);
}
await writeFile(new URL('../docs/monster-balance.csv', import.meta.url), csv(monsterRows));
console.log(`Updated ${towerRows.length - 1} tower forms and ${monsterRows.length - 1} monsters.`);
