import { applyCommand } from './commands';
import { updateEnemies, updateProjectiles, updateTowers } from './combat';
import { copyState, createInitialState } from './state';
import { finishWaveIfClear, spawnNextEnemy } from './waves';
import type { GameCommand, GameEvent, GameState, SimulationEngine } from './types';

// Preserve the existing public import while keeping construction/copying separate.
export { createInitialState } from './state';

/** Owns battle state and the order of pure-domain simulation operations. */
export class GameEngine implements SimulationEngine {
  state: GameState;

  constructor(state: GameState = createInitialState()) {
    this.state = copyState(state);
  }

  snapshot(): GameState {
    return copyState(this.state);
  }

  /** Restore exactly; browser lifecycle policy belongs to the application. */
  restore(state: GameState): void {
    this.state = copyState(state);
  }

  dispatch(command: GameCommand): GameEvent[] {
    return applyCommand(this.state, command);
  }

  /** elapsedMs is foreground time; the runtime supplies fixed steps. */
  step(elapsedMs: number): GameEvent[] {
    const state = this.state;
    if (state.paused || state.phase !== 'battle' || !Number.isFinite(elapsedMs) || elapsedMs <= 0) return [];
    const events: GameEvent[] = [];
    const simulationElapsedMs = elapsedMs * state.speed;
    state.simulationTime += simulationElapsedMs;
    spawnNextEnemy(state);
    updateEnemies(state, simulationElapsedMs, events);
    if (state.phase !== 'battle') return events;
    updateTowers(state, simulationElapsedMs, events);
    updateProjectiles(state, simulationElapsedMs, events);
    finishWaveIfClear(state, events);
    return events;
  }
}
