import type { Point } from './maps';
import { gorge } from './maps';

/** Progress is measured in path segments, matching the original movement formula. */
export function positionAt(progress: number, geometry: { path: Point[] } = gorge): [number, number] {
  const path = geometry.path;
  const u = Math.max(0, Math.min(path.length - 1, progress));
  const i = Math.floor(u);
  const point = path[i];
  if (i >= path.length - 1) return [...point];
  const next = path[i + 1];
  const fraction = u - i;
  return [point[0] + (next[0] - point[0]) * fraction, point[1] + (next[1] - point[1]) * fraction];
}
