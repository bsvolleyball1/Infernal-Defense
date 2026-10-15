import { describe, expect, it } from 'vitest';
import { presentBattle, presentTowerLabel } from '../src/ui/battle-view-model';
import { createDefenseState } from '../src/game/defense-state';
import { battleRules } from '../src/game/rules';
import { createInitialState } from '../src/game/state';

describe('battle view model', () => {
  it('describes a ready gorge battle from the rules', () => {
    const view = presentBattle(createInitialState(), true);
    expect(view.wave).toBe(`0 / ${battleRules.waveCount}`);
    expect(view.startLabel).toBe('Begin wave 1');
    expect(view.waveState).toBe('READY');
    expect(view.waveDesc).toBe('Place your dragons, then begin the wave.');
    expect(view.levelHeading).toBe('Emberfall Gorge');
    expect(view.sellLabel).toBe(`Sell dragon · ${Math.round(battleRules.saleFraction * 100)}% refund`);
    expect(view.showResults).toBe(false);
  });

  it('uses the tutorial prompt and a paused battle status', () => {
    const ready = presentBattle(createInitialState('tutorial'), true);
    expect(ready.levelHeading).toBe('Tutorial · Emberfall Gorge');
    expect(ready.waveDesc).toBe('Training exercise: place dragons, then begin the wave.');

    const battle = createInitialState();
    battle.phase = 'battle';
    battle.paused = true;
    battle.wave = 1;
    const view = presentBattle(battle, true);
    expect(view.waveState).toBe('PAUSED');
    expect(view.pauseOverlayHidden).toBe(false);
    expect(view.startLabel).toBe('Wave in progress');
  });

  it('shows a cleared valley and the shared reward line', () => {
    const won = createInitialState();
    won.phase = 'won';
    won.wave = battleRules.waveCount;
    won.rewardsApplied = true;
    won.enemiesKilled = 4;
    won.enemiesSummoned = 4;
    won.rewardGold = 24;
    const view = presentBattle(won, true);
    expect(view.startLabel).toBe('Valley defended');
    expect(view.waveState).toBe('CLEARED');
    expect(view.waveTitle).toBe('The eggs are safe');
    expect(view.showResults).toBe(true);
    expect(view.resultKicker).toBe('All waves cleared');
    expect(view.resultGold).toBe('24 gold');
  });

  it('labels a defense dragon with food and its level cap', () => {
    const state = createDefenseState('tutorial');
    state.towers[0] = { type: 'fire', level: 1, cooldown: 0, position: { x: 90, y: 202 } };
    state.selected = 0;
    const view = presentBattle(state, false);
    expect(view.info).toContain('Ember · Level 1 /');
    expect(view.actionCost.startsWith('🥩')).toBe(true);
    expect(view.placement.find((button) => button.type === 'fire')?.label).toContain('food');
  });
});

describe('single-owner HUD overrides', () => {
  it('shows unlimited food and the Test Mode heading in the sandbox', () => {
    const state = createDefenseState('level1', undefined, true);
    const view = presentBattle(state, true);
    expect(view.gold).toBe('∞');
    expect(view.levelHeading).toBe('Test Mode');
    expect(view.wave).toBe('0');
    expect(view.startLabel).toBe('Summon');
  });

  it('labels the early-summon bonus during a journey countdown and hides the start button', () => {
    const state = createDefenseState('level1');
    state.defense.countdown = 4200;
    const view = presentBattle(state, true);
    expect(view.startHidden).toBe(true);
    expect(view.startLabel).toBe('Summon wave 1 · +50 mana (5s)');
  });

  it('hides and disables dragons a challenge level does not allow', () => {
    const view = presentBattle(createDefenseState('fireTrial'), true);
    expect(view.placement.map(({ type, hidden, disabled }) => [type, hidden, disabled])).toEqual([
      ['fire', false, false],
      ['ice', true, true],
      ['poison', true, true],
    ]);
  });

  it('names a placed dragon by type, level and slot', () => {
    const state = createDefenseState('level1');
    state.towers[0] = { type: 'ice', level: 2, cooldown: 0, position: { x: 90, y: 202 } };
    expect(presentTowerLabel(state, 0)).toMatch(/^Frost, level 2, dragon 1/);
  });
});
