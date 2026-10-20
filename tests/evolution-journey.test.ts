import { expect, it } from 'vitest';
import { battlefields, challengeAllowsDragon, challengeAllowsSpell, getMap, routesFor } from '../src/content/maps';
import { colorForDragon, formsForColors } from '../src/content/dragon-forms';
import { positionAt } from '../src/content/path';
import { createDefenseState } from '../src/game/defense-state';
import { GameEngine } from '../src/game/engine';
import { canPlaceTower, entityPosition } from '../src/game/geometry';
import { SaveRepository } from '../src/services/storage';
import { recordJourneyResult } from '../src/game/journey';
import type { Level, Point, DragonType } from '../src/game/types';

/** A deterministic player strategy with normal starting resources and no permanent ranks. */
it.each(Object.keys(battlefields) as Level[])(
  'finishes all five %s waves under the new rules',
  (level) => {
    const engine = new GameEngine(createDefenseState(level, undefined, false, 'defense-2'));
    const map = getMap(level, 'defense-2');
    const types = (['fire', 'ice', 'poison'] as const).filter((type) => challengeAllowsDragon(map, type));
    const candidates: { point: Point; coverage: number }[] = [];
    for (let y = 25; y < 400; y += 50)
      for (let x = 25; x < 700; x += 50) {
        if (!canPlaceTower(engine.state, { x, y })) continue;
        let coverage = 0;
        for (const route of routesFor(map))
          for (let progress = 0; progress <= 16; progress += 0.25) {
            const [px, py] = positionAt(progress, { path: route });
            if (Math.hypot(px - x, py - y) < 132) coverage += 1 - progress / 32;
          }
        candidates.push({ point: { x, y }, coverage });
      }
    candidates.sort((a, b) => b.coverage - a.coverage || a.point.y - b.point.y || a.point.x - b.point.x);
    let purchased = 0;
    const improve = () => {
      for (const [index, tower] of engine.state.towers.entries()) {
        if (!tower?.evolution || tower.level >= 3 || engine.state.gold < tower.level * 45) continue;
        engine.dispatch({ type: 'perch', index });
        const color = colorForDragon[tower.type];
        const form = formsForColors([...tower.evolution.colors, color])[0];
        engine.dispatch({ type: 'evolve', color, form });
      }
      const type: DragonType = types[purchased % types.length];
      const candidate = candidates.find(({ point }) => canPlaceTower(engine.state, point));
      if (candidate) {
        const before = engine.state.towers.filter(Boolean).length;
        engine.dispatch({ type: 'choose', dragon: type });
        engine.dispatch({ type: 'place', point: candidate.point });
        if (engine.state.towers.filter(Boolean).length > before) purchased++;
      }
    };
    improve();
    improve();
    for (let step = 0; step < 120_000 && engine.state.phase !== 'won' && engine.state.phase !== 'lost'; step++) {
      if (step % 60 === 0) improve();
      if (engine.state.phase === 'ready') engine.dispatch({ type: 'startWave' });
      if (engine.state.defense && engine.state.defense.mana >= 150 && engine.state.enemies.length > 3) {
        const spell = (['ice', 'fire', 'poison'] as const).find((value) => challengeAllowsSpell(map, value));
        if (spell) {
          const [x, y] = entityPosition(engine.state, engine.state.enemies[0]);
          engine.dispatch({ type: 'spell', spell, point: { x, y } });
        }
      }
      engine.step(1000 / 60);
    }
    expect(engine.state.phase).toBe('won');
    expect(engine.state.wave).toBe(5);
    expect(engine.state.bankedGold).toBeGreaterThan(0);
    const values = new Map<string, string>();
    const repository = new SaveRepository({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
    });
    const journey = recordJourneyResult({ activeBattle: true, completedLevels: [] }, engine.state);
    expect(repository.saveSlot(0, engine.snapshot(), journey)).toEqual({ ok: true });
    expect(repository.readSlot(0).status).toBe('valid');
  },
  20_000,
);
