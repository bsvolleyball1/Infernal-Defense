import type { DefenseProfile, DragonType, Level, SpellKind } from '../domain/model';

export type Point = [number, number];
export type BonusAreaKind = 'damage' | 'range' | 'mana' | 'food' | 'gold';
export interface BonusArea {
  kind: BonusAreaKind;
  x: number;
  y: number;
  radius: number;
}
export interface Battlefield {
  width: number;
  height: number;
  name: string;
  description: string;
  theme: 'gorge' | 'meadow' | 'volcanic';
  background: string;
  path: Point[];
  /** Additional complete routes share a prefix and suffix with the main route. */
  forks: Point[][];
  perches: { x: number; y: number }[];
  bonusAreas: BonusArea[];
  nest: { x: number; y: number };
  challenge?: { dragon: DragonType; spell: SpellKind; kind?: 'only' | 'exclude' };
}

export const gorge: Battlefield = {
  width: 700,
  height: 430,
  name: 'Emberfall Gorge',
  description: 'A river gorge and winding bridge crossing.',
  theme: 'gorge',
  background: '#2c4646',
  path: [
    [-30, 300],
    [80, 300],
    [145, 280],
    [175, 220],
    [150, 160],
    [95, 120],
    [130, 70],
    [225, 75],
    [285, 140],
    [300, 235],
    [350, 315],
    [455, 325],
    [525, 270],
    [520, 200],
    [475, 140],
    [535, 85],
    [640, 85],
  ],
  forks: [],
  perches: [
    { x: 90, y: 202 },
    { x: 230, y: 155 },
    { x: 365, y: 205 },
    { x: 430, y: 78 },
    { x: 594, y: 205 },
    { x: 220, y: 345 },
    { x: 410, y: 385 },
    { x: 590, y: 345 },
  ],
  bonusAreas: [
    { kind: 'damage', x: 240, y: 245, radius: 24 },
    { kind: 'range', x: 390, y: 145, radius: 24 },
    { kind: 'mana', x: 35, y: 35, radius: 24 },
    { kind: 'food', x: 665, y: 395, radius: 24 },
    { kind: 'gold', x: 35, y: 395, radius: 24 },
  ],
  nest: { x: 640, y: 64 },
};

const meadow: Battlefield = {
  width: 700,
  height: 430,
  name: 'Willow Bend',
  description: 'One broad trail crosses a quiet meadow.',
  theme: 'meadow',
  background: '#648262',
  path: [
    [-30, 110],
    [45, 110],
    [115, 110],
    [185, 110],
    [255, 110],
    [325, 110],
    [365, 150],
    [365, 210],
    [365, 270],
    [400, 315],
    [455, 315],
    [510, 315],
    [565, 315],
    [620, 315],
    [650, 280],
    [650, 235],
    [650, 190],
  ],
  forks: [],
  perches: [
    { x: 115, y: 183 },
    { x: 280, y: 185 },
    { x: 445, y: 230 },
    { x: 535, y: 385 },
    { x: 577, y: 157 },
  ],
  bonusAreas: [
    { kind: 'damage', x: 235, y: 200, radius: 24 },
    { kind: 'range', x: 510, y: 245, radius: 24 },
    { kind: 'mana', x: 35, y: 35, radius: 24 },
    { kind: 'food', x: 665, y: 35, radius: 24 },
    { kind: 'gold', x: 35, y: 395, radius: 24 },
  ],
  nest: { x: 650, y: 169 },
};

const volcanic: Battlefield = {
  width: 700,
  height: 430,
  name: 'Obsidian Fork',
  description: 'Two routes split through a ruined volcanic fortress. Guard both branches.',
  theme: 'volcanic',
  background: '#403848',
  path: [
    [-30, 215],
    [45, 215],
    [120, 215],
    [195, 215],
    [235, 140],
    [270, 80],
    [330, 80],
    [390, 80],
    [450, 80],
    [490, 115],
    [510, 155],
    [530, 185],
    [550, 215],
    [580, 215],
    [610, 215],
    [635, 215],
    [660, 215],
  ],
  forks: [
    [
      [-30, 215],
      [45, 215],
      [120, 215],
      [195, 215],
      [235, 290],
      [270, 350],
      [330, 350],
      [390, 350],
      [450, 350],
      [490, 315],
      [510, 275],
      [530, 245],
      [550, 215],
      [580, 215],
      [610, 215],
      [635, 215],
      [660, 215],
    ],
  ],
  perches: [
    { x: 80, y: 140 },
    { x: 80, y: 290 },
    { x: 245, y: 215 },
    { x: 275, y: 155 },
    { x: 365, y: 145 },
    { x: 455, y: 160 },
    { x: 275, y: 275 },
    { x: 365, y: 285 },
    { x: 455, y: 270 },
    { x: 590, y: 130 },
  ],
  bonusAreas: [
    { kind: 'damage', x: 185, y: 135, radius: 24 },
    { kind: 'range', x: 625, y: 150, radius: 24 },
    { kind: 'mana', x: 35, y: 35, radius: 24 },
    { kind: 'food', x: 35, y: 395, radius: 24 },
    { kind: 'gold', x: 665, y: 395, radius: 24 },
  ],
  nest: { x: 660, y: 194 },
};

