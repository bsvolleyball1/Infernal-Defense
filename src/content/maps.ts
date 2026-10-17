import type { DragonType, Level, SpellKind } from '../game/types';

export type Point = [number, number];
export type BonusAreaKind = 'damage' | 'range' | 'mana' | 'food' | 'gold';
export interface BonusArea {
  kind: BonusAreaKind;
  x: number;
  y: number;
  radius: number;
}
export const towerGridCellSize = 50;
export interface TowerGridCell {
  column: number;
  row: number;
  x: number;
  y: number;
  width: number;
  height: number;
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
  challenge?: {
    kind: 'only' | 'exclude';
    dragon: DragonType;
    spell: SpellKind;
  };
}

export const gorge: Battlefield = {
  width: 700, height: 430, name: 'Emberfall Gorge',
  description: 'A river gorge and winding bridge crossing.',
  theme: 'gorge', background: '#2c4646',
  path: [
    [-30, 300], [80, 300], [145, 280], [175, 220], [150, 160],
    [95, 120], [130, 70], [225, 75], [285, 140], [300, 235],
    [350, 315], [455, 325], [525, 270], [520, 200], [475, 140],
    [535, 85], [640, 85],
  ],
  forks: [],
  perches: [
    { x: 90, y: 202 }, { x: 230, y: 155 }, { x: 365, y: 205 },
    { x: 430, y: 78 }, { x: 594, y: 205 }, { x: 220, y: 345 },
    { x: 410, y: 385 }, { x: 590, y: 345 },
  ],
  bonusAreas: [
    { kind: 'damage', x: 225, y: 25, radius: 24 },
    { kind: 'range', x: 475, y: 25, radius: 24 },
    { kind: 'mana', x: 25, y: 75, radius: 24 },
    { kind: 'food', x: 675, y: 75, radius: 24 },
    { kind: 'gold', x: 25, y: 25, radius: 24 },
  ],
  nest: { x: 640, y: 64 },
};

const meadow: Battlefield = {
  width: 700, height: 430, name: 'Willow Bend',
  description: 'One broad trail crosses a quiet meadow.',
  theme: 'meadow', background: '#648262',
  path: [
    [-30, 110], [45, 110], [115, 110], [185, 110], [255, 110],
    [325, 110], [365, 150], [365, 210], [365, 270], [400, 315],
    [455, 315], [510, 315], [565, 315], [620, 315], [650, 280],
    [650, 235], [650, 190],
  ],
  forks: [],
  perches: [
    { x: 115, y: 183 }, { x: 280, y: 185 }, { x: 445, y: 230 },
    { x: 535, y: 385 }, { x: 577, y: 157 },
  ],
  bonusAreas: [
    { kind: 'damage', x: 225, y: 25, radius: 24 },
    { kind: 'range', x: 475, y: 25, radius: 24 },
    { kind: 'mana', x: 25, y: 75, radius: 24 },
    { kind: 'food', x: 675, y: 75, radius: 24 },
    { kind: 'gold', x: 25, y: 25, radius: 24 },
  ],
  nest: { x: 650, y: 169 },
};

const volcanic: Battlefield = {
  width: 700, height: 430, name: 'Obsidian Fork',
  description: 'Two routes split through a ruined volcanic fortress. Guard both branches.',
  theme: 'volcanic', background: '#403848',
  path: [
    [-30, 215], [45, 215], [120, 215], [195, 215],
    [235, 140], [270, 80], [330, 80], [390, 80], [450, 80],
    [490, 115], [510, 155], [530, 185], [550, 215],
    [580, 215], [610, 215], [635, 215], [660, 215],
  ],
  forks: [[
    [-30, 215], [45, 215], [120, 215], [195, 215],
    [235, 290], [270, 350], [330, 350], [390, 350], [450, 350],
    [490, 315], [510, 275], [530, 245], [550, 215],
    [580, 215], [610, 215], [635, 215], [660, 215],
  ]],
  perches: [
    { x: 80, y: 140 }, { x: 80, y: 290 }, { x: 245, y: 215 },
    { x: 275, y: 155 }, { x: 365, y: 145 }, { x: 455, y: 160 },
    { x: 275, y: 275 }, { x: 365, y: 285 }, { x: 455, y: 270 },
    { x: 590, y: 130 },
  ],
  bonusAreas: [
    { kind: 'damage', x: 225, y: 25, radius: 24 },
    { kind: 'range', x: 475, y: 25, radius: 24 },
    { kind: 'mana', x: 25, y: 75, radius: 24 },
    { kind: 'food', x: 675, y: 75, radius: 24 },
    { kind: 'gold', x: 25, y: 25, radius: 24 },
  ],
  nest: { x: 660, y: 194 },
};

