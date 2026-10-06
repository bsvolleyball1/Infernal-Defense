import type { DragonType, MonsterKind } from '../game/types';

export interface DragonDefinition {
  name: string;
  cost: number;
  color: string;
  damage: number;
  rate: number;
  range: number;
  icon: string;
}

export interface WaveGroup {
  kind: MonsterKind;
  n: number;
  hp: number;
  spd: number;
}

export const map = {
  width: 700,
  height: 430,
  path: [
    [-30, 300], [80, 300], [145, 280], [195, 220], [195, 165],
    [180, 105], [250, 105], [315, 115], [350, 155], [385, 205],
    [440, 207], [492, 176], [540, 172], [570, 205], [590, 250],
    [625, 253], [663, 185],
  ] as [number, number][],
  perches: [
    { x: 90, y: 202 }, { x: 260, y: 68 }, { x: 355, y: 279 },
    { x: 485, y: 83 }, { x: 563, y: 307 },
  ],
};

export const dragons: Record<DragonType, DragonDefinition> = {
  fire: { name: 'Ember', cost: 60, color: '#ee7959', damage: 27, rate: 680, range: 132, icon: '🐉' },
  ice: { name: 'Frost', cost: 55, color: '#81d0dc', damage: 8, rate: 820, range: 145, icon: '🐲' },
  poison: { name: 'Thorn', cost: 50, color: '#94c968', damage: 7, rate: 760, range: 125, icon: '🐉' },
};

export const waves: WaveGroup[][] = [
  [{ kind: 'scout', n: 7, hp: 45, spd: 0.72 }, { kind: 'scout', n: 3, hp: 45, spd: 0.72 }],
  [{ kind: 'scout', n: 8, hp: 48, spd: 0.8 }, { kind: 'shield', n: 4, hp: 120, spd: 0.47 }],
  [{ kind: 'scout', n: 8, hp: 55, spd: 0.86 }, { kind: 'shield', n: 6, hp: 130, spd: 0.52 }, { kind: 'runner', n: 4, hp: 55, spd: 1.22 }],
  [{ kind: 'runner', n: 10, hp: 66, spd: 1.25 }, { kind: 'shield', n: 8, hp: 145, spd: 0.55 }],
  [{ kind: 'scout', n: 8, hp: 68, spd: 0.95 }, { kind: 'shield', n: 10, hp: 165, spd: 0.62 }, { kind: 'chief', n: 1, hp: 900, spd: 0.4 }],
];

export const monsters: Record<MonsterKind, { name: string; description: string }> = {
  scout: { name: 'Pass raider', description: 'A quick-footed egg thief with little armor.' },
  shield: { name: 'Iron guard', description: 'A slower raider protected by a heavy shield.' },
  runner: { name: 'Ash runner', description: 'A fast scout who races through the pass.' },
  chief: { name: 'Raid chief', description: 'A formidable leader who can endure a great deal of fire.' },
};

/** Progress is measured in path segments, matching the original movement formula. */
export function positionAt(progress: number): [number, number] {
  const u = Math.max(0, Math.min(map.path.length - 1, progress));
  const i = Math.floor(u);
  const point = map.path[i];
  if (i >= map.path.length - 1) return [...point];
  const next = map.path[i + 1];
  const fraction = u - i;
  return [point[0] + (next[0] - point[0]) * fraction, point[1] + (next[1] - point[1]) * fraction];
}
