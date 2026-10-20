import type { DragonColor, DragonForm, DragonType, Level, MonsterKind, SpellKind } from '../domain/model';

export type { DragonColor, DragonForm, DragonType, Level, MonsterKind, SpellKind };
export interface Point {
  x: number;
  y: number;
}
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
export type GamePhase = 'ready' | 'battle' | 'won' | 'lost';
export type GameSpeed = 1 | 1.5 | 2;

interface TowerCore {
  level: number;
  /** Upgrade colors are unordered for determining the evolved form. */
  colors?: DragonColor[];
  form?: DragonForm;
  /** Coordinates are absent only on pre-free-placement saves. */
  position?: Point;
  /** Remaining simulation milliseconds before the next shot. */
  cooldown: number;
}

/** Fire dragons track the enemies their beams currently burn. */
export interface FireTower extends TowerCore {
  type: 'fire';
  beamIds?: number[];
  charges?: undefined;
  chargeTimer?: undefined;
}

/** Ice dragons store charges and spend them all at once. */
export interface IceTower extends TowerCore {
  type: 'ice';
  charges?: number;
  chargeTimer?: number;
  beamIds?: undefined;
}

export interface PoisonTower extends TowerCore {
  type: 'poison';
  charges?: undefined;
  chargeTimer?: undefined;
  beamIds?: undefined;
}

export type Tower = FireTower | IceTower | PoisonTower;

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
  /** Canonical payload. Older saves store the three fields above until they are read. */
  effect?: ProjectileEffect;
}

export type ProjectileEffect =
  { kind: 'none' } | { kind: 'freeze'; chance: number } | { kind: 'poison'; duration: number; slow: number };

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

/** Fields shared by both rulesets. Save-file schema versions belong to persistence, not the simulation. */
export interface BattleCore {
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

/** The original rules, retained for interrupted legacy saves. */
export interface LegacyBattle extends BattleCore {
  defense?: undefined;
}

/** The `defense-1` rules used by every new journey and level. */
export interface DefenseBattle extends BattleCore {
  defense: DefenseState;
}

/**
 * Tagged by the presence of `defense`, so `if (state.defense)` narrows to `DefenseBattle`
 * while the stored snapshot keeps its existing shape.
 */
export type GameState = LegacyBattle | DefenseBattle;

export function isDefenseBattle(state: GameState): state is DefenseBattle {
  return state.defense !== undefined;
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
  /** True while unpaused in a phase whose ruleset advances simulation time. */
  isRunning(): boolean;
  snapshot(): GameState;
  restore(state: GameState): void;
}
