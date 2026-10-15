import { applyCommand } from './commands';
import { isSimulating, stepBattle } from './ruleset';
import { copyState, createInitialState } from './state';
import type { GameCommand, GameEvent, GameState, SimulationEngine } from './types';

// Preserve the existing public import while keeping construction/copying separate.
export { createInitialState } from './state';

/** Owns battle state; the active ruleset owns the order of simulation operations. */
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

  isRunning(): boolean {
    return !this.state.paused && isSimulating(this.state);
  }

  /** elapsedMs is foreground time; the runtime supplies fixed steps. */
  step(elapsedMs: number): GameEvent[] {
    if (!this.isRunning() || !Number.isFinite(elapsedMs) || elapsedMs <= 0) return [];
    return stepBattle(this.state, elapsedMs);
  }
}
