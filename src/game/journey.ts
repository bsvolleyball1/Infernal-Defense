import type { GameState, Level } from './types';

/** Player progress is outside the engine's one-battle snapshot. */
export interface JourneyProgress {
  activeBattle: boolean;
  completedLevels: Level[];
}

export const challengeLevels: readonly Level[] = ['fireTrial', 'iceTrial', 'poisonTrial'];

export function levelPrerequisite(level: Level): Level | null {
  const index = challengeLevels.indexOf(level);
  return index > 0 ? challengeLevels[index - 1] : null;
}

export function isLevelUnlocked(level: Level, journey: JourneyProgress): boolean {
  const prerequisite = levelPrerequisite(level);
  return prerequisite === null || journey.completedLevels.includes(prerequisite);
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
