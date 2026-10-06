import { getMap, routesFor, waves } from '../content/catalog';
import { finishBattle } from './rewards';
import { battleRules, waveReward } from './rules';
import type { GameEvent, GameState } from './types';
import {
  defenseWaves,
  tutorialRoster,
  enemyRoster,
  isDefenseMonster,
  movementSpeed,
} from '../content/enemies';
import { createEnemy } from './enemy-factory';
import { defenseRules } from '../content/defense-rules';

export function startWave(state: GameState): GameEvent[] {
  const d = state.defense,
    sandbox = d?.mode === 'sandbox';
  if (
    state.phase !== 'ready' ||
    (!sandbox && state.wave >= waves.length) ||
    !state.eggs.some((egg) => egg.status !== 'escaped')
  )
    return [];
  state.wave++;
  state.phase = 'battle';
  state.paused = false;
  const interval = Math.max(
    battleRules.minimumSpawnIntervalMs,
    battleRules.initialSpawnIntervalMs - state.wave * battleRules.spawnIntervalReductionMs,
  );
  let at = state.simulationTime;
  state.spawnSchedule = [];
  const routeCount = routesFor(getMap(state.activeLevel)).length;
  let groups = waves[state.wave - 1];
  if (d) {
    if (d.countdown !== null)
      d.mana = Math.min(
        d.maxMana,
        d.mana + Math.ceil(d.countdown / 1000) * defenseRules.earlyWaveManaPerSecond,
      );
    d.countdown = null;
    d.targeting = null;
    d.preview = null;
    const entries = sandbox
      ? Object.entries(d.testWave)
          .filter(([kind, count]) => isDefenseMonster(kind) && count! > 0)
          .map(([kind, count]) => [kind, count] as const)
      : (state.activeLevel === 'tutorial' ? tutorialRoster : defenseWaves)[state.wave - 1];
    groups = entries.map(([kind, n]) => {
      const stats = enemyRoster[kind as keyof typeof enemyRoster];
      return {
        kind: kind as keyof typeof enemyRoster,
        n: n!,
        hp: stats.hp,
        spd: movementSpeed(stats.rating),
      };
    });
    if (!groups.length) {
      state.wave--;
      state.phase = 'ready';
      return [{ type: 'message', text: 'Choose at least one monster' }];
    }
  }
  for (const group of groups) {
    for (let index = 0; index < group.n; index++) {
      state.spawnSchedule.push({
        kind: group.kind,
        hp: group.hp,
        spd: group.spd,
        at,
        ...(routeCount > 1 ? { routeId: state.spawnSchedule.length % routeCount } : {}),
      });
      at += interval;
    }
  }
  return [{ type: 'save' }];
}

export function spawnNextEnemy(state: GameState): void {
  const spawn = state.spawnSchedule[0];
  // Preserve the original one-admission-per-step rule and population cap.
  if (!spawn || spawn.at > state.simulationTime || state.enemies.length >= battleRules.maximumEnemies) return;
  state.spawnSchedule.shift();
  state.enemies.push(
    state.defense
      ? createEnemy(state, spawn.kind, spawn.hp, spawn.spd, 0, spawn.routeId)
      : {
          id: state.nextEntityId++,
          kind: spawn.kind,
          hp: spawn.hp,
          max: spawn.hp,
          spd: spawn.spd,
          progress: 0,
          slow: 0,
          poison: 0,
          poisonD: 0,
          carryingEgg: null,
          returning: false,
          escaped: false,
          rewarded: false,
          ...(spawn.routeId !== undefined ? { routeId: spawn.routeId } : {}),
        },
  );
  state.enemiesSummoned++;
}

export function finishWaveIfClear(state: GameState, events: GameEvent[]): void {
  if (state.spawnSchedule.length || state.enemies.length) return;
  if (state.defense?.mode === 'sandbox') {
    state.phase = 'ready';
    state.projectiles = [];
    events.push({ type: 'message', text: 'Test wave complete' });
    return;
  }
  state.gold += waveReward(state.wave);
  const isFinalWave = state.wave >= waves.length;
  events.push({
    type: 'message',
    text: isFinalWave
      ? 'All waves repelled · bonus gold awarded'
      : 'Wave ' + state.wave + ' repelled · bonus gold awarded',
  });
  if (isFinalWave) finishBattle(state, true, events);
  else {
    state.phase = 'ready';
    if (state.defense) state.defense.countdown = defenseRules.waveCountdownMs;
    events.push({ type: 'save' });
  }
}
