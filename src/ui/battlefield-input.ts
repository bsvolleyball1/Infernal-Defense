import { getMap } from '../content/catalog';
import { defenseRules } from '../content/defense-rules';
import { clampToBattlefield } from '../game/geometry';
import type { DragonType, GameCommand, GameState, Point, SpellKind } from '../game/types';
import { element, elements } from './dom';

/** Presentation effects of battlefield input that are not simulation commands. */
export interface BattlefieldView {
  previewPlacement(point: Point | null): void;
  dismissTowerActions(): void;
  reopenTowerActions(): void;
  afterTowerAction(): void;
}

export interface BattlefieldInputActions {
  dispatch: (command: GameCommand) => void;
  readState: () => GameState;
  view: BattlefieldView;
}

const targetingKeys = ['Escape', 'Enter', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
const nudges: Record<string, Point> = {
  ArrowLeft: { x: -defenseRules.spellNudge, y: 0 },
  ArrowRight: { x: defenseRules.spellNudge, y: 0 },
  ArrowUp: { x: 0, y: -defenseRules.spellNudge },
  ArrowDown: { x: 0, y: defenseRules.spellNudge },
};

/** Map coordinates under the pointer, or null when the map has no screen transform yet. */
function toMap(event: MouseEvent, map: SVGSVGElement): Point | null {
  const matrix = map.getScreenCTM();
  if (!matrix) return null;
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  return { x: point.x, y: point.y };
}

function aimPoint(state: GameState): Point {
  const geometry = getMap(state.activeLevel);
  return { x: geometry.width / 2, y: geometry.height / 2 };
}

/**
 * Translates battlefield input into commands: choosing and placing dragons, selecting them,
 * summoning waves and aiming spells. Each handler applies, in order, the popover update, spell
 * targeting (which consumes the event) and then placement or selection.
 */
export function bindBattlefieldInput({ dispatch, readState, view }: BattlefieldInputActions): () => void {
  const controller = new AbortController();
  const { signal } = controller;
  const map = element<SVGSVGElement>('#map');
  let pointer: Point | null = null;

  const spellPoint = (event: MouseEvent): Point =>
    clampToBattlefield(toMap(event, map) ?? { x: event.clientX, y: event.clientY }, getMap(readState().activeLevel));
  const previewPlacement = () => view.previewPlacement(readState().chosen ? pointer : null);
  const summon = () => {
    if (!readState().paused) dispatch({ type: 'startWave' });
  };

  map.addEventListener(
    'click',
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('.tower-marker')) view.reopenTowerActions();
      else view.dismissTowerActions();
      const spell = readState().defense?.targeting;
      if (spell) {
        event.preventDefault();
        event.stopPropagation();
        dispatch({ type: 'spell', spell, point: spellPoint(event) });
        return;
      }
      if (!target) return;
      if (target.closest('.summon-control')) {
        const chosen = readState().chosen;
        if (chosen) dispatch({ type: 'place', point: toMap(event, map) ?? { x: -1, y: -1 } });
        else summon();
        return;
      }
      const tower = target.closest<SVGGElement>('.tower-marker');
      if (tower) dispatch({ type: 'perch', index: Number(tower.dataset.id) });
      else if (readState().chosen) dispatch({ type: 'place', point: toMap(event, map) ?? { x: -1, y: -1 } });
    },
    { capture: true, signal },
  );

  map.addEventListener(
    'keydown',
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const activates = event.key === 'Enter' || event.key === ' ';
      if (activates && target?.closest('.tower-marker')) view.reopenTowerActions();
      if (aimWithKeyboard(event)) return;
      if (!target || !activates) return;
      if (target.closest('.summon-control')) {
        event.preventDefault();
        return summon();
      }
      const tower = target.closest<SVGGElement>('.tower-marker');
      if (tower) {
        event.preventDefault();
        dispatch({ type: 'perch', index: Number(tower.dataset.id) });
      }
    },
    { capture: true, signal },
  );

  /** Arrow keys move the spell aim, Enter casts and Escape cancels. Returns true when consumed. */
  function aimWithKeyboard(event: KeyboardEvent): boolean {
    const defense = readState().defense;
    const spell = defense?.targeting;
    if (!spell || !targetingKeys.includes(event.key)) return false;
    event.preventDefault();
    event.stopPropagation();
    const aim = defense.preview ?? aimPoint(readState());
    if (event.key === 'Escape') dispatch({ type: 'spellTarget', spell: null });
    else if (event.key === 'Enter' || event.key === ' ') dispatch({ type: 'spell', spell, point: aim });
    else {
      const nudge = nudges[event.key];
      const point = clampToBattlefield({ x: aim.x + nudge.x, y: aim.y + nudge.y }, getMap(readState().activeLevel));
      dispatch({ type: 'previewSpell', point });
    }
    return true;
  }

  map.addEventListener(
    'pointermove',
    (event) => {
      if (readState().defense?.targeting) dispatch({ type: 'previewSpell', point: spellPoint(event) });
      pointer = toMap(event, map) ?? { x: -1, y: -1 };
      previewPlacement();
    },
    { signal },
  );
  for (const type of ['pointerleave', 'pointercancel'] as const)
    map.addEventListener(
      type,
      () => {
        pointer = null;
        view.previewPlacement(null);
      },
      { signal },
    );

  elements<HTMLButtonElement>('.tower').forEach((button) =>
    button.addEventListener(
      'click',
      () => {
        dispatch({ type: 'choose', dragon: button.dataset.type as DragonType });
        previewPlacement();
      },
      { signal },
    ),
  );

  elements<HTMLButtonElement>('[data-spell]').forEach((button) =>
    button.addEventListener(
      'click',
      () => {
        const spell = button.dataset.spell as SpellKind;
        if (spell === 'ice') return dispatch({ type: 'spell', spell });
        dispatch({ type: 'spellTarget', spell: readState().defense?.targeting === spell ? null : spell });
        if (!readState().defense?.targeting) return;
        dispatch({ type: 'previewSpell', point: aimPoint(readState()) });
        map.focus();
      },
      { signal },
    ),
  );

  element('.actions').addEventListener(
    'click',
    (event) => {
      if (event.target instanceof Element && event.target.closest('#upgrade, #sell')) view.afterTowerAction();
    },
    { signal },
  );

  return () => controller.abort();
}