export function bonusAreaAt(
  geometry: Battlefield,
  point: { x: number; y: number },
): { area: BonusArea; index: number } | null {
  const index = geometry.bonusAreas.findIndex((area) => Math.hypot(point.x - area.x, point.y - area.y) <= area.radius);
  return index < 0 ? null : { area: geometry.bonusAreas[index], index };
}

const challengeLevel = (
  name: string,
  description: string,
  background: string,
  dragon: DragonType,
  spell: SpellKind,
): Battlefield => ({
  ...volcanic,
  name,
  description,
  background,
  challenge: { dragon, spell },
});

export function challengeAllowsDragon(geometry: Battlefield, dragon: DragonType): boolean {
  const challenge = geometry.challenge;
  return !challenge || (challenge.kind !== 'exclude' ? dragon === challenge.dragon : dragon !== challenge.dragon);
}

export function challengeAllowsSpell(geometry: Battlefield, spell: SpellKind): boolean {
  const challenge = geometry.challenge;
  return !challenge || (challenge.kind !== 'exclude' ? spell === challenge.spell : spell !== challenge.spell);
}

export function challengeLabel(geometry: Battlefield): string | null {
  const challenge = geometry.challenge;
  if (!challenge) return null;
  const dragonNames: Record<DragonType, string> = { fire: 'Ember', ice: 'Frost', poison: 'Thorn' };
  const spellNames: Record<SpellKind, string> = {
    fire: 'Fire Rain',
    ice: 'Ice Freeze',
    poison: 'Poison Gas',
  };
  return challenge.kind !== 'exclude'
    ? `${dragonNames[challenge.dragon]} dragon · ${spellNames[challenge.spell]} spell`
    : `No ${dragonNames[challenge.dragon]} dragon · no ${spellNames[challenge.spell]} spell`;
}

const excludedChallenge = (...args: Parameters<typeof challengeLevel>): Battlefield => {
  const map = challengeLevel(...args);
  return { ...map, challenge: { ...map.challenge!, kind: 'exclude' } };
};

export const battlefields: Record<Level, Battlefield> = {
  tutorial: gorge,
  level1: gorge,
  meadow,
  volcanic,
  fireTrial: challengeLevel(
    'Ember Fork',
    'Two paths converge at one nest. Use the Ember dragon and Fire Rain spell.',
    '#49332f',
    'fire',
    'fire',
  ),
  iceTrial: challengeLevel(
    'Frost Fork',
    'Two paths converge at one nest. Use the Frost dragon and Ice Freeze spell.',
    '#34454a',
    'ice',
    'ice',
  ),
  poisonTrial: challengeLevel(
    'Venom Fork',
    'Two paths converge at one nest. Use the Thorn dragon and Poison Gas spell.',
    '#354333',
    'poison',
    'poison',
  ),
  noPoisonTrial: excludedChallenge(
    'Blightless Fork',
    'Two paths converge at one nest. Defend without the Thorn dragon or Poison Gas spell.',
    '#354333',
    'poison',
    'poison',
  ),
  noIceTrial: excludedChallenge(
    'Frostless Fork',
    'Two paths converge at one nest. Defend without the Frost dragon or Ice Freeze spell.',
    '#34454a',
    'ice',
    'ice',
  ),
  noFireTrial: excludedChallenge(
    'Emberless Fork',
    'Two paths converge at one nest. Defend without the Ember dragon or Fire Rain spell.',
    '#49332f',
    'fire',
    'fire',
  ),
};

const gridBattlefields = Object.fromEntries(
  Object.entries(battlefields).map(([level, map]) => [
    level,
    {
      ...map,
      bonusAreas: [
        { kind: 'damage', x: 225, y: 25, radius: 24 },
        { kind: 'range', x: 475, y: 25, radius: 24 },
        { kind: 'mana', x: 25, y: 75, radius: 24 },
        { kind: 'food', x: 675, y: 75, radius: 24 },
        { kind: 'gold', x: 25, y: 25, radius: 24 },
      ],
    },
  ]),
) as Record<Level, Battlefield>;

export function getMap(level: Level, profile?: DefenseProfile): Battlefield {
  return (profile === 'defense-2' ? gridBattlefields : battlefields)[level];
}

export function routesFor(geometry: Battlefield): [number, number][][] {
  return [geometry.path, ...geometry.forks];
}
