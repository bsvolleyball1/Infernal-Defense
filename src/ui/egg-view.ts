import { attr, node } from './svg';
import type { EggSprite } from './battle-view-model';

const eggMarkup =
  '<ellipse cy="5" rx="5" ry="2" fill="#263324" opacity=".3"/><ellipse rx="4" ry="6" fill="#f1e3b0" stroke="#8c7448"/><ellipse cx="-1" cy="-2" rx="1" ry="2" fill="#fff9de"/>';

export function createEggSprite(): SVGGElement {
  return node<SVGGElement>('g', eggMarkup);
}

export function updateEggSprite(group: SVGElement, egg: EggSprite): void {
  attr(group, 'transform', `translate(${egg.x} ${egg.y})`);
}