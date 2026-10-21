import type { MobileMapLayout } from '../domain/model';
import type { Battlefield, Point } from './maps';
import { isTowerGridCellBlocked, towerGridCellAt } from './tower-grid';

const cache = new Map<string, Battlefield>();

/** Three intentionally wide route designs, composed into the saved device frame. */
export function mobileBattlefield(base: Battlefield, layout: MobileMapLayout): Battlefield {
  const key = `${base.name}:${JSON.stringify(layout)}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const { width, height, insets } = layout;
  const bounds = { left: insets.left, right: width - insets.right, top: insets.top, bottom: height - insets.bottom };
  const x = (fraction: number) => bounds.left + fraction * (bounds.right - bounds.left);
  const y = (fraction: number) => bounds.top + 25 + fraction * (bounds.bottom - bounds.top - 50);
  const route = (points: Point[]): Point[] => points.map(([a, b]) => [x(a), y(b)]);
  let path: Point[];
  let forks: Point[][] = [];
  if (base.theme === 'gorge') {
    path = route([
      [0, 0.75],
      [0.06, 0.75],
      [0.15, 0.75],
      [0.19, 0.5],
      [0.17, 0.18],
      [0.24, 0.08],
      [0.34, 0.08],
      [0.42, 0.3],
      [0.4, 0.62],
      [0.47, 0.87],
      [0.57, 0.87],
      [0.64, 0.7],
      [0.67, 0.4],
      [0.65, 0.14],
      [0.76, 0.08],
      [0.87, 0.26],
      [0.96, 0.26],
    ]);
  } else if (base.theme === 'meadow') {
    path = route([
      [0, 0.72],
      [0.07, 0.72],
      [0.17, 0.72],
      [0.27, 0.72],
      [0.35, 0.72],
      [0.42, 0.62],
      [0.43, 0.4],
      [0.46, 0.18],
      [0.54, 0.12],
      [0.62, 0.12],
      [0.69, 0.12],
      [0.76, 0.12],
      [0.83, 0.16],
      [0.89, 0.3],
      [0.93, 0.48],
      [0.96, 0.65],
      [0.96, 0.72],
    ]);
  } else {
    const fork = (lower: boolean) =>
      route([
        [0, 0.5],
        [0.07, 0.5],
        [0.15, 0.5],
        [0.25, 0.5],
        [0.3, lower ? 0.72 : 0.28],
        [0.36, lower ? 0.86 : 0.14],
        [0.44, lower ? 0.86 : 0.14],
        [0.52, lower ? 0.86 : 0.14],
        [0.6, lower ? 0.86 : 0.14],
        [0.66, lower ? 0.75 : 0.25],
        [0.7, lower ? 0.63 : 0.37],
        [0.74, lower ? 0.55 : 0.45],
        [0.78, 0.5],
        [0.83, 0.5],
        [0.88, 0.5],
        [0.92, 0.5],
        [0.96, 0.5],
      ]);
    path = fork(false);
    forks = [fork(true)];
  }
  // Entries continue beyond the display, while the summon control stays inside the clear map margin.
  path[0] = [-30, path[0][1]];
  for (const fork of forks) fork[0] = [-30, fork[0][1]];
  const end = path[path.length - 1];
  const map: Battlefield = {
    ...base,
    mobile: true,
    width,
    height,
    path,
    forks,
    placementBounds: bounds,
    nest: { x: end[0], y: end[1] - 21 },
    perches: [],
    bonusAreas: [],
  };
  const cells: { x: number; y: number }[] = [];
  for (let cy = bounds.top + 25; cy < bounds.bottom; cy += 50)
    for (let cx = bounds.left + 25; cx < bounds.right; cx += 50) {
      const cell = towerGridCellAt(map, { x: cx, y: cy });
      if (cell && cell.width === 50 && cell.height === 50 && !isTowerGridCellBlocked(map, cell))
        cells.push({ x: cx, y: cy });
    }
  const used = new Set<number>();
  const nearest = (a: number, b: number) => {
    const sorted = cells
      .map((point, index) => ({ point, index, distance: Math.hypot(point.x - x(a), point.y - y(b)) }))
      .filter(({ index }) => !used.has(index))
      .sort((a, b) => a.distance - b.distance);
    const selected = sorted[0];
    if (!selected) throw new Error('Mobile map does not have enough clear placement cells.');
    used.add(selected.index);
    return selected.point;
  };
  map.bonusAreas = [
    { kind: 'damage', ...nearest(0.35, 0.48), radius: 24 },
    { kind: 'range', ...nearest(0.72, 0.6), radius: 24 },
    { kind: 'mana', ...nearest(0.08, 0.08), radius: 24 },
    { kind: 'food', ...nearest(0.87, 0.87), radius: 24 },
    { kind: 'gold', ...nearest(0.1, 0.92), radius: 24 },
  ];
  map.perches = cells.slice(0, base.perches.length);
  if (cache.size >= 64) cache.delete(cache.keys().next().value!);
  cache.set(key, map);
  return map;
}
