import { getMap } from '../content/catalog';
import { battleRules } from './rules';
import type { GameState, LegacyBattle, Level, Tower } from './types';

export function createInitialState(level: Level = 'level1', bankedGold = 0): LegacyBattle {
  return {
    phase: 'ready',
    paused: false,
    simulationTime: 0,
    speed: 1,
    gold: battleRules.startingGold,
    bankedGold,
    wave: 0,
    enemiesKilled: 0,
    enemiesSummoned: 0,
    rewardGold: 0,
    rewardsApplied: false,
    activeLevel: level,
    knownMonsters: [],
    selected: null,
    chosen: null,
    towers: Array.from({ length: getMap(level).perches.length }, () => null),
    enemies: [],
    projectiles: [],
    eggs: Array.from({ length: battleRules.eggCount }, (_, index) => ({
      id: index + 1,
      status: 'nest',
      progress: null,
      carrier: null,
    })),
    spawnSchedule: [],
    nextEntityId: battleRules.eggCount + 1,
  };
}

function copyTower(tower: Tower): Tower {
  const copy = { ...tower };
  if (tower.position) copy.position = { ...tower.position };
  if (copy.type === 'fire' && copy.beamIds) copy.beamIds = [...copy.beamIds];
  return copy;
}

/** Copies every mutable collection; snapshots never share entity references. */
export function copyState(state: GameState): GameState {
  return {
    ...state,
    knownMonsters: [...state.knownMonsters],
    ...(state.defense ? { defense: structuredClone(state.defense) } : {}),
    towers: state.towers.map((tower) => (tower ? copyTower(tower) : null)),
    enemies: state.enemies.map((enemy) => ({ ...enemy })),
    projectiles: state.projectiles.map((projectile) => ({ ...projectile })),
    eggs: state.eggs.map((egg) => ({ ...egg })),
    spawnSchedule: state.spawnSchedule.map((spawn) => ({ ...spawn })),
  };
}
