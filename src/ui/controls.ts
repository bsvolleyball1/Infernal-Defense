import type { DragonColor, DragonForm, DragonType, GameCommand, GameSpeed, GameState, Point } from '../game/types';
import { element, elements } from './dom';
import { dragonColors, dragonForms, nextForms } from '../content/dragon-forms';

export interface BattleControlActions {
  dispatch: (command: GameCommand) => void;
  readState: () => GameState;
  isVisible: () => boolean;
  resume: () => void;
  returnHome: () => void;
  save: () => void;
  previewPlacement: (point: Point | null) => void;
}

export function nextGameSpeed(speed: GameSpeed): GameSpeed {
  const speeds: readonly GameSpeed[] = [1, 1.5, 2];
  return speeds[(speeds.indexOf(speed) + 1) % speeds.length];
}

/** Translate browser input into commands; never mutate simulation state here. */
export function bindBattleControls(actions: BattleControlActions): () => void {
  const controller = new AbortController();
  const { signal } = controller;
  const map = element<SVGSVGElement>('#map');
  let mapPointer: Point | null = null;
  elements<HTMLButtonElement>('.tower').forEach(button => {
    button.addEventListener('click', () => actions.dispatch({
      type: 'choose', dragon: button.dataset.type as DragonType,
    }), { signal });
    button.addEventListener('click', () => {
      actions.previewPlacement(actions.readState().chosen ? mapPointer : null);
    }, { signal });
  });
  map.addEventListener('pointermove', event => {
    mapPointer = mapPoint(event, map);
    actions.previewPlacement(actions.readState().chosen ? mapPointer : null);
  }, { signal });
  map.addEventListener('pointerleave', () => {
    mapPointer = null;
    actions.previewPlacement(null);
  }, { signal });
  map.addEventListener('pointercancel', () => {
    mapPointer = null;
    actions.previewPlacement(null);
  }, { signal });
  map.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('.summon-control')) {
      const state = actions.readState();
      if (!state.paused) {
        actions.dispatch(
          state.chosen
            ? { type: 'place', point: mapPoint(event, map) }
            : { type: 'startWave' },
        );
      }
      return;
    }
    const tower = event.target.closest<SVGGElement>('.tower-marker');
    if (tower) {
      actions.dispatch({ type: 'perch', index: Number(tower.dataset.id) });
    } else if (actions.readState().chosen) {
      const point = mapPoint(event, map);
      actions.dispatch({ type: 'place', point });
    }
  }, { signal });
  map.addEventListener('keydown', event => {
    if (!(event.target instanceof Element) || !['Enter', ' '].includes(event.key)) return;
    if (event.target.closest('.summon-control')) {
      event.preventDefault();
      if (!actions.readState().paused) actions.dispatch({ type: 'startWave' });
      return;
    }
    const tower = event.target.closest<SVGGElement>('.tower-marker');
    if (tower) {
      event.preventDefault();
      actions.dispatch({ type: 'perch', index: Number(tower.dataset.id) });
    }
  }, { signal });

  const onClick = (selector: string, callback: () => void) => {
    element(selector).addEventListener('click', callback, { signal });
  };
  onClick('#start', () => actions.dispatch({ type: 'startWave' }));
  const upgradeChoices = element<HTMLElement>('#upgradeChoices');
  let pendingColor: DragonColor | null = null;
  const focusAfterUpgrade = () => {
    const upgrade = element<HTMLButtonElement>('#upgrade');
    (upgrade.disabled ? element<HTMLButtonElement>('#sell') : upgrade).focus();
  };
  const showColorChoices = () => {
    pendingColor = null;
    upgradeChoices.innerHTML = `<span>Choose a color to add</span><div class="upgrade-choice-buttons">${dragonColors
      .map(
        (color) =>
          `<button type="button" data-upgrade-color="${color}" style="--choice-color:${dragonForms[color].color}">${color[0].toUpperCase()}${color.slice(1)}</button>`,
      )
      .join('')}</div>`;
    upgradeChoices.hidden = false;
  };
  element('#upgrade').addEventListener(
    'click',
    () => {
      const state = actions.readState();
      if (state.selected === null || !state.towers[state.selected]) return;
      showColorChoices();
    },
    { signal },
  );
  upgradeChoices.addEventListener(
    'click',
    (event) => {
      if (!(event.target instanceof Element)) return;
      const colorButton = event.target.closest<HTMLButtonElement>('[data-upgrade-color]');
      if (colorButton) {
        const color = colorButton.dataset.upgradeColor as DragonColor;
        const state = actions.readState();
        const tower = state.selected === null ? null : state.towers[state.selected];
        if (!tower || !dragonColors.includes(color)) return;
        const forms = nextForms(tower, color);
        if (forms.length === 1) {
          upgradeChoices.hidden = true;
          actions.dispatch({ type: 'upgrade', color, form: forms[0] });
          focusAfterUpgrade();
        } else if (forms.length > 1) {
          pendingColor = color;
          upgradeChoices.innerHTML = `<span>Choose the resulting form</span><div class="upgrade-choice-buttons">${forms
            .map((form) => {
              const definition = dragonForms[form];
              return `<button type="button" data-upgrade-form="${form}" style="--choice-color:${definition.color}"><strong>${definition.name}</strong><small>${definition.description}</small></button>`;
            })
            .join('')}</div>`;
          upgradeChoices.querySelector<HTMLButtonElement>('[data-upgrade-form]')?.focus();
        }
        return;
      }
      const formButton = event.target.closest<HTMLButtonElement>('[data-upgrade-form]');
      if (!formButton || !pendingColor) return;
      const form = formButton.dataset.upgradeForm as DragonForm;
      if (!Object.prototype.hasOwnProperty.call(dragonForms, form)) return;
      upgradeChoices.hidden = true;
      actions.dispatch({ type: 'upgrade', color: pendingColor, form });
      pendingColor = null;
      focusAfterUpgrade();
    },
    { signal },
  );
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
  };
}

function mapPoint(event: MouseEvent, map: SVGSVGElement): { x: number; y: number } {
  const matrix = map.getScreenCTM();
  if (!matrix) return { x: -1, y: -1 };
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  return { x: point.x, y: point.y };
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
