import type { GameState, Level } from './types';

/** Player progress is outside the engine's one-battle snapshot. */
export interface JourneyProgress {
  activeBattle: boolean;
  completedLevels: Level[];
}

export function createJourney(): JourneyProgress {
  return { activeBattle: false, completedLevels: [] };
}

/** Older saves can recover their current result, not unrecorded level history. */
export function importJourney(state: GameState): JourneyProgress {
  return {
    activeBattle: state.phase === 'ready' || state.phase === 'battle',
    completedLevels: state.phase === 'won' ? [state.activeLevel] : [],
  };
}

export function recordJourneyResult(journey: JourneyProgress, state: GameState): JourneyProgress {
  if (state.phase !== 'won' && state.phase !== 'lost') return journey;
  return {
    activeBattle: false,
    completedLevels: state.phase === 'won'
      ? [...new Set([...journey.completedLevels, state.activeLevel])] : [...journey.completedLevels],
  };
}
