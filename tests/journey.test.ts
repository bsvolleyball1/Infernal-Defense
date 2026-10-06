import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/game/engine';
import { createJourney, importJourney, recordJourneyResult } from '../src/game/journey';
import type { JourneyProgress } from '../src/game/journey';
import { SaveRepository } from '../src/services/storage';

function repository() {
  const values = new Map<string, string>();
  const saves = new SaveRepository({ getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } });
  return { values, saves };
}

describe('player journeys, not per-level saves', () => {
  it('persists an empty player before selecting a level', () => {
    const { saves } = repository();
    expect(saves.saveSlot(0, createInitialState(), createJourney())).toEqual({ ok: true });
    expect(saves.readSlot(0)).toMatchObject({ status: 'valid', data: { journey: { activeBattle: false, completedLevels: [] } } });
  });

  it('keeps completed levels, banked rewards and discoveries when the one battle is replaced', () => {
    const { values, saves } = repository();
    const won = createInitialState(); won.phase = 'won'; won.wave = 5; won.rewardsApplied = true;
    won.bankedGold = 62; won.rewardGold = 62; won.knownMonsters = ['scout'];
    const journey = recordJourneyResult({ activeBattle: true, completedLevels: [] }, won);
    expect(saves.saveSlot(0, won, journey).ok).toBe(true);
    const next = createInitialState('meadow', won.bankedGold); next.knownMonsters = [...won.knownMonsters];
    expect(saves.saveSlot(0, next, { ...journey, activeBattle: true }).ok).toBe(true);
    expect(values.size).toBe(1);
    expect(saves.readSlot(0)).toMatchObject({ status: 'valid', data: { journey: { activeBattle: true, completedLevels: ['level1'] },
      state: { activeLevel: 'meadow', bankedGold: 62, knownMonsters: ['scout'], towers: [null, null, null, null, null] } } });
  });

  it('records a victory idempotently, without altering battle rewards or replaying payouts', () => {
    const state = createInitialState('volcanic', 100); state.phase = 'won'; state.wave = 5; state.rewardsApplied = true;
    const once = recordJourneyResult({ activeBattle: true, completedLevels: ['level1'] }, state);
    expect(recordJourneyResult(once, state)).toEqual({ activeBattle: false, completedLevels: ['level1', 'volcanic'] });
    expect(state.bankedGold).toBe(100);
  });

  it('finishes a failed attempt without clearing previous victories', () => {
    const state = createInitialState('meadow'); state.phase = 'lost';
    expect(recordJourneyResult({ activeBattle: true, completedLevels: ['level1'] }, state)).toEqual({ activeBattle: false, completedLevels: ['level1'] });
  });

  it.each(['ready', 'battle', 'won', 'lost'] as const)('imports legacy %s snapshots conservatively', phase => {
    const state = createInitialState('meadow'); state.phase = phase;
    expect(importJourney(state)).toEqual({ activeBattle: phase === 'ready' || phase === 'battle', completedLevels: phase === 'won' ? ['meadow'] : [] });
  });

  it('keeps independent player slots rather than assigning slots to levels', () => {
    const { saves } = repository();
    expect(saves.saveSlot(0, createInitialState('meadow', 50), { activeBattle: true, completedLevels: ['level1'] }).ok).toBe(true);
    expect(saves.saveSlot(1, createInitialState('meadow', 90), { activeBattle: true, completedLevels: ['volcanic'] }).ok).toBe(true);
    expect(saves.readSlot(0)).toMatchObject({ data: { state: { bankedGold: 50 }, journey: { completedLevels: ['level1'] } } });
    expect(saves.readSlot(1)).toMatchObject({ data: { state: { bankedGold: 90 }, journey: { completedLevels: ['volcanic'] } } });
  });

  it('preserves campaign metadata when a compatibility caller saves only battle state', () => {
    const { saves } = repository(); const state = createInitialState('meadow', 50);
    expect(saves.saveSlot(0, state, { activeBattle: true, completedLevels: ['level1'] }).ok).toBe(true);
    state.gold = 100; expect(saves.saveSlot(0, state).ok).toBe(true);
    expect(saves.readSlot(0)).toMatchObject({ data: { journey: { activeBattle: true, completedLevels: ['level1'] } } });
  });

  it.each([
    { activeBattle: 'yes', completedLevels: [] }, { activeBattle: false, completedLevels: ['unknown'] },
    { activeBattle: false, completedLevels: ['level1', 'level1'] }, { activeBattle: false, completedLevels: null },
  ])('preserves unreadable player metadata rather than resetting it', progress => {
    const { values, saves } = repository(); const raw = JSON.stringify({ version: 2, savedAt: 1, state: createInitialState(), journey: progress });
    values.set('infernalDefense.save.0', raw);
    expect(saves.readSlot(0).status).toBe('error'); expect(values.get('infernalDefense.save.0')).toBe(raw);
  });

  it('rejects a hidden unfinished battle in an inactive player save', () => {
    const { saves } = repository(); const state = createInitialState(); state.towers[0] = { type: 'fire', level: 1, cooldown: 0 };
    expect(saves.saveSlot(0, state, createJourney()).ok).toBe(false);
  });

  it('requires a completed victory to be recorded and not marked active', () => {
    const { saves } = repository(); const state = createInitialState(); state.phase = 'won'; state.wave = 5; state.rewardsApplied = true;
    for (const progress of [{ activeBattle: true, completedLevels: ['level1'] }, createJourney()] as JourneyProgress[]) {
      expect(saves.saveSlot(0, state, progress).ok).toBe(false);
    }
  });
});
