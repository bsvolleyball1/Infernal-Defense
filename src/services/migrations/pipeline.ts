import { expandFiveTowerSlots } from './expand-five-towers';
import { migrateV1ToV2 } from './v1-to-v2';
import { validateSave } from '../save-schema';
import type { SaveDataV2 } from '../save-schema';
import type { RecordValue } from '../validation/primitives';

/** Ordered save migrations: v1 checkpoint to v2, then five-tower v2 slots to the current gorge layout. */
export function readMigratedSave(value: RecordValue): { data: SaveDataV2; migrated: boolean } {
  if (value.version === 1) return { data: migrateV1ToV2(value), migrated: true };
  const expanded = expandFiveTowerSlots(value);
  validateSave(expanded.value);
  return { data: expanded.value as SaveDataV2, migrated: expanded.expanded };
}
