import { describe, expect, it } from 'vitest';
import { formatGold } from '../src/ui/currency-format';
import { presentBattle } from '../src/ui/battle-view-model';
import { createInitialState } from '../src/game/state';

describe('gold display', () => {
  it.each([
    [0, '0'],
    [12, '12'],
    [0.01, '1'],
    [12.01, '13'],
    [12.99, '13'],
  ])('rounds %s up to %s without decimals', (value, expected) => {
    expect(formatGold(Number(value))).toBe(expected);
  });

  it('rounds battle, reward, and banked gold without mutating the balance', () => {
    const state = createInitialState();
    state.gold = 12.1;
    state.rewardGold = 8.01;
    state.bankedGold = 19.9;
    const view = presentBattle(state, true);
    expect(view.gold).toBe('13');
    expect(view.resultGold).toBe('9 gold');
    expect(view.bankedGold).toBe('20 gold');
    expect(state.gold).toBe(12.1);
    expect(state.rewardGold).toBe(8.01);
    expect(state.bankedGold).toBe(19.9);
  });
});
