import type { Battlefield } from '../content/maps';
import { element } from './dom';

/** Fit simulation coordinates into clear touch bounds while the SVG covers the viewport. */
export function battlefieldViewBox(
  width: number,
  height: number,
  bounds: { left: number; right: number; top: number; bottom: number },
  world: { width: number; height: number; mobile?: boolean },
): string {
  if (world.mobile) {
    const scale = Math.min(width / world.width, height / world.height);
    return `${-(width / scale - world.width) / 2} ${-(height / scale - world.height) / 2} ${width / scale} ${height / scale}`;
  }
  const scale = Math.min((bounds.right - bounds.left) / world.width, (bounds.bottom - bounds.top) / world.height);
  if (scale <= 0 || !Number.isFinite(scale)) return `0 0 ${world.width} ${world.height}`;
  const x = (bounds.left + bounds.right - world.width * scale) / 2;
  const y = (bounds.top + bounds.bottom - world.height * scale) / 2;
  return `${-x / scale} ${-y / scale} ${width / scale} ${height / scale}`;
}

export class BattlefieldViewport {
  private world = { width: 700, height: 430 };
  private readonly observer: ResizeObserver;

  constructor() {
    this.observer = new ResizeObserver(() => this.fit());
    for (const selector of [
      '.battlefield',
      '#viewportSafeArea',
      '#battleMiddle',
      '#battleStatus',
      '#battleSpells',
      '#battleDragons',
    ])
      this.observer.observe(element(selector));
  }

  setMap(map: Battlefield): void {
    this.world = map;
    this.fit();
  }

  private fit(): void {
    const area = element('.battlefield').getBoundingClientRect();
    if (!area.width || !area.height) return;
    const safe = element('#viewportSafeArea').getBoundingClientRect();
    const controls = element('#battleMiddle').getBoundingClientRect();
    const status = element('#battleStatus').getBoundingClientRect();
    const dragons = element('#battleDragons').getBoundingClientRect();
    const spells = element('#battleSpells').getBoundingClientRect();
    const viewBox = battlefieldViewBox(
      area.width,
      area.height,
      {
        left: safe.left - area.left + 8,
        right: safe.right - area.left - 8,
        top: Math.max(safe.top, controls.bottom + 12, status.bottom + 12) - area.top,
        bottom: Math.min(safe.bottom, dragons.top - 8, spells.height ? spells.top - 8 : safe.bottom) - area.top,
      },
      this.world,
    );
    element('#map').setAttribute('viewBox', viewBox);
    element('#battleScenery').setAttribute('viewBox', viewBox);
  }
}
