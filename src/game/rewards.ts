import { monsters } from '../content/catalog';
import { dropEgg } from './eggs';
import { battleRules } from './rules';
import type { Enemy, GameEvent, GameState } from './types';
import { randomValue, rank } from './defense-state';
import { summonEnemy } from './enemy-factory';

export function defeatEnemy(state: GameState, enemy: Enemy, events: GameEvent[]): void {
  if (enemy.rewarded || enemy.escaped) return;
  dropEgg(state, enemy);
  enemy.rewarded = true;
  state.enemiesKilled++;
  state.gold += battleRules.enemyGold + (enemy.kind === 'chief' ? battleRules.chiefBonusGold : 0);
  if (state.defense) {
    state.gold += 2 * rank(state,'poison',4);
    if (enemy.kind === 'zombieTrain') {
      const count = 5 + Math.floor(randomValue(state)*6);
      const kinds = ['imp','demon','seaSerpent'] as const;
      for (let i=0;i<count;i++) summonEnemy(state,kinds[Math.floor(randomValue(state)*3)],enemy);
    }
    if (state.defense.mode === 'sandbox') return;
  }
  if (state.knownMonsters.includes(enemy.kind)) return;
  state.knownMonsters.push(enemy.kind);
  events.push(
    { type: 'discovery', kind: enemy.kind },
    { type: 'save' },
    { type: 'message', text: 'Bestiary updated: ' + monsters[enemy.kind].name },
  );
}

export function finishBattle(state: GameState, won: boolean, events: GameEvent[]): void {
  if (state.phase === 'won' || state.phase === 'lost') return;
  state.phase = won ? 'won' : 'lost';
  for (const enemy of state.enemies) dropEgg(state, enemy);
  state.enemies = [];
  state.projectiles = [];
  state.spawnSchedule = [];
  if (state.defense) {
    state.defense.impacts = [];
    state.defense.targeting = null;
    state.defense.preview = null;
    state.defense.countdown = null;
    for (const tower of state.towers) if (tower?.beamIds) tower.beamIds = [];
  }
  if (!state.rewardsApplied) {
    const survivingEggs = state.eggs.filter(egg => egg.status !== 'escaped').length;
    state.rewardGold = state.enemiesKilled + survivingEggs * battleRules.survivingEggGold;
    state.bankedGold += state.rewardGold;
    state.rewardsApplied = true;
  }
  events.push({ type: 'result' }, { type: 'save' });
}
