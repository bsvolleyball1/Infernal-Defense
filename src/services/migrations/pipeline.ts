import { expandFiveTowerSlots } from './expand-five-towers';
import { migrateV1ToV2 } from './v1-to-v2';
import { normalizeDefenseEntities } from './normalize-defense-entities';
import { validateSave } from '../save-schema';
import type { SaveDataV2 } from '../save-schema';
import type { RecordValue } from '../validation/primitives';

/** Ordered save migrations: v1 to v2, five-tower slots, then defense entity defaults. */
export function readMigratedSave(value: RecordValue): { data: SaveDataV2; migrated: boolean } {
  if (value.version === 1) {
    const data = migrateV1ToV2(value);
    normalizeDefenseEntities(data.state);
    return { data, migrated: true };
  }
  const expanded = expandFiveTowerSlots(value);
  validateSave(expanded.value);
  const data = expanded.value as SaveDataV2;
  const normalized = normalizeDefenseEntities(data.state);
  return { data, migrated: expanded.expanded || normalized };
}
