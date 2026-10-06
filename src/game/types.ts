export type DragonType = 'fire' | 'ice' | 'poison';
export type MonsterKind = 'scout' | 'shield' | 'runner' | 'chief';
export type Level = 'level1' | 'tutorial';
export type GamePhase = 'ready' | 'battle' | 'won' | 'lost';
export type GameSpeed = 1 | 1.5 | 2;

export interface Tower {
  type: DragonType;
  level: number;
  /** Remaining simulation milliseconds before the next shot. */
  cooldown: number;
}

export interface Enemy {
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
}

export interface Projectile {
  id: number;
  x: number;
  y: number;
  targetId: number;
  dragon: DragonType;
  damage: number;
  speed: number;
  level: number;
}

export interface Egg {
  id: number;
  status: 'nest' | 'carried' | 'dropped' | 'escaped';
  progress: number | null;
  carrier: number | null;
}

export interface Spawn {
  kind: MonsterKind;
  hp: number;
  spd: number;
  /** Absolute simulation timestamp in milliseconds. */
  at: number;
}

/** Save-file schema versions belong to persistence, not the simulation. */
export interface GameState {
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
  | { type: 'upgrade' }
  | { type: 'sell' }
  | { type: 'startWave' }
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
