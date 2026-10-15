import { describe, expect, it } from 'vitest';
import { shouldPersist } from '../src/app/persist-policy';

describe('one save decision', () => {
  it('persists a player command once even when that command also requests a save', () => {
    expect(shouldPersist({ type: 'pause' }, true)).toBe(true);
    expect(shouldPersist({ type: 'upgrade' }, false)).toBe(true);
  });

  it('persists a spell preview only when simulation events request a save', () => {
    expect(shouldPersist({ type: 'previewSpell', point: { x: 1, y: 2 } }, false)).toBe(false);
    expect(shouldPersist({ type: 'previewSpell', point: { x: 1, y: 2 } }, true)).toBe(true);
  });

  it('persists tick events only when they request a save', () => {
    expect(shouldPersist(null, true)).toBe(true);
    expect(shouldPersist(null, false)).toBe(false);
  });
});
