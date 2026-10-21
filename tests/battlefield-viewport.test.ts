import { describe, expect, it } from 'vitest';
import { battlefieldViewBox } from '../src/ui/battlefield-viewport';

describe('full-viewport battlefield camera', () => {
  it('uses the whole viewport for an authored device-shaped map', () => {
    const world = { width: (500 * 844) / 390, height: 500, mobile: true };
    const [x, y, width, height] = battlefieldViewBox(844, 390, { left: 0, right: 844, top: 60, bottom: 350 }, world)
      .split(' ')
      .map(Number);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(0);
    expect(width).toBeCloseTo(world.width);
    expect(height).toBeCloseTo(world.height);
  });
  for (const [width, height] of [
    [568, 320],
    [844, 390],
    [1024, 768],
    [1920, 1080],
  ]) {
    it(`keeps every world edge clear of controls without stretching at ${width}x${height}`, () => {
      const bounds = { left: 52, right: width - 52, top: 72, bottom: height - 52 };
      const [x, y, vw, vh] = battlefieldViewBox(width, height, bounds, { width: 700, height: 430 })
        .split(' ')
        .map(Number);
      const scale = width / vw;
      expect(scale).toBeCloseTo(height / vh);
      expect(-x * scale).toBeGreaterThanOrEqual(bounds.left - 0.001);
      expect((700 - x) * scale).toBeLessThanOrEqual(bounds.right + 0.001);
      expect(-y * scale).toBeGreaterThanOrEqual(bounds.top - 0.001);
      expect((430 - y) * scale).toBeLessThanOrEqual(bounds.bottom + 0.001);
    });
  }
});
