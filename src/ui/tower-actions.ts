import { element } from './dom';
import type { GameState } from '../game/types';

const margin = 8;
const gap = 8;

function marker(index: number): SVGGElement | null {
  return element<SVGSVGElement>('#map').querySelector<SVGGElement>(`.tower-marker[data-id="${index}"]`);
}

/**
 * The upgrade/sell popover beside the selected dragon. A selection stays chosen in the
 * simulation while the player dismisses the popover; choosing another dragon reopens it.
 */
export class TowerActionsPopover {
  private selected: number | null = null;
  private dismissed: number | null = null;
  private readonly controller = new AbortController();

  constructor() {
    const reposition = () => this.position();
    window.addEventListener('resize', reposition, { signal: this.controller.signal });
    window.addEventListener('scroll', reposition, { capture: true, signal: this.controller.signal });
  }

  /** Follows the simulation's selected dragon; a different selection clears a dismissal. */
  sync(state: GameState): void {
    const tower = state.selected === null ? null : state.towers[state.selected];
    const selected = tower ? state.selected : null;
    if (selected !== this.selected) this.dismissed = null;
    this.selected = selected;
  }

  /** True while a dragon is selected and its popover has not been dismissed. */
  isOpenFor(index: number | null): boolean {
    return index !== null && index === this.selected && index !== this.dismissed;
  }

  isDismissed(index: number): boolean {
    return index === this.dismissed;
  }

  reopen(): void {
    this.dismissed = null;
  }

  /** Hides the popover and the selected dragon's highlight until it is chosen again. */
  dismiss(): void {
    this.dismissed = this.selected;
    this.position();
    if (this.selected !== null) {
      const perch = marker(this.selected);
      if (perch) perch.style.filter = '';
    }
  }

  /** After upgrading or selling, close the popover and return focus to the dragon. */
  dismissAfterAction(): void {
    this.dismissed = this.selected;
    if (this.selected !== null) element<SVGGElement>(`#map .tower-marker[data-id="${this.selected}"]`).focus();
    this.position();
  }

  position(): void {
    const actions = element<HTMLElement>('.actions');
    const perch = this.isOpenFor(this.selected) && this.selected !== null ? marker(this.selected) : null;
    if (!perch) {
      actions.hidden = true;
      return;
    }
    actions.hidden = false;
    const tower = perch.getBoundingClientRect();
    const popup = actions.getBoundingClientRect();
    const centerX = tower.left + tower.width / 2;
    const left = Math.max(popup.width / 2 + margin, Math.min(centerX, window.innerWidth - popup.width / 2 - margin));
    const above = tower.top - gap;
    const fitsAbove = above - popup.height >= margin;
    const top = fitsAbove ? above : Math.min(tower.bottom + gap, window.innerHeight - popup.height - margin);
    actions.dataset.placement = fitsAbove ? 'above' : 'below';
    actions.style.left = `${left}px`;
    actions.style.top = `${Math.max(margin, top)}px`;
  }

  dispose(): void {
    this.controller.abort();
  }
}
