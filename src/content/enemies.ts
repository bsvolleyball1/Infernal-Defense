import type { MonsterKind } from '../game/types';

export interface EnemyDefinition {
  name: string;
  hp: number;
  rating: number;
  color: string;
  description: string;
}
export const enemyRoster = {
  imp: { name: 'Imp', hp: 10, rating: 5, color: '#b75c45', description: 'No special ability.' },
  seaSerpent: { name: 'Sea Serpent', hp: 10, rating: 9, color: '#428b91', description: 'Fast and fragile.' },
  demon: { name: 'Demon', hp: 100, rating: 1, color: '#693d3b', description: 'Slow and tough.' },
  hellhound: {
    name: 'Hellhound',
    hp: 50,
    rating: 5,
    color: '#9a4937',
    description: '75% resistance to fire dragons.',
  },
  fury: {
    name: 'Fury',
    hp: 50,
    rating: 9,
    color: '#a54f64',
    description: '75% resistance to poison dragons.',
  },
  devil: {
    name: 'Devil',
    hp: 100,
    rating: 1,
    color: '#533a3e',
    description: '75% resistance to ice dragons.',
  },
  ghost: {
    name: 'Ghost',
    hp: 10,
    rating: 9,
    color: '#a9bdc1',
    description: 'Untargetable for 3 seconds after its first dragon hit.',
  },
  gargoyle: {
    name: 'Gargoyle',
    hp: 60,
    rating: 4,
    color: '#77756b',
    description: 'Remains targetable but invulnerable for 2 seconds after lethal damage.',
  },
  witch: { name: 'Witch', hp: 80, rating: 3, color: '#6f536c', description: 'Immune to spells.' },
  hag: {
    name: 'Hag',
    hp: 90,
    rating: 2,
    color: '#627b4f',
    description: 'Heals others within 50 units for 3% maximum health per second.',
  },
  troll: {
    name: 'Troll',
    hp: 100,
    rating: 3,
    color: '#5d7547',
    description: 'After 1 second without damage, regenerates 4% health per second.',
  },
  necromancer: {
    name: 'Necromancer',
    hp: 100,
    rating: 1,
    color: '#514950',
    description: 'Travels for 5 seconds, pauses for 1 second, then summons a discovered enemy.',
  },
  zombieTrain: {
    name: 'Zombie Train',
    hp: 200,
    rating: 1,
    color: '#69785a',
    description: 'On death releases 5–10 Imps, Demons and Sea Serpents.',
  },
  lich: {
    name: 'Lich',
    hp: 90,
    rating: 4,
    color: '#786a87',
    description: 'First egg pickup grants 100 health and speed rating 7.',
  },
  skeleton: {
    name: 'Skeleton',
    hp: 10,
    rating: 5,
    color: '#b8aa82',
    description: '50% resistance to all dragon attacks.',
  },
  phantom: {
    name: 'Phantom',
    hp: 80,
    rating: 2,
    color: '#8893a0',
    description: 'Invulnerable for 3 seconds after spawning.',
  },
  shade: {
    name: 'Shade',
    hp: 100,
    rating: 3,
    color: '#3e464e',
    description: 'Travels straight to the nest, ignoring the trail.',
  },
} satisfies Partial<Record<MonsterKind, EnemyDefinition>>;
export type DefenseMonster = keyof typeof enemyRoster;
export const playableMonsters = Object.keys(enemyRoster) as DefenseMonster[];
export const futureMonsters = [
  'Minotaur',
  'Basilisk',
  'Wight',
  'Werewolf',
  'Specter',
  'Ogre',
  'Manticore',
  'Giant',
  'Cyclops',
  'Siege Engine',
  'Aircraft',
];
// Preserve main's effective rating conversion (.125 followed by .5).
export const movementSpeed = (rating: number): number => rating / 16;
export const isDefenseMonster = (kind: string): kind is DefenseMonster => Object.hasOwn(enemyRoster, kind);
export const tutorialRoster: [DefenseMonster, number][][] = [
  [['imp', 6]],
  [
    ['imp', 5],
    ['seaSerpent', 3],
  ],
  [['seaSerpent', 6]],
  [
    ['imp', 5],
    ['demon', 2],
  ],
  [
    ['seaSerpent', 5],
    ['demon', 3],
  ],
];
export const defenseWaves: [DefenseMonster, number][][] = [
  [
    ['imp', 8],
    ['seaSerpent', 2],
  ],
  [
    ['seaSerpent', 8],
    ['demon', 2],
  ],
  [
    ['hellhound', 4],
    ['fury', 4],
    ['devil', 3],
  ],
  [
    ['ghost', 4],
    ['gargoyle', 3],
    ['witch', 3],
    ['skeleton', 4],
  ],
  [
    ['hag', 2],
    ['troll', 3],
    ['necromancer', 2],
    ['zombieTrain', 1],
    ['lich', 1],
    ['phantom', 2],
    ['shade', 2],
  ],
];
