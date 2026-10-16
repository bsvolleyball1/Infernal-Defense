import { monsterPortrait } from './monster-art';
import { attr, node, setPortrait } from './svg';
import type { EnemySprite } from './battle-view-model';

const enemyMarkup = (shielded: boolean) =>
  `<ellipse cy="9" rx="12" ry="4" fill="#263324" opacity=".35"/><image class="enemy-icon" x="-12" y="-14" width="24" height="24" preserveAspectRatio="xMidYMid meet"/>${shielded ? '<path d="M-13-7l-4 8 5 9 6-5V-5z" fill="#aeb5a5" stroke="#47524a"/>' : ''}<rect x="-11" y="-19" width="22" height="3" rx="1.5" fill="#433e35"/><rect class="health" x="-11" y="-19" height="3" rx="1.5" fill="#cd6651"/><circle class="frozen" cy="-2" r="13" fill="none" stroke="#8de4ea" stroke-width="2"/>`;

export function createEnemySprite(enemy: EnemySprite): SVGElement {
  const group = node('g', enemyMarkup(enemy.shielded));
  attr(group, 'data-appearance', enemy.appearance);
  setPortrait(group.querySelector('.enemy-icon')!, monsterPortrait(enemy.kind));
  const title = node('title');
  title.textContent = enemy.name;
  group.append(title);
  if (enemy.showName) {
    const label = node('text');
    label.textContent = enemy.name;
    attr(label, 'y', -25);
    attr(label, 'text-anchor', 'middle');
    attr(label, 'font-size', 9);
    attr(label, 'fill', '#fff1cf');
    group.append(label);
  }
  return group;
}

export function updateEnemySprite(group: SVGElement, enemy: EnemySprite): void {
  attr(group, 'transform', `translate(${enemy.x} ${enemy.y})`);
  attr(group.querySelector('.health')!, 'width', enemy.hpWidth);
  attr(group.querySelector('.frozen')!, 'visibility', enemy.frozen ? 'visible' : 'hidden');
  attr(group, 'opacity', enemy.opacity);
}

export function enemySpriteStale(group: Element, enemy: EnemySprite): boolean {
  return group.getAttribute('data-appearance') !== enemy.appearance;
}
