import { tickEnemyAbilities } from './enemy-abilities';
import { tickDefenseTowers, tickDefenseProjectiles } from './defense-combat';
import { tickSpells } from './spells';
import { moveEnemy } from './eggs';
import { finishBattle } from './rewards';
import { finishWaveIfClear, spawnNextEnemy, startWave } from './waves';
import type { GameEvent, GameState } from './types';

export function stepDefense(state: GameState, elapsed: number): GameEvent[] {
  const events: GameEvent[] = [],
    dt = elapsed * state.speed,
    d = state.defense!;
  state.simulationTime += dt;
  tickSpells(state, dt, events);
  if (state.phase === 'ready') {
    if (d.countdown !== null) {
      d.countdown = Math.max(0, d.countdown - dt);
      if (d.countdown < 1e-7) {
        d.countdown = 0; // An automatic wave never earns an early-summon bonus.
        events.push(...startWave(state));
      }
    }
    return events;
  }
  spawnNextEnemy(state);
  for (const enemy of [...state.enemies]) {
    if (!tickEnemyAbilities(state, enemy, dt, events)) continue;
    if (moveEnemy(state, enemy, dt) && state.eggs.every((e) => e.status === 'escaped')) {
      finishBattle(state, false, events);
      return events;
    }
  }
  state.enemies = state.enemies.filter((e) => e.hp > 0 && !e.rewarded && !e.escaped);
  tickDefenseTowers(state, dt, events);
  tickDefenseProjectiles(state, dt, events);
  state.enemies = state.enemies.filter((e) => e.hp > 0 && !e.rewarded && !e.escaped);
  for (const tower of state.towers)
    if (tower?.beamIds) tower.beamIds = tower.beamIds.filter((id) => state.enemies.some((e) => e.id === id));
  finishWaveIfClear(state, events);
  return events;
}
