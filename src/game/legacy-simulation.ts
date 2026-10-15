import { updateEnemies, updateProjectiles, updateTowers } from './combat';
import { produceLegacyBonusGold } from './tower-bonuses';
import { finishWaveIfClear, spawnNextEnemy } from './waves';
import type { GameEvent, LegacyBattle } from './types';

/** One fixed step of the original rules; only a running wave advances. */
export function stepLegacy(state: LegacyBattle, elapsedMs: number): GameEvent[] {
  const events: GameEvent[] = [];
  const simulationElapsedMs = elapsedMs * state.speed;
  state.simulationTime += simulationElapsedMs;
  produceLegacyBonusGold(state, simulationElapsedMs);
  spawnNextEnemy(state);
  updateEnemies(state, simulationElapsedMs, events);
  if (state.phase !== 'battle') return events;
  updateTowers(state, simulationElapsedMs, events);
  updateProjectiles(state, simulationElapsedMs, events);
  finishWaveIfClear(state, events);
  return events;
}
