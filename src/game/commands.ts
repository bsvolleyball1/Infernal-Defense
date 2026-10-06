import { dragons, getMap } from '../content/catalog';
import { towerAttackInterval, towerSaleRefund, towerUpgradeCost } from './rules';
import { startWave } from './waves';
import type { GameCommand, GameEvent, GameState } from './types';

/** Commands mutate only engine-owned state and return data-only events. */
export function applyCommand(state: GameState, command: GameCommand): GameEvent[] {
  if (command.type === 'pause' || command.type === 'resume') {
    if (command.type === 'resume') state.paused = false;
    else if (state.phase === 'battle') state.paused = true;
    return [];
  }
  if (command.type === 'speed') {
    if ([1, 1.5, 2].includes(command.speed)) state.speed = command.speed;
    return [];
  }
  if (state.phase === 'won' || state.phase === 'lost' || state.phase === 'battle' && state.paused) return [];
  switch (command.type) {
    case 'choose':
      if (!Object.prototype.hasOwnProperty.call(dragons, command.dragon)) return [];
      state.chosen = command.dragon;
      state.selected = null;
      return [];
    case 'perch': return selectPerch(state, command.index);
    case 'upgrade': return upgradeTower(state);
    case 'sell': return sellTower(state);
    case 'startWave': return startWave(state);
  }
}

function selectPerch(state: GameState, index: number): GameEvent[] {
  if (!Number.isInteger(index) || index < 0 || index >= getMap(state.activeLevel).perches.length) return [];
  if (state.towers[index]) {
    state.selected = index;
    state.chosen = null;
    return [];
  }
  if (!state.chosen) return [{ type: 'message', text: 'Choose a dragon first' }];
  const dragon = dragons[state.chosen];
  if (state.gold < dragon.cost) return [{ type: 'message', text: 'Not enough gold' }];
  state.gold -= dragon.cost;
  state.towers[index] = { type: state.chosen, level: 1, cooldown: 0 };
  state.selected = index;
  state.chosen = null;
  return [{ type: 'save' }];
}

function upgradeTower(state: GameState): GameEvent[] {
  const tower = state.selected === null ? null : state.towers[state.selected];
  if (!tower || state.gold < towerUpgradeCost(tower)) return [];
  state.gold -= towerUpgradeCost(tower);
  const previousInterval = towerAttackInterval(tower);
  tower.level++;
  const upgradedInterval = towerAttackInterval(tower);
  tower.cooldown = Math.max(0, tower.cooldown + upgradedInterval - previousInterval);
  return [{ type: 'save' }, { type: 'message', text: 'Dragon upgraded to level ' + tower.level }];
}

function sellTower(state: GameState): GameEvent[] {
  const tower = state.selected === null ? null : state.towers[state.selected];
  if (!tower || state.selected === null) return [];
  const refund = towerSaleRefund(tower);
  state.gold += refund;
  state.towers[state.selected] = null;
  state.selected = null;
  return [{ type: 'save' }, { type: 'message', text: 'Dragon sold · ' + refund + ' gold' }];
}
