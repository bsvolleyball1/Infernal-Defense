import { getMap, positionAt, routesFor } from '../content/catalog';
import {
  isTowerGridCellBlocked,
  towerGridCellAt,
  towerGridCellCenter,
  towerGridCellKey,
  towerGridCellSize,
} from '../content/maps';
import type { Battlefield } from '../content/maps';
import type { GameState, Point } from './types';

export function routeFor(state: GameState, routeId = 0): [number, number][] {
  return routesFor(getMap(state.activeLevel))[routeId];
}

export function entityPosition(state: GameState, entity: { progress: number; routeId?: number; kind?: string; direct?: boolean }): [number, number] {
  if (state.defense && (entity.kind === 'shade' || entity.direct)) {
    const path = routeFor(state,entity.routeId), t = entity.progress/(path.length-1);
    const first = path[0], last = path[path.length-1];
    return [first[0]+(last[0]-first[0])*t,first[1]+(last[1]-first[1])*t];
  }
  return positionAt(entity.progress, { path: routeFor(state, entity.routeId) });
}

/** Equal progress is not equal location on separate branches. */
export function sharesTrail(state: GameState, routeId: number | undefined, otherRoute: number | undefined, progress: number): boolean {
  if ((routeId ?? 0) === (otherRoute ?? 0)) return true;
  const first = routeFor(state, routeId);
  const second = routeFor(state, otherRoute);
  const index = Math.floor(progress);
  const equal = (i: number) => first[i]?.[0] === second[i]?.[0] && first[i]?.[1] === second[i]?.[1];
  return equal(index) && (Number.isInteger(progress) || index === first.length - 1 || equal(index + 1));
}

export function towerPosition(state: GameState, index: number): Point {
  const position = state.towers[index]?.position;
  if (position) return position;
  const legacy = getMap(state.activeLevel).perches[index];
  return legacy ? { x: legacy.x, y: legacy.y } : { x: 0, y: 0 };
}

export function isClearTowerPosition(point: Point, geometry: Battlefield): boolean {
  if (point.x < 25 || point.x > geometry.width - 25 || point.y < 25 || point.y > geometry.height - 25)
    return false;

  const roadClearance = 45;
  return routesFor(geometry).every((path) =>
    path.slice(0, -1).every(([x1, y1], index) => {
      const [x2, y2] = path[index + 1];
      const dx = x2 - x1;
      const dy = y2 - y1;
      const t = Math.max(0, Math.min(1, ((point.x - x1) * dx + (point.y - y1) * dy) / (dx * dx + dy * dy)));
      return Math.hypot(point.x - (x1 + t * dx), point.y - (y1 + t * dy)) >= roadClearance;
    }),
  );
}

export function towerGridPosition(point: Point, geometry: Battlefield): Point | null {
  const cell = towerGridCellAt(geometry, point);
  return cell ? towerGridCellCenter(cell) : null;
}

export function isValidTowerGridPosition(point: Point, geometry: Battlefield): boolean {
  const cell = towerGridCellAt(geometry, point);
  if (
    !cell ||
    cell.width !== towerGridCellSize ||
    cell.height !== towerGridCellSize ||
    isTowerGridCellBlocked(geometry, cell)
  )
    return false;
  const center = towerGridCellCenter(cell);
  return (
    point.x === center.x &&
    point.y === center.y &&
    center.x >= 25 &&
    center.x <= geometry.width - 25 &&
    center.y >= 25 &&
    center.y <= geometry.height - 25
  );
}

export function canPlaceTower(state: GameState, point: Point): boolean {
  const geometry = getMap(state.activeLevel);
  const cell = towerGridCellAt(geometry, point);
  if (
    !cell ||
    cell.width !== towerGridCellSize ||
    cell.height !== towerGridCellSize ||
    isTowerGridCellBlocked(geometry, cell)
  )
    return false;
  const center = towerGridCellCenter(cell);
  if (
    center.x < 25 ||
    center.x > geometry.width - 25 ||
    center.y < 25 ||
    center.y > geometry.height - 25
  )
    return false;
  return state.towers.every((tower, index) => {
    if (!tower) return true;
    const existingCell = towerGridCellAt(geometry, towerPosition(state, index));
    if (!existingCell) return true;
    return towerGridCellKey(cell) !== towerGridCellKey(existingCell);
  });
}