export function bonusAreaAt(
  geometry: Battlefield,
  point: { x: number; y: number },
): { area: BonusArea; index: number } | null {
  const cell = towerGridCellAt(geometry, point);
  if (!cell) return null;
  const key = towerGridCellKey(cell);
  const index = geometry.bonusAreas.findIndex(area => {
    const bonusCell = towerGridCellAt(geometry, area);
    return bonusCell !== null && towerGridCellKey(bonusCell) === key;
  });
  return index < 0 ? null : { area: geometry.bonusAreas[index], index };
}

export function towerGridCellAt(
  geometry: Battlefield,
  point: { x: number; y: number },
): TowerGridCell | null {
  if (point.x < 0 || point.x >= geometry.width || point.y < 0 || point.y >= geometry.height) return null;
  const column = Math.floor(point.x / towerGridCellSize);
  const row = Math.floor(point.y / towerGridCellSize);
  const x = column * towerGridCellSize;
  const y = row * towerGridCellSize;
  return {
    column,
    row,
    x,
    y,
    width: Math.min(towerGridCellSize, geometry.width - x),
    height: Math.min(towerGridCellSize, geometry.height - y),
  };
}

export function towerGridCellCenter(cell: TowerGridCell): { x: number; y: number } {
  return { x: cell.x + cell.width / 2, y: cell.y + cell.height / 2 };
}

export function towerGridCellKey(cell: TowerGridCell): string {
  return `${cell.column}:${cell.row}`;
}

export function isTowerGridCellBlocked(geometry: Battlefield, cell: TowerGridCell): boolean {
  const left = cell.x;
  const right = cell.x + cell.width;
  const top = cell.y;
  const bottom = cell.y + cell.height;
  return [geometry.path, ...geometry.forks].some(path =>
    path.slice(0, -1).some(([x1, y1], index) => {
      const [x2, y2] = path[index + 1];
      let min = 0;
      let max = 1;
      const dx = x2 - x1;
      const dy = y2 - y1;
      for (const [p, q] of [
        [-dx, x1 - left],
        [dx, right - x1],
        [-dy, y1 - top],
        [dy, bottom - y1],
      ]) {
        if (p === 0) {
          if (q < 0) return false;
          continue;
        }
        const ratio = q / p;
        if (p < 0) min = Math.max(min, ratio);
        else max = Math.min(max, ratio);
        if (min > max) return false;
      }
      return true;
    }),
  );
}

const challengeLevel = (
  name: string,
  description: string,
  background: string,
  dragon: DragonType,
  spell: SpellKind,
  kind: 'only' | 'exclude',
): Battlefield => ({
  ...volcanic,
  name,
  description,
  background,
  challenge: { kind, dragon, spell },
});

export function challengeAllowsDragon(geometry: Battlefield, dragon: DragonType): boolean {
  const challenge = geometry.challenge;
  return !challenge || (challenge.kind === 'only' ? dragon === challenge.dragon : dragon !== challenge.dragon);
}

export function challengeAllowsSpell(geometry: Battlefield, spell: SpellKind): boolean {
  const challenge = geometry.challenge;
  return !challenge || (challenge.kind === 'only' ? spell === challenge.spell : spell !== challenge.spell);
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
  return challenge.kind === 'only'
    ? `${dragonNames[challenge.dragon]} dragon · ${spellNames[challenge.spell]} spell`
    : `No ${dragonNames[challenge.dragon]} dragon · no ${spellNames[challenge.spell]} spell`;
}

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
    'only',
  ),
  iceTrial: challengeLevel(
    'Frost Fork',
    'Two paths converge at one nest. Use the Frost dragon and Ice Freeze spell.',
    '#34454a',
    'ice',
    'ice',
    'only',
  ),
  poisonTrial: challengeLevel(
    'Venom Fork',
    'Two paths converge at one nest. Use the Thorn dragon and Poison Gas spell.',
    '#354333',
    'poison',
    'poison',
    'only',
  ),
  noPoisonTrial: challengeLevel(
    'Blightless Fork',
    'Two paths converge at one nest. Defend without the Thorn dragon or Poison Gas spell.',
    '#354333',
    'poison',
    'poison',
    'exclude',
  ),
  noIceTrial: challengeLevel(
    'Frostless Fork',
    'Two paths converge at one nest. Defend without the Frost dragon or Ice Freeze spell.',
    '#34454a',
    'ice',
    'ice',
    'exclude',
  ),
  noFireTrial: challengeLevel(
    'Emberless Fork',
    'Two paths converge at one nest. Defend without the Ember dragon or Fire Rain spell.',
    '#49332f',
    'fire',
    'fire',
    'exclude',
  ),
};
