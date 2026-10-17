export type DragonType = 'fire' | 'ice' | 'poison';
export type DragonColor = 'red' | 'blue' | 'yellow';
export type DragonForm =
  | 'red'
  | 'blue'
  | 'yellow'
  | 'red2'
  | 'purple'
  | 'orange'
  | 'blue2'
  | 'green'
  | 'yellow2'
  | 'red3'
  | 'bloodRed'
  | 'pink'
  | 'blue3'
  | 'black'
  | 'gray'
  | 'yellow3'
  | 'sun'
  | 'turquoise'
  | 'white'
  | 'purple2'
  | 'orange2'
  | 'green2';
export type MonsterKind = 'scout' | 'shield' | 'runner' | 'chief' | 'imp' | 'seaSerpent' | 'demon' | 'hellhound' | 'fury' | 'devil' | 'ghost' | 'gargoyle' | 'witch' | 'hag' | 'troll' | 'necromancer' | 'zombieTrain' | 'lich' | 'skeleton' | 'phantom' | 'shade';
export type SpellKind = 'poison' | 'ice' | 'fire';
export interface Point { x: number; y: number }
export interface DefenseState {
  ruleset: 'defense-1';
  mode: 'journey' | 'sandbox';
  ranks: Record<DragonType, number[]>;
  mana: number;
  maxMana: number;
  rng: number;
  countdown: number | null;
  spellCooldowns: Record<SpellKind, number>;
  targeting: 'poison' | 'fire' | null;
  preview: Point | null;
  impacts: { id: number; x: number; y: number; remaining: number; damage: number }[];
  visuals: { id: number; kind: SpellKind; x: number; y: number; radius: number; remaining: number; color?: string }[];
  testWave: Partial<Record<MonsterKind, number>>;
}
export type Level =
  | 'level1'
  | 'tutorial'
  | 'meadow'
  | 'volcanic'
  | 'fireTrial'
  | 'iceTrial'
  | 'poisonTrial'
  | 'noPoisonTrial'
  | 'noIceTrial'
  | 'noFireTrial';
export type GamePhase = 'ready' | 'battle' | 'won' | 'lost';
export type GameSpeed = 1 | 1.5 | 2;

export interface Tower {
  type: DragonType;
  level: number;
  /** Upgrade colors are unordered for determining the evolved form. */
  colors?: DragonColor[];
  form?: DragonForm;
  /** Coordinates are absent only on pre-free-placement saves. */
  position?: Point;
  /** Remaining simulation milliseconds before the next shot. */
  cooldown: number;
  charges?: number;
  chargeTimer?: number;
  beamIds?: number[];
}

export interface Enemy {
  /** Omitted for legacy single-route battles. */
  routeId?: number;
  id: number;
  kind: MonsterKind;
  hp: number;
  max: number;
  spd: number;
  progress: number;
  slow: number;
  poison: number;
  poisonD: number;
  carryingEgg: number | null;
  returning: boolean;
  escaped: boolean;
  rewarded: boolean;
  frozen?: number;
  poisonDamage?: number;
  poisonDamageMultiplier?: number;
  poisonSource?: DragonType | 'spell';
  nullified?: number;
  untargetable?: number;
  ghostTriggered?: boolean;
  invulnerable?: number;
  deathDelay?: number;
  lastHitAgo?: number;
  summonClock?: number;
  summonPause?: number;
  empowered?: boolean;
}

export interface Projectile {
  id: number;
  x: number;
  y: number;
  targetId: number;
  dragon: DragonType;
  damage: number;
  /** Extra tower bonus applied to damage-over-time effects when the shot lands. */
  damageMultiplier?: number;
  speed: number;
  level: number;
  towerIndex?: number;
  freezeChance?: number;
  poisonDuration?: number;
  slowDuration?: number;
}

export interface Egg {
  /** Route on which the egg is carried or dropped. */
  routeId?: number;
  id: number;
  status: 'nest' | 'carried' | 'dropped' | 'escaped';
  progress: number | null;
  carrier: number | null;
  returnTimer?: number;
  direct?: boolean;
}

export interface Spawn {
  routeId?: number;
  kind: MonsterKind;
  hp: number;
  spd: number;
  /** Absolute simulation timestamp in milliseconds. */
  at: number;
}

/** Save-file schema versions belong to persistence, not the simulation. */
export interface GameState {
  /** Missing means the original ruleset, retained for interrupted legacy saves. */
  defense?: DefenseState;
  phase: GamePhase;
  paused: boolean;
  simulationTime: number;
  speed: GameSpeed;
  gold: number;
  bankedGold: number;
  wave: number;
  enemiesKilled: number;
  enemiesSummoned: number;
  rewardGold: number;
  rewardsApplied: boolean;
  activeLevel: Level;
  knownMonsters: string[];
  selected: number | null;
  chosen: DragonType | null;
  towers: (Tower | null)[];
  enemies: Enemy[];
  projectiles: Projectile[];
  eggs: Egg[];
  spawnSchedule: Spawn[];
  nextEntityId: number;
}

export type GameCommand =
  | { type: 'choose'; dragon: DragonType }
  | { type: 'perch'; index: number }
  | { type: 'place'; point: Point }
  | { type: 'upgrade'; color?: DragonColor; form?: DragonForm }
  | { type: 'sell' }
  | { type: 'startWave' }
  | { type: 'spell'; spell: SpellKind; point?: Point }
  | { type: 'spellTarget'; spell: 'poison' | 'fire' | null }
  | { type: 'previewSpell'; point: Point }
  | { type: 'buyPermanent'; dragon: DragonType; node: number }
  | { type: 'testWave'; counts: Partial<Record<MonsterKind, number>> }
  | { type: 'speed'; speed: GameSpeed }
  | { type: 'pause' }
  | { type: 'resume' };

export type GameEvent =
  | { type: 'message'; text: string }
  | { type: 'sound'; dragon: DragonType }
  | { type: 'discovery'; kind: MonsterKind }
  | { type: 'save' }
  | { type: 'result' };

/** Application/runtime depend on this contract, not engine implementation details. */
export interface SimulationEngine {
  readonly state: GameState;
  dispatch(command: GameCommand): GameEvent[];
  step(elapsedMs: number): GameEvent[];
  snapshot(): GameState;
  restore(state: GameState): void;
}
