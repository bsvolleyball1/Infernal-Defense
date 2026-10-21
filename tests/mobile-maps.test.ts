import { describe, expect, it } from 'vitest';
import { getMap } from '../src/content/maps';
import { createDefenseState } from '../src/game/defense-state';
import { GameEngine } from '../src/game/engine';
import { isValidTowerGridPosition } from '../src/game/geometry';
import { validateState } from '../src/services/save-schema';
import type { MobileMapLayout, Level } from '../src/game/types';

describe('authored mobile battlefields', () => {
  for (const aspect of [568 / 320, 844 / 390, 1024 / 768]) {
    const height = Math.max(500, 800 / aspect);
    const layout: MobileMapLayout = {
      version: 1,
      width: height * aspect,
      height,
      insets: { top: 100, bottom: 100, left: 50, right: 50 },
    };
    for (const level of ['level1', 'meadow', 'volcanic', 'fireTrial'] as Level[]) {
      it(`composes ${level} across a ${aspect.toFixed(2)} device frame with clear bonus cells`, () => {
        const map = getMap(level, 'defense-2', layout);
        expect(map.width / map.height).toBeCloseTo(aspect);
        expect(map.path.at(-1)![0]).toBeGreaterThan(map.width * 0.8);
        expect(map.path[1][0]).toBeLessThan(map.width * 0.2);
        expect(map.path).toHaveLength(17);
        expect(map.forks).toHaveLength(level === 'level1' || level === 'meadow' ? 0 : 1);
        for (const area of map.bonusAreas) expect(isValidTowerGridPosition(area, map)).toBe(true);
        expect(new Set(map.bonusAreas.map(({ x, y }) => `${x}:${y}`)).size).toBe(5);
      });
    }
  }

  it('round-trips device dimensions, towers and spell positions beyond the old 700-unit limit', () => {
    const layout: MobileMapLayout = {
      version: 1,
      width: 1100,
      height: 500,
      insets: { top: 100, bottom: 100, left: 50, right: 50 },
    };
    const state = createDefenseState('level1', undefined, false, 'defense-2', layout);
    const map = getMap('level1', 'defense-2', layout);
    const engine = new GameEngine(state);
    const point = map.bonusAreas.find(({ x }) => x > 700)!;
    engine.dispatch({ type: 'choose', dragon: 'fire' });
    engine.dispatch({ type: 'place', point });
    expect(engine.state.towers.filter(Boolean)).toHaveLength(1);
    engine.dispatch({ type: 'spellTarget', spell: 'fire' });
    engine.dispatch({ type: 'previewSpell', point: { x: 1000, y: 200 } });
    expect(engine.state.defense!.preview).toEqual({ x: 1000, y: 200 });
    const saved = JSON.parse(JSON.stringify(engine.snapshot()));
    expect(() => validateState(saved)).not.toThrow();
    expect(saved.defense.mobileLayout).toEqual(layout);
    expect(saved.towers.find(Boolean).position.x).toBeGreaterThan(700);
    saved.defense.mobileLayout.insets.top = 499;
    expect(() => validateState(saved)).toThrow();
  });

  it('keeps historical battles on their original geometry', () => {
    const state = createDefenseState('level1', undefined, false, 'defense-2');
    expect(state.defense.mobileLayout).toBeUndefined();
    expect(getMap('level1', 'defense-2').width).toBe(700);
    expect(getMap('level1', 'defense-2').height).toBe(430);
    expect(() => validateState(state)).not.toThrow();
  });
});
