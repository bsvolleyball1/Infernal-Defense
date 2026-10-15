import { describe, expect, it } from 'vitest';
import { GameSession } from '../src/app/session';
import { createJourney } from '../src/game/journey';
import { createInitialState } from '../src/game/state';
import { SaveRepository } from '../src/services/storage';
import type { GameState } from '../src/game/types';
import type { WriteResult } from '../src/services/storage';

function harness(stored = new Map<string, string>()) {
  const repository = new SaveRepository({
    getItem: (key) => stored.get(key) ?? null,
    setItem: (key, value) => {
      stored.set(key, value);
    },
  });
  let state: GameState = createInitialState();
  let paused = 0;
  let saved = 0;
  const failures: WriteResult[] = [];
  const restored: GameState[] = [];
  const session = new GameSession({
    readState: () => state,
    snapshot: () => state,
    restore: (next) => {
      restored.push(next);
      state = next;
    },
    pause: () => {
      paused += 1;
    },
    saveSlot: (index, snapshot, progress) => repository.saveSlot(index, snapshot, progress),
    onSaved: () => {
      saved += 1;
    },
    onReported: () => {},
    onWriteSuccess: () => {},
    onWriteFailure: (result) => {
      failures.push(result);
    },
  });
  return {
    stored,
    repository,
    session,
    restored,
    get state() {
      return state;
    },
    set state(next: GameState) {
      state = next;
    },
    get paused() {
      return paused;
    },
    get saved() {
      return saved;
    },
    get failures() {
      return failures;
    },
  };
}

describe('journey session', () => {
  it('does not write when no slot is selected', () => {
    const { session, stored, saved } = harness();
    expect(session.save()).toBe(true);
    expect(stored.size).toBe(0);
    expect(saved).toBe(0);
  });

  it('adopts a slot only after the commit write succeeds', () => {
    const game = harness();
    const progress = createJourney();
    const state = createInitialState();
    expect(game.session.commit(0, state, progress)).toBe(true);
    expect(game.session.slot).toBe(0);
    expect(game.session.journey).toEqual(progress);
    expect(game.restored).toEqual([state]);
    expect(game.saved).toBe(1);
  });

  it('leaves the previous slot in place when a commit conflicts', () => {
    const stored = new Map<string, string>([['infernalDefense.save.0', 'newer-tab']]);
    const game = harness(stored);
    expect(game.session.commit(0, createInitialState(), createJourney())).toBe(false);
    expect(game.session.slot).toBeNull();
    expect(game.restored).toEqual([]);
    expect(game.paused).toBe(1);
    expect(game.failures[0]).toMatchObject({ ok: false, code: 'conflict' });
  });

  it('records a cleared level when the open slot is saved', () => {
    const game = harness();
    expect(game.session.commit(1, createInitialState(), { activeBattle: true, completedLevels: [] })).toBe(true);
    const won = game.state;
    won.phase = 'won';
    won.wave = 5;
    won.rewardsApplied = true;
    won.rewardGold = 10;
    expect(game.session.save()).toBe(true);
    expect(game.session.journey).toEqual({ activeBattle: false, completedLevels: ['level1'] });
    expect(game.repository.readSlot(1)).toMatchObject({
      status: 'valid',
      data: { journey: { activeBattle: false, completedLevels: ['level1'] } },
    });
  });
});
