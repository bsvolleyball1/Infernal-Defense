import { monsters } from '../content/catalog';
import { dropEgg } from './eggs';
import { battleRules } from './rules';
import type { Enemy, GameEvent, GameState } from './types';

export function defeatEnemy(state: GameState, enemy: Enemy, events: GameEvent[]): void {
  if (enemy.rewarded || enemy.escaped) return;
  dropEgg(state, enemy);
  enemy.rewarded = true;
  state.enemiesKilled++;
  state.gold += battleRules.enemyGold + (enemy.kind === 'chief' ? battleRules.chiefBonusGold : 0);
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
  if (!state.rewardsApplied) {
    const survivingEggs = state.eggs.filter(egg => egg.status !== 'escaped').length;
    state.rewardGold = state.enemiesKilled + survivingEggs * battleRules.survivingEggGold;
    state.bankedGold += state.rewardGold;
    state.rewardsApplied = true;
  }
  events.push({ type: 'result' }, { type: 'save' });
}
