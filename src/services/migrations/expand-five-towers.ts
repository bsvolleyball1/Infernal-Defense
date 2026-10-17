import { gorge as map } from '../../content/maps';
import type { RecordValue } from '../validation/primitives';

/** Version 2 gorge saves written with five tower slots expand to the current perch count. */
export function expandFiveTowerSlots(value: RecordValue): { value: RecordValue; expanded: boolean } {
  if (value.version !== 2 || !value.state || typeof value.state !== 'object' || Array.isArray(value.state))
    return { value, expanded: false };
  const state = value.state as RecordValue;
  if (
    !['level1', 'tutorial'].includes(state.activeLevel as string) ||
    !Array.isArray(state.towers) ||
    state.towers.length !== 5
  )
    return { value, expanded: false };
  return {
    expanded: true,
    value: {
      ...value,
      state: {
        ...state,
        towers: [...state.towers, ...Array(map.perches.length - 5).fill(null)],
      },
    },
  };
}
