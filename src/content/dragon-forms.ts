import type { DragonColor, DragonForm, DragonType } from '../domain/model';

interface EvolvableDragon {
  type: DragonType;
  level: number;
  evolution?: { colors: DragonColor[]; form: DragonForm };
}

export type DragonAbility =
  | 'beam'
  | 'charged'
  | 'rapid'
  | 'cone'
  | 'acid'
  | 'explosion'
  | 'focus'
  | 'tar'
  | 'nullify'
  | 'earthquake'
  | 'radius'
  | 'sniper'
  | 'mapBeam';

export interface DragonFormDefinition {
  name: string;
  color: string;
  ability: DragonAbility;
  description: string;
  damage: number;
  interval: number;
  count?: number;
  radius?: number;
  duration?: number;
}

export const colorForDragon: Record<DragonType, DragonColor> = {
  fire: 'red',
  ice: 'blue',
  poison: 'yellow',
};

export const dragonTypeForColor: Record<DragonColor, DragonType> = {
  red: 'fire',
  blue: 'ice',
  yellow: 'poison',
};

export const dragonColors: DragonColor[] = ['red', 'blue', 'yellow'];

export const dragonForms: Record<DragonForm, DragonFormDefinition> = {
  red: { name: 'Red', color: '#ee455c', ability: 'beam', description: 'One beam', damage: 6, interval: 0 },
  blue: {
    name: 'Blue',
    color: '#61a7ed',
    ability: 'charged',
    description: 'One charged attack',
    damage: 15,
    interval: 1000,
    count: 1,
  },
  yellow: { name: 'Yellow', color: '#e2bf48', ability: 'rapid', description: 'Fast attack', damage: 2, interval: 250 },
  red2: {
    name: 'Red 2',
    color: '#e83c4c',
    ability: 'beam',
    description: 'Two beams',
    damage: 15,
    interval: 0,
    count: 2,
  },
  purple: {
    name: 'Purple',
    color: '#a26ce0',
    ability: 'cone',
    description: 'Plasma breath cone',
    damage: 12,
    interval: 900,
    radius: 45,
  },
  orange: {
    name: 'Orange',
    color: '#e99039',
    ability: 'explosion',
    description: 'Area explosion',
    damage: 24,
    interval: 1100,
    radius: 48,
  },
  blue2: {
    name: 'Blue 2',
    color: '#428ee3',
    ability: 'charged',
    description: 'Two charged attacks',
    damage: 15,
    interval: 1000,
    count: 2,
  },
  green: {
    name: 'Green',
    color: '#72bc50',
    ability: 'acid',
    description: 'Acid damage over time',
    damage: 4,
    interval: 250,
    duration: 5000,
  },
  yellow2: {
    name: 'Yellow 2',
    color: '#efc928',
    ability: 'rapid',
    description: 'Faster attack and damage',
    damage: 4,
    interval: 200,
  },
  red3: {
    name: 'Red 3',
    color: '#f13843',
    ability: 'beam',
    description: 'Three beams',
    damage: 15,
    interval: 0,
    count: 3,
  },
  bloodRed: {
    name: 'Blood Red',
    color: '#b41d45',
    ability: 'focus',
    description: 'Laser focuses on one target',
    damage: 30,
    interval: 0,
  },
  pink: {
    name: 'Pink',
    color: '#ee78ae',
    ability: 'nullify',
    description: 'Removes damage resistance for 4 seconds',
    damage: 12,
    interval: 1000,
    duration: 4000,
  },
  blue3: {
    name: 'Blue 3',
    color: '#3982ed',
    ability: 'charged',
    description: 'Three charged attacks',
    damage: 25,
    interval: 1000,
    count: 3,
  },
  black: {
    name: 'Black',
    color: '#54505c',
    ability: 'tar',
    description: 'Tar slows an area',
    damage: 10,
    interval: 1000,
    radius: 58,
    duration: 2000,
  },
  gray: {
    name: 'Gray',
    color: '#92949a',
    ability: 'earthquake',
    description: 'Earthquake stuns an area',
    damage: 20,
    interval: 1800,
    radius: 75,
    duration: 1500,
  },
  yellow3: {
    name: 'Yellow 3',
    color: '#f3d329',
    ability: 'rapid',
    description: 'Faster attack and damage',
    damage: 6,
    interval: 150,
  },
  sun: {
    name: 'Sun',
    color: '#f7a635',
    ability: 'radius',
    description: 'Radius attack',
    damage: 22,
    interval: 900,
    radius: 70,
  },
  turquoise: {
    name: 'Turquoise',
    color: '#37c8c1',
    ability: 'sniper',
    description: 'Lightning sniper',
    damage: 55,
    interval: 1000,
  },
  white: {
    name: 'White',
    color: '#e9edf0',
    ability: 'mapBeam',
    description: 'Area beam across the map',
    damage: 20,
    interval: 0,
  },
  purple2: {
    name: 'Purple 2',
    color: '#8954cc',
    ability: 'cone',
    description: 'Larger plasma breath cone',
    damage: 22,
    interval: 900,
    radius: 72,
  },
  orange2: {
    name: 'Orange 2',
    color: '#ed782c',
    ability: 'explosion',
    description: 'Larger area explosion',
    damage: 42,
    interval: 1100,
    radius: 82,
  },
  green2: {
    name: 'Green 2',
    color: '#55a83c',
    ability: 'acid',
    description: 'Stronger damage over time',
    damage: 8,
    interval: 250,
    duration: 5000,
  },
};

const pairForms: Record<string, DragonForm> = {
  'blue,blue': 'blue2',
  'blue,red': 'purple',
  'blue,yellow': 'green',
  'red,red': 'red2',
  'red,yellow': 'orange',
  'yellow,yellow': 'yellow2',
};

const tripleForms: Record<string, DragonForm[]> = {
  'blue,blue,blue': ['blue3'],
  'blue,blue,red': ['black', 'purple2'],
  'blue,blue,yellow': ['gray', 'green2'],
  'blue,red,red': ['bloodRed', 'purple2'],
  'blue,red,yellow': ['white'],
  'blue,yellow,yellow': ['turquoise', 'green2'],
  'red,red,red': ['red3'],
  'red,red,yellow': ['pink', 'orange2'],
  'red,yellow,yellow': ['sun', 'orange2'],
  'yellow,yellow,yellow': ['yellow3'],
};

export function normalizedColors(colors: DragonColor[]): DragonColor[] {
  return [...colors].sort();
}

export function formsForColors(colors: DragonColor[]): DragonForm[] {
  const key = normalizedColors(colors).join(',');
  if (colors.length === 2) return pairForms[key] ? [pairForms[key]] : [];
  if (colors.length === 3) return tripleForms[key] ?? [];
  return [];
}

export function colorsForTower(tower: EvolvableDragon): DragonColor[] {
  if (tower.evolution?.colors) return normalizedColors(tower.evolution?.colors);
  return Array.from({ length: Math.min(3, tower.level) }, () => colorForDragon[tower.type]);
}

export function formForTower(tower: EvolvableDragon): DragonForm {
  if (tower.evolution?.form) return tower.evolution?.form;
  if (tower.level <= 1) return colorForDragon[tower.type];
  return formsForColors(colorsForTower(tower))[0] ?? colorForDragon[tower.type];
}

export function nextForms(tower: EvolvableDragon, color: DragonColor): DragonForm[] {
  return formsForColors([...colorsForTower(tower), color]);
}
