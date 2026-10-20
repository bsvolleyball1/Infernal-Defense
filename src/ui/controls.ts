import { bindEvolutionControls } from './evolution-controls';
import type { GameCommand, GameSpeed, GameState } from '../game/types';
import { element } from './dom';

export interface BattleControlActions {
  dispatch: (command: GameCommand) => void;
  readState: () => GameState;
  isVisible: () => boolean;
  resume: () => void;
  returnHome: () => void;
  save: () => void;
  afterEvolve?: () => void;
}

export function nextGameSpeed(speed: GameSpeed): GameSpeed {
  const speeds: readonly GameSpeed[] = [1, 1.5, 2];
  return speeds[(speeds.indexOf(speed) + 1) % speeds.length];
}

/** Toolbar buttons and window shortcuts; battlefield input lives in BattlefieldInput. */
export function bindBattleControls(actions: BattleControlActions): () => void {
  const controller = new AbortController();
  const { signal } = controller;
  const onClick = (selector: string, callback: () => void) => {
    element(selector).addEventListener('click', callback, { signal });
  };
  onClick('#start', () => actions.dispatch({ type: 'startWave' }));
  const choices = bindEvolutionControls(actions, signal);
  onClick('#upgrade', () => {
    if (actions.readState().defense?.ruleset === 'defense-2') choices.open();
    else actions.dispatch({ type: 'upgrade' });
  });
  onClick('#sell', () => actions.dispatch({ type: 'sell' }));
  onClick('#speed', () => actions.dispatch({ type: 'speed', speed: nextGameSpeed(actions.readState().speed) }));
  onClick('#pause', () => actions.dispatch({ type: actions.readState().paused ? 'resume' : 'pause' }));
  onClick('#resumeBattle', actions.resume);
  onClick('#pauseMenu', () => {
    choices.cancel();
    actions.returnHome();
  });
  onClick('#returnMenu', () => {
    choices.cancel();
    actions.returnHome();
  });
  onClick('#saveProgress', actions.save);
  window.addEventListener('keydown', (event) => handleKeyboard(event, actions), { signal });
  return () => {
    controller.abort();
  };
}

function handleKeyboard(event: KeyboardEvent, actions: BattleControlActions): void {
  if (event.key === 'Escape') {
    if (actions.isVisible() && actions.readState().phase === 'battle') actions.dispatch({ type: 'pause' });
    else actions.returnHome();
  }
  if (event.key !== 'Tab' || !actions.isVisible()) return;
  const modal = element('#gameOver');
  if (!modal.classList.contains('show')) return;
  const buttons = Array.from(modal.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
  const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
  const beyondLast = !event.shiftKey && current === buttons.length - 1;
  const beforeFirst = event.shiftKey && current === 0;
  if (current < 0 || beyondLast || beforeFirst) {
    event.preventDefault();
    (event.shiftKey ? buttons.at(-1) : buttons[0])?.focus();
  }
}
