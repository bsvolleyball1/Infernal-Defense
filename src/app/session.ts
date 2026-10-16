import { createJourney, recordJourneyResult } from '../game/journey';
import type { JourneyProgress } from '../game/journey';
import type { GameState } from '../game/types';
import type { WriteResult } from '../services/storage';

export interface SessionHooks {
  readState: () => GameState;
  snapshot: () => GameState;
  restore: (state: GameState) => void;
  pause: () => void;
  saveSlot: (index: number, state: GameState, progress: JourneyProgress) => WriteResult;
  onSaved: () => void;
  onReported: (slot: number) => void;
  onWriteSuccess: () => void;
  onWriteFailure: (result: Extract<WriteResult, { ok: false }>) => void;
}

/** Owns the selected slot and journey. A commit changes them only after the write succeeds. */
export class GameSession {
  slot: number | null = null;
  journey: JourneyProgress = createJourney();

  constructor(private readonly hooks: SessionHooks) {}

  save(report = false): boolean {
    if (this.slot === null) return true;
    this.journey = recordJourneyResult(this.journey, this.hooks.readState());
    if (!this.write(this.slot, this.hooks.snapshot(), this.journey)) return false;
    if (report) this.hooks.onReported(this.slot);
    this.hooks.onSaved();
    return true;
  }

  /** Commit level or player changes only after their complete save succeeds. */
  commit(index: number, state: GameState, progress: JourneyProgress): boolean {
    if (!this.write(index, state, progress)) return false;
    this.slot = index;
    this.hooks.restore(state);
    this.journey = progress;
    this.hooks.onSaved();
    return true;
  }

  private write(index: number, state: GameState, progress: JourneyProgress): boolean {
    const result = this.hooks.saveSlot(index, state, progress);
    if (!result.ok) {
      if (result.code === 'conflict') this.hooks.pause();
      this.hooks.onWriteFailure(result);
      return false;
    }
    this.hooks.onWriteSuccess();
    return true;
  }
}
