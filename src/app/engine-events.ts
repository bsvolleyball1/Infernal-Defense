import type { DragonType, GameEvent } from '../game/types';
import type { BestiaryStore } from './bestiary-store';

export interface EngineEventHooks {
  bestiary: Pick<BestiaryStore, 'record'>;
  notify(text: string): void;
  playSound(dragon: DragonType): void;
  onResult(): void;
}

/** Applies engine events to the outside world. Returns whether any of them asks for a save. */
export function applyEngineEvents(events: GameEvent[], hooks: EngineEventHooks): boolean {
  let needsSave = false;
  for (const event of events) {
    switch (event.type) {
      case 'message':
        hooks.notify(event.text);
        break;
      case 'sound':
        hooks.playSound(event.dragon);
        break;
      case 'save':
        needsSave = true;
        break;
      case 'result':
        hooks.onResult();
        needsSave = true;
        break;
      case 'discovery':
        hooks.bestiary.record(event.kind);
        needsSave = true;
        break;
      default: {
        const unexpected: never = event;
        throw new Error(`Unexpected engine event: ${JSON.stringify(unexpected)}`);
      }
    }
  }
  return needsSave;
}
