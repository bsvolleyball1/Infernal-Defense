import type { MonsterKind } from '../domain/model';

export interface EnemyTraits {
  resist?: { all?: number; fire?: number; ice?: number; poison?: number };
  spellImmune?: boolean;
  regen?: { delayMs: number; fractionPerSecond: number };
  healAura?: { radius: number; fractionPerSecond: number };
  summoner?: { travelMs: number; pauseMs: number };
  lethalDelay?: { residualHp: number; delayMs: number };
  untargetableAfterHitMs?: number;
  spawnInvulnerableMs?: number;
  directPath?: boolean;
  onCarry?: { bonusHp: number; speedRating: number };
  onDeath?: { minimum: number; span: number; kinds: readonly MonsterKind[] };
}

export interface EnemyDefinition {
  name: string;
  hp: number;
  rating: number;
  color: string;
  description: string;
  traits?: EnemyTraits;
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
    traits: { resist: { fire: 0.25 } },
  },
  fury: {
    name: 'Fury',
    hp: 50,
    rating: 9,
    color: '#a54f64',
    description: '75% resistance to poison dragons.',
    traits: { resist: { poison: 0.25 } },
  },
  devil: {
    name: 'Devil',
    hp: 100,
    rating: 1,
    color: '#533a3e',
    description: '75% resistance to ice dragons.',
    traits: { resist: { ice: 0.25 } },
  },
  ghost: {
    name: 'Ghost',
    hp: 10,
    rating: 9,
    color: '#a9bdc1',
    description: 'Untargetable for 3 seconds after its first dragon hit.',
    traits: { untargetableAfterHitMs: 3000 },
  },
  gargoyle: {
    name: 'Gargoyle',
    hp: 60,
    rating: 4,
    color: '#77756b',
    description: 'Remains targetable but invulnerable for 2 seconds after lethal damage.',
    traits: { lethalDelay: { residualHp: 0.01, delayMs: 2000 } },
  },
  witch: { name: 'Witch', hp: 80, rating: 3, color: '#6f536c', description: 'Immune to spells.', traits: { spellImmune: true } },
  hag: {
    name: 'Hag',
    hp: 90,
    rating: 2,
    color: '#627b4f',
    description: 'Heals others within 50 units for 3% maximum health per second.',
    traits: { healAura: { radius: 50, fractionPerSecond: 0.03 } },
  },
  troll: {
    name: 'Troll',
    hp: 100,
    rating: 3,
    color: '#5d7547',
    description: 'After 1 second without damage, regenerates 4% health per second.',
    traits: { regen: { delayMs: 1000, fractionPerSecond: 0.04 } },
  },
  necromancer: {
    name: 'Necromancer',
    hp: 100,
    rating: 1,
    color: '#514950',
    description: 'Travels for 5 seconds, pauses for 1 second, then summons a discovered enemy.',
    traits: { summoner: { travelMs: 5000, pauseMs: 1000 } },
  },
  zombieTrain: {
    name: 'Zombie Train',
    hp: 200,
    rating: 1,
    color: '#69785a',
    description: 'On death releases 5–10 Imps, Demons and Sea Serpents.',
    traits: { onDeath: { minimum: 5, span: 6, kinds: ['imp', 'demon', 'seaSerpent'] } },
  },
  lich: {
    name: 'Lich',
    hp: 90,
    rating: 4,
    color: '#786a87',
    description: 'First egg pickup grants 100 health and speed rating 7.',
    traits: { onCarry: { bonusHp: 100, speedRating: 7 } },
  },
  skeleton: {
    name: 'Skeleton',
    hp: 10,
    rating: 5,
    color: '#b8aa82',
    description: '50% resistance to all dragon attacks.',
    traits: { resist: { all: 0.5 } },
  },
  phantom: {
    name: 'Phantom',
    hp: 80,
    rating: 2,
    color: '#8893a0',
    description: 'Invulnerable for 3 seconds after spawning.',
    traits: { spawnInvulnerableMs: 3000 },
  },
  shade: {
    name: 'Shade',
    hp: 50,
    rating: 2,
    color: '#3e464e',
    description: 'Travels straight to the nest, ignoring the trail.',
    traits: { directPath: true },
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
export function enemyTraits(kind: string): EnemyTraits {
  if (!isDefenseMonster(kind)) return {};
  return (enemyRoster[kind] as EnemyDefinition).traits ?? {};
}
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
