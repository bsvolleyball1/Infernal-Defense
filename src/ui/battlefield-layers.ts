import {
  isTowerGridCellBlocked,
  towerGridCellAt,
  towerGridCellSize,
} from '../content/maps';
import type { Battlefield } from '../content/maps';

/** Shared dynamic dragon and entity layers keep every map compatible with controls and renderer. */
export function battlefieldLayers(map: Battlefield): string {
  const volcanic = map.theme === 'volcanic';
  const icons = { damage: 'D', range: 'R', mana: 'M', food: 'F', gold: 'G' };
  const grid = Array.from(
    { length: Math.ceil(map.height / towerGridCellSize) },
    (_, row) =>
      Array.from({ length: Math.ceil(map.width / towerGridCellSize) }, (_, column) => {
        const cell = towerGridCellAt(map, {
          x: Math.min(map.width - 1, column * towerGridCellSize),
          y: Math.min(map.height - 1, row * towerGridCellSize),
        })!;
        const blocked = isTowerGridCellBlocked(map, cell);
        return `<rect class="tower-grid-cell${blocked ? ' blocked' : ''}" x="${cell.x}" y="${cell.y}" width="${cell.width}" height="${cell.height}" aria-label="${blocked ? 'Path blocked' : 'Placement cell'}"/>`;
      }).join(''),
  ).join('');
  const bonusAreas = map.bonusAreas.map(({ kind, x, y, radius }) =>
    `<g class="bonus-area bonus-area-${kind}" transform="translate(${x} ${y})" aria-label="${kind} bonus area">
      <title>${kind[0].toUpperCase()}${kind.slice(1)} bonus area. Place one dragon here; upgrades strengthen the bonus.${['mana', 'food', 'gold'].includes(kind) ? ' Resource production is active in journey mode.' : ''}</title>
      <circle r="${radius}" fill="#18221d" fill-opacity=".42" stroke="#f0d58b" stroke-opacity=".82" stroke-width="2" stroke-dasharray="3 3"/>
      <circle r="11" fill="#18221d" fill-opacity=".9" stroke="#f0d58b" stroke-width="1"/>
      <text y="3.5" text-anchor="middle" font-size="9" fill="#fff1ca" font-weight="700">${icons[kind]}</text>
      <text y="${radius + 9}" text-anchor="middle" font-size="7" fill="#fff1ca" font-weight="700">${kind.toUpperCase()}</text>
    </g>`,
  ).join('');
  return `<g id="towerGrid" aria-label="Tower placement grid">${grid}</g><g id="bonusAreas">${bonusAreas}</g><g id="effects"></g><g id="enemies"></g><g id="towers"></g><g id="placementPreview"></g><g id="summonControl"></g>
    <g id="nest" transform="translate(${map.nest.x} ${map.nest.y})"><ellipse cy="19" rx="29" ry="13" fill="#293f3b" opacity=".65"/><path d="M-28 6L-20-5 19-5 29 7 23 24-21 24Z" fill="${volcanic ? '#725567' : '#695c41'}" stroke="#d5bd7c" stroke-width="2"/><ellipse cy="7" rx="21" ry="11" fill="#a98d54"/><path d="M-25 7q25 30 50 0M-23 17l46 0" fill="none" stroke="#e5c583" stroke-width="2"/><text id="nestCount" y="-16" text-anchor="middle" font-size="10" fill="#fff1ca" font-weight="700">5 in nest</text></g>
    <g id="eggObjects"></g><g id="floaters"></g>`;
}
