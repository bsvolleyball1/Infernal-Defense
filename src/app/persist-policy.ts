import type { GameCommand } from '../game/types';

/**
 * One persistence decision for a player command or a simulation tick.
 * Spell previews and ticks persist only when events ask for a save.
 * Every other command persists once, even if it also emits a save event.
 */
export function shouldPersist(command: GameCommand | null, eventsRequestSave: boolean): boolean {
  if (command === null || command.type === 'previewSpell') return eventsRequestSave;
  return true;
}
