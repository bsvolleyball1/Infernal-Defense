import { getMap } from '../content/catalog';
import { isInsideBattlefield } from '../game/geometry';
import type { DragonType, Point, SpellKind } from '../game/types';
import type { BattlefieldInputActions } from './battlefield-input';

interface Gesture {
  id: number;
  source: HTMLButtonElement;
  start: Point;
  dragon?: DragonType;
  spell?: SpellKind;
  active: boolean;
}

/** Pointer capture supports the same drag on mouse, pen and touch, without native HTML dragging. */
export function bindBattlefieldDrag(
  { dispatch, readState, view }: BattlefieldInputActions,
  map: SVGSVGElement,
  toMap: (event: MouseEvent, map: SVGSVGElement) => Point | null,
  signal: AbortSignal,
): { readonly active: boolean } {
  let gesture: Gesture | null = null;
  let ghost: HTMLElement | null = null;
  let suppressClick = false;
  const available = () => !readState().paused && ['ready', 'battle'].includes(readState().phase);
  const dropPoint = (event: PointerEvent): Point | null => {
    const hit = document.elementFromPoint(event.clientX, event.clientY);
    if (!hit || !map.contains(hit)) return null;
    const point = toMap(event, map);
    const state = readState();
    const geometry = getMap(state.activeLevel, state.defense?.ruleset, state.defense?.mobileLayout);
    return point && isInsideBattlefield(point, geometry) ? point : null;
  };
  const clear = () => {
    const previous = gesture;
    gesture = null;
    ghost?.remove();
    ghost = null;
    if (!previous) return;
    previous.source.classList.remove('is-dragging');
    if (previous.source.hasPointerCapture(previous.id)) previous.source.releasePointerCapture(previous.id);
    if (!previous.active) return;
    suppressClick = true;
    dispatch({ type: 'cancelPlacement' });
    dispatch({ type: 'spellTarget', spell: null });
    view.previewPlacement(null);
  };
  const begin = (drag: Gesture) => {
    drag.active = true;
    view.dismissTowerActions();
    dispatch({ type: 'cancelPlacement' });
    dispatch({ type: 'spellTarget', spell: null });
    if (drag.dragon) dispatch({ type: 'choose', dragon: drag.dragon });
    else if (drag.spell && drag.spell !== 'ice') dispatch({ type: 'spellTarget', spell: drag.spell });
    drag.source.classList.add('is-dragging');
    ghost = document.createElement('div');
    ghost.className = 'battlefield-drag-ghost';
    ghost.setAttribute('aria-hidden', 'true');
    const icon = drag.source.querySelector('.orb, .spell-icon');
    if (icon) ghost.append(icon.cloneNode(true));
    document.body.append(ghost);
  };
  const move = (event: PointerEvent) => {
    const drag = gesture;
    if (!drag || drag.id !== event.pointerId) return;
    if (!available()) return clear();
    if (!drag.active && Math.hypot(event.clientX - drag.start.x, event.clientY - drag.start.y) < 8) return;
    if (!drag.active) begin(drag);
    event.preventDefault();
    const point = dropPoint(event);
    if (ghost) {
      ghost.style.left = `${event.clientX}px`;
      ghost.style.top = `${event.clientY}px`;
      ghost.classList.toggle('outside-map', !point);
    }
    view.previewPlacement(drag.dragon ? point : null);
    if (point && drag.spell && drag.spell !== 'ice') dispatch({ type: 'previewSpell', point });
  };

  window.addEventListener(
    'pointerdown',
    () => {
      suppressClick = false;
    },
    { capture: true, signal },
  );
  for (const source of document.querySelectorAll<HTMLButtonElement>('.tower, [data-spell]')) {
    source.addEventListener('dragstart', (event) => event.preventDefault(), { signal });
    source.addEventListener(
      'pointerdown',
      (event) => {
        if (gesture || !event.isPrimary || event.button !== 0 || source.disabled || !available()) return;
        gesture = {
          id: event.pointerId,
          source,
          start: { x: event.clientX, y: event.clientY },
          active: false,
          dragon: source.dataset.type as DragonType | undefined,
          spell: source.dataset.spell as SpellKind | undefined,
        };
        source.setPointerCapture(event.pointerId);
      },
      { signal },
    );
    source.addEventListener(
      'lostpointercapture',
      (event) => {
        if (gesture?.id === event.pointerId) clear();
      },
      { signal },
    );
  }
  window.addEventListener('pointermove', move, { capture: true, passive: false, signal });
  window.addEventListener(
    'pointerup',
    (event) => {
      const drag = gesture;
      if (!drag || drag.id !== event.pointerId) return;
      const point = drag.active && available() ? dropPoint(event) : null;
      if (point) {
        if (drag.dragon) dispatch({ type: 'place', point });
        else if (drag.spell) dispatch({ type: 'spell', spell: drag.spell, point });
      }
      clear();
    },
    { capture: true, signal },
  );
  window.addEventListener(
    'click',
    (event) => {
      if (!suppressClick || event.detail === 0) return;
      suppressClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    { capture: true, signal },
  );
  window.addEventListener(
    'pointercancel',
    (event) => {
      if (gesture?.id === event.pointerId) clear();
    },
    { capture: true, signal },
  );
  window.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape' || !gesture?.active) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      clear();
    },
    { capture: true, signal },
  );
  window.addEventListener('blur', clear, { signal });
  window.addEventListener('resize', clear, { signal });
  document.addEventListener('visibilitychange', clear, { signal });
  signal.addEventListener('abort', clear, { once: true });
  return {
    get active() {
      return gesture?.active ?? false;
    },
  };
}
