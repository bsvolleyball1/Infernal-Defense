import type { GameState } from '../game/types';
import { presentSummon } from './battle-view-model';
import { element } from './dom';
import { attr, node } from './svg';

const summonRadius = 25;
const summonMarkup =
  '<circle class="summon-hit" r="54" fill="transparent"/><circle r="31" fill="#18221d" fill-opacity=".86" stroke="#c78a6a" stroke-width="2"/><circle class="summon-track" r="25" fill="none" stroke="#f3ead3" stroke-opacity=".25" stroke-width="3"/><circle class="summon-progress" r="25" fill="none" stroke="#e0b45f" stroke-width="3" stroke-linecap="round" transform="rotate(-90)"/><text class="summon-icon" text-anchor="middle" y="8" font-size="23" aria-hidden="true">👹</text>';

/** Journey summon control drawn at the road entrance. */
export class SummonView {
  render(state: GameState): void {
    const layer = element<SVGGElement>('#summonControl');
    let button = layer.querySelector<SVGGElement>('.summon-control');
    if (!button) {
      button = node<SVGGElement>('g', summonMarkup);
      button.classList.add('summon-control');
      button.setAttribute('role', 'button');
      button.setAttribute('aria-label', 'Summon next wave');
      button.setAttribute('pointer-events', 'all');
      layer.append(button);
    }
    const summon = presentSummon(state);
    button.setAttribute('visibility', summon.visible ? 'visible' : 'hidden');
    button.setAttribute('tabindex', summon.interactive ? '0' : '-1');
    button.setAttribute('aria-disabled', String(!summon.interactive));
    if (!summon.visible) return;

    attr(button, 'transform', `translate(${summon.x} ${summon.y})`);
    const circumference = 2 * Math.PI * summonRadius;
    const progress = button.querySelector('.summon-progress')!;
    attr(progress, 'stroke-dasharray', circumference);
    attr(progress, 'stroke-dashoffset', circumference * (1 - summon.remaining));
    attr(progress, 'visibility', summon.remaining > 0 ? 'visible' : 'hidden');
    button.setAttribute('aria-label', summon.label);
  }
}
