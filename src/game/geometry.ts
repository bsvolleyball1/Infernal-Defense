import { getMap, positionAt, routesFor } from '../content/catalog';
import type { GameState } from './types';

export function routeFor(state: GameState, routeId = 0): [number, number][] {
  return routesFor(getMap(state.activeLevel))[routeId];
}

export function entityPosition(state: GameState, entity: { progress: number; routeId?: number }): [number, number] {
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
