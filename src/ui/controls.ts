import type { DragonType, GameCommand, GameSpeed, GameState } from '../game/types';
import { element, elements } from './dom';

export interface BattleControlActions {
  dispatch: (command: GameCommand) => void;
  readState: () => GameState;
  isVisible: () => boolean;
  resume: () => void;
  returnHome: () => void;
  save: () => void;
}

export function nextGameSpeed(speed: GameSpeed): GameSpeed {
  const speeds: readonly GameSpeed[] = [1, 1.5, 2];
  return speeds[(speeds.indexOf(speed) + 1) % speeds.length];
}

/** Translate browser input into commands; never mutate simulation state here. */
export function bindBattleControls(actions: BattleControlActions): () => void {
  const controller = new AbortController();
  const { signal } = controller;
  elements<HTMLButtonElement>('.tower').forEach(button => {
    button.addEventListener('click', () => actions.dispatch({
      type: 'choose', dragon: button.dataset.type as DragonType,
    }), { signal });
  });
  elements<SVGGElement>('.perch').forEach(perch => bindPerch(perch, actions.dispatch, signal));
  const touchSizer = new ResizeObserver(sizePerchTargets);
  touchSizer.observe(element('#map'));

  const onClick = (selector: string, callback: () => void) => {
    element(selector).addEventListener('click', callback, { signal });
  };
  onClick('#start', () => actions.dispatch({ type: 'startWave' }));
  onClick('#upgrade', () => actions.dispatch({ type: 'upgrade' }));
  onClick('#sell', () => actions.dispatch({ type: 'sell' }));
  onClick('#speed', () => actions.dispatch({ type: 'speed', speed: nextGameSpeed(actions.readState().speed) }));
  onClick('#pause', () => actions.dispatch({ type: actions.readState().paused ? 'resume' : 'pause' }));
  onClick('#resumeBattle', actions.resume);
  onClick('#pauseMenu', actions.returnHome);
  onClick('#returnMenu', actions.returnHome);
  onClick('#saveProgress', actions.save);
  window.addEventListener('keydown', event => handleKeyboard(event, actions), { signal });
  return () => {
    controller.abort();
    touchSizer.disconnect();
  };
}

function bindPerch(perch: SVGGElement, dispatch: BattleControlActions['dispatch'], signal: AbortSignal): void {
  perch.setAttribute('role', 'button');
  perch.setAttribute('tabindex', '0');
  // Keep visible artwork unchanged while enlarging the transparent touch area.
  const hit = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  hit.setAttribute('r', '60');
  hit.setAttribute('fill', 'transparent');
  hit.setAttribute('pointer-events', 'all');
  perch.append(hit);
  const activate = () => {
    if (perch.getAttribute('aria-disabled') !== 'true') {
      dispatch({ type: 'perch', index: Number(perch.dataset.id) });
    }
  };
  perch.addEventListener('click', activate, { signal });
  perch.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activate();
    }
  }, { signal });
}

function sizePerchTargets(): void {
  const scale = element<SVGSVGElement>('#map').getScreenCTM();
  if (!scale || !scale.a || !scale.d) return;
  const minimumTouchRadiusPx = 22;
  const visiblePerchRadius = 27;
  const radius = Math.max(visiblePerchRadius,
    minimumTouchRadiusPx / Math.min(Math.abs(scale.a), Math.abs(scale.d)));
  elements<SVGGElement>('.perch').forEach(perch => {
    perch.lastElementChild?.setAttribute('r', String(radius));
  });
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
