import { getMap, routesFor } from '../content/catalog';
import { positionAt } from '../content/path';
import { enemyTraits } from '../content/enemies';
import { bonusAreaAt } from '../content/maps';
import type { Battlefield } from '../content/maps';
import type { Enemy, GameState, Point } from './types';

export function routeFor(state: GameState, routeId = 0): [number, number][] {
  return routesFor(getMap(state.activeLevel))[routeId];
}

export function entityPosition(
  state: GameState,
  entity: { progress: number; routeId?: number; kind?: string; direct?: boolean },
): [number, number] {
  if (state.defense && (entity.direct || (entity.kind !== undefined && enemyTraits(entity.kind).directPath))) {
    const path = routeFor(state, entity.routeId),
      t = entity.progress / (path.length - 1);
    const first = path[0],
      last = path[path.length - 1];
    return [first[0] + (last[0] - first[0]) * t, first[1] + (last[1] - first[1]) * t];
  }
  return positionAt(entity.progress, { path: routeFor(state, entity.routeId) });
}

/** Orders enemies nearest-first from a point, breaking ties by id for deterministic targeting. */
export function byDistanceFrom(state: GameState, point: Point): (a: Enemy, b: Enemy) => number {
  return (a, b) => {
    const [ax, ay] = entityPosition(state, a),
      [bx, by] = entityPosition(state, b);
    return Math.hypot(ax - point.x, ay - point.y) - Math.hypot(bx - point.x, by - point.y) || a.id - b.id;
  };
}

/** Equal progress is not equal location on separate branches. */
export function sharesTrail(
  state: GameState,
  routeId: number | undefined,
  otherRoute: number | undefined,
  progress: number,
): boolean {
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
  if (point.x < 25 || point.x > geometry.width - 25 || point.y < 25 || point.y > geometry.height - 25) return false;

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

export function canPlaceTower(state: GameState, point: Point): boolean {
  const geometry = getMap(state.activeLevel);
  if (!isClearTowerPosition(point, geometry)) return false;
  const targetBonus = bonusAreaAt(geometry, point);
  return state.towers.every((tower, index) => {
    if (!tower) return true;
    const existing = towerPosition(state, index);
    if (targetBonus && targetBonus.index === bonusAreaAt(geometry, existing)?.index) return false;
    return Math.hypot(point.x - existing.x, point.y - existing.y) >= 42;
  });
}

export function clampToBattlefield(point: Point, geometry: Pick<Battlefield, 'width' | 'height'>): Point {
  return {
    x: Math.max(0, Math.min(geometry.width, point.x)),
    y: Math.max(0, Math.min(geometry.height, point.y)),
  };
}

export function isInsideBattlefield(point: Point, geometry: Pick<Battlefield, 'width' | 'height'>): boolean {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    point.x >= 0 &&
    point.y >= 0 &&
    point.x <= geometry.width &&
    point.y <= geometry.height
  );
}
