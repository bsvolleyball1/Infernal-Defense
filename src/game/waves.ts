import { getMap, routesFor, waves } from '../content/catalog';
import { finishBattle } from './rewards';
import { battleRules, waveReward } from './rules';
import type { GameEvent, GameState } from './types';

export function startWave(state: GameState): GameEvent[] {
  if (state.phase !== 'ready' || state.wave >= waves.length
    || !state.eggs.some(egg => egg.status !== 'escaped')) return [];
  state.wave++;
  state.phase = 'battle';
  state.paused = false;
  const interval = Math.max(battleRules.minimumSpawnIntervalMs,
    battleRules.initialSpawnIntervalMs - state.wave * battleRules.spawnIntervalReductionMs);
  let at = state.simulationTime;
  state.spawnSchedule = [];
  const routeCount = routesFor(getMap(state.activeLevel)).length;
  for (const group of waves[state.wave - 1]) {
    for (let index = 0; index < group.n; index++) {
      state.spawnSchedule.push({ kind: group.kind, hp: group.hp, spd: group.spd, at,
        ...(routeCount > 1 ? { routeId: state.spawnSchedule.length % routeCount } : {}),
      });
      at += interval;
    }
  }
  return [{ type: 'save' }];
}

export function spawnNextEnemy(state: GameState): void {
  const spawn = state.spawnSchedule[0];
  // Preserve the original one-admission-per-step rule and population cap.
  if (!spawn || spawn.at > state.simulationTime || state.enemies.length >= battleRules.maximumEnemies) return;
  state.spawnSchedule.shift();
  state.enemies.push({
    id: state.nextEntityId++, kind: spawn.kind, hp: spawn.hp, max: spawn.hp,
    spd: spawn.spd, progress: 0, slow: 0, poison: 0, poisonD: 0,
    carryingEgg: null, returning: false, escaped: false, rewarded: false,
    ...(spawn.routeId !== undefined ? { routeId: spawn.routeId } : {}),
  });
  state.enemiesSummoned++;
}

export function finishWaveIfClear(state: GameState, events: GameEvent[]): void {
  if (state.spawnSchedule.length || state.enemies.length) return;
  state.gold += waveReward(state.wave);
  const isFinalWave = state.wave >= waves.length;
  events.push({
    type: 'message',
    text: isFinalWave ? 'All waves repelled · bonus gold awarded'
      : 'Wave ' + state.wave + ' repelled · bonus gold awarded',
  });
  if (isFinalWave) finishBattle(state, true, events);
  else {
    state.phase = 'ready';
    events.push({ type: 'save' });
  }
}
