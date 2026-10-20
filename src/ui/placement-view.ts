import type { GameState, Point } from '../game/types';
import { presentPlacement } from './battle-view-model';
import { dragonPortrait } from './dragon-art';
import { element } from './dom';
import { attr, node, setPortrait } from './svg';

const placementMarkup =
  '<circle class="placement-ring" r="23" fill="none" stroke-width="2" stroke-dasharray="4 3"/><image class="placement-icon" x="-18" y="-18" width="36" height="36" preserveAspectRatio="xMidYMid meet"/>';

/** Ghost dragon that follows the pointer while a dragon is chosen. */
export class PlacementView {
  private point: Point | null = null;
  private node: SVGGElement | null = null;

  setPoint(point: Point | null): void {
    this.point = point;
  }

  render(state: GameState): void {
    const layer = element<SVGGElement>('#placementPreview');
    if (!this.node || !this.node.isConnected) {
      this.node = node<SVGGElement>('g', placementMarkup);
      this.node.classList.add('placement-preview');
      this.node.setAttribute('aria-hidden', 'true');
      this.node.setAttribute('pointer-events', 'none');
      layer.append(this.node);
    }
    const preview = presentPlacement(state, this.point);
    if (!preview) {
      this.node.setAttribute('visibility', 'hidden');
      return;
    }
    attr(this.node, 'transform', `translate(${preview.x} ${preview.y})`);
    attr(this.node, 'visibility', 'visible');
    attr(this.node, 'opacity', '.58');
    attr(this.node.querySelector('.placement-ring')!, 'stroke', preview.valid ? '#c5f39a' : '#ff8671');
    setPortrait(this.node.querySelector('.placement-icon')!, dragonPortrait(preview.dragon, 1, preview.evolved));
  }
}
