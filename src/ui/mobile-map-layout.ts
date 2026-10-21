import type { MobileMapLayout } from '../game/types';
import { element } from './dom';

/** Pick an undistorted coordinate frame with the device's landscape aspect ratio. */
export function deviceMapLayout(): MobileMapLayout {
  const viewport = element('#app').getBoundingClientRect();
  const width = viewport.width;
  const height = viewport.height;
  const aspect = Math.max(1.3, Math.min(3, width / height));
  const worldHeight = Math.max(500, 800 / aspect);
  const worldWidth = worldHeight * aspect;
  const scale = Math.min(width / worldWidth, height / worldHeight);
  const safe = element('#viewportSafeArea').getBoundingClientRect();
  const units = (pixels: number) => Math.ceil(pixels / scale / 50) * 50;
  return {
    version: 1,
    width: worldWidth,
    height: worldHeight,
    insets: {
      top: units(safe.top + 54),
      right: units(width - safe.right + 12),
      bottom: units(height - safe.bottom + 36),
      left: units(safe.left + 12),
    },
  };
}
