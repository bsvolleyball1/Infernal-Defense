import { element } from './dom';
import type { GameState } from '../game/types';

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
    window.visualViewport?.addEventListener('resize', reposition, { signal: this.controller.signal });
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
    if (!perch || !element<HTMLElement>('#pauseOverlay').hidden) {
      actions.hidden = true;
      return;
    }
    actions.hidden = false;
    const safe = element('#viewportSafeArea').getBoundingClientRect();
    const controls = element('#battleMiddle').getBoundingClientRect();
    const status = element('#battleStatus').getBoundingClientRect();
    const dragons = element('#battleDragons').getBoundingClientRect();
    const spells = element('#battleSpells').getBoundingClientRect();
    const topEdge = Math.max(safe.top, controls.bottom + gap, status.bottom + gap);
    const bottomEdge = Math.min(safe.bottom, dragons.top - gap, spells.height ? spells.top - gap : safe.bottom);
    actions.style.maxHeight = `${Math.max(44, bottomEdge - topEdge)}px`;
    const tower = perch.getBoundingClientRect();
    const popup = actions.getBoundingClientRect();
    const centerX = tower.left + tower.width / 2;
    const left = Math.max(popup.width / 2 + safe.left, Math.min(centerX, safe.right - popup.width / 2));
    const above = tower.top - gap;
    // Keep the entrance control tappable when a nearby tower is selected.
    const summon = document
      .querySelector<SVGGraphicsElement>('#map .summon-control[visibility="visible"]')
      ?.getBoundingClientRect();
    const coversSummon =
      summon &&
      left - popup.width / 2 < summon.right &&
      left + popup.width / 2 > summon.left &&
      above - popup.height < summon.bottom &&
      above > summon.top;
    const fitsAbove = above - popup.height >= topEdge && !coversSummon;
    const top = fitsAbove ? above : Math.min(tower.bottom + gap, bottomEdge - popup.height);
    actions.dataset.placement = fitsAbove ? 'above' : 'below';
    actions.style.left = `${left}px`;
    actions.style.top = `${Math.max(topEdge, top)}px`;
  }

  dispose(): void {
    this.controller.abort();
  }
}
