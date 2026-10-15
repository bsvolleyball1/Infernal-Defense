import type { MonsterKind } from '../domain/model';

export interface WaveGroup {
  kind: MonsterKind;
  n: number;
  hp: number;
  spd: number;
}

export const waves: WaveGroup[][] = [
  [
    { kind: 'scout', n: 7, hp: 45, spd: 0.72 },
    { kind: 'scout', n: 3, hp: 45, spd: 0.72 },
  ],
  [
    { kind: 'scout', n: 8, hp: 48, spd: 0.8 },
    { kind: 'shield', n: 4, hp: 120, spd: 0.47 },
  ],
  [
    { kind: 'scout', n: 8, hp: 55, spd: 0.86 },
    { kind: 'shield', n: 6, hp: 130, spd: 0.52 },
    { kind: 'runner', n: 4, hp: 55, spd: 1.22 },
  ],
  [
    { kind: 'runner', n: 10, hp: 66, spd: 1.25 },
    { kind: 'shield', n: 8, hp: 145, spd: 0.55 },
  ],
  [
    { kind: 'scout', n: 8, hp: 68, spd: 0.95 },
    { kind: 'shield', n: 10, hp: 165, spd: 0.62 },
    { kind: 'chief', n: 1, hp: 900, spd: 0.4 },
  ],
];
