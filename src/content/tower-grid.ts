import type { Battlefield } from './maps';
export const towerGridCellSize = 50;
export interface TowerGridCell {
  column: number;
  row: number;
  x: number;
  y: number;
  width: number;
  height: number;
}
export function towerGridCellAt(geometry: Battlefield, point: { x: number; y: number }): TowerGridCell | null {
  if (
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    point.x < 0 ||
    point.x >= geometry.width ||
    point.y < 0 ||
    point.y >= geometry.height
  )
    return null;
  const column = Math.floor(point.x / towerGridCellSize);
  const row = Math.floor(point.y / towerGridCellSize);
  const x = column * towerGridCellSize;
  const y = row * towerGridCellSize;
  return {
    column,
    row,
    x,
    y,
    width: Math.min(towerGridCellSize, geometry.width - x),
    height: Math.min(towerGridCellSize, geometry.height - y),
  };
}

export function towerGridCellCenter(cell: TowerGridCell): { x: number; y: number } {
  return { x: cell.x + cell.width / 2, y: cell.y + cell.height / 2 };
}

export function towerGridCellKey(cell: TowerGridCell): string {
  return `${cell.column}:${cell.row}`;
}

export function isTowerGridCellBlocked(geometry: Battlefield, cell: TowerGridCell): boolean {
  const left = cell.x;
  const right = cell.x + cell.width;
  const top = cell.y;
  const bottom = cell.y + cell.height;
  return [geometry.path, ...geometry.forks].some((path) =>
    path.slice(0, -1).some(([x1, y1], index) => {
      const [x2, y2] = path[index + 1];
      let min = 0;
      let max = 1;
      const dx = x2 - x1;
      const dy = y2 - y1;
      for (const [p, q] of [
        [-dx, x1 - left],
        [dx, right - x1],
        [-dy, y1 - top],
        [dy, bottom - y1],
      ]) {
        if (p === 0) {
          if (q < 0) return false;
          continue;
        }
        const ratio = q / p;
        if (p < 0) min = Math.max(min, ratio);
        else max = Math.min(max, ratio);
        if (min > max) return false;
      }
      return true;
    }),
  );
}
