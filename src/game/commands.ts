import { dragons } from '../content/catalog';
import { towerAttackInterval, towerSaleRefund, towerUpgradeCost } from './rules';
import { startWave } from './waves';
import type { GameCommand, GameEvent, GameState } from './types';
import { castSpell } from './spells';
import { levelCap, rankOf } from './defense-state';
import { upgradeTrees, upgradeCost } from '../content/upgrades';
import { isDefenseMonster } from '../content/enemies';
import { defenseRules } from '../content/defense-rules';
import { canPlaceTower, clampToBattlefield } from './geometry';
import { getMap } from '../content/catalog';

/** Commands mutate only engine-owned state and return data-only events. */
export function applyCommand(state: GameState, command: GameCommand): GameEvent[] {
  switch (command.type) {
    case 'buyPermanent':
      return buyPermanent(state, command);
    case 'pause':
    case 'resume':
      return setPaused(state, command);
    case 'speed':
      if ([1, 1.5, 2].includes(command.speed)) state.speed = command.speed;
      return [];
    case 'spell':
    case 'spellTarget':
    case 'previewSpell':
    case 'testWave':
    case 'choose':
    case 'perch':
    case 'place':
    case 'upgrade':
    case 'sell':
    case 'startWave':
      break;
    default: {
      const unexpected: never = command;
      throw new Error(`Unexpected command: ${JSON.stringify(unexpected)}`);
    }
  }
  if (battleInputBlocked(state)) return [];
  switch (command.type) {
    case 'spell':
      return castSpell(state, command.spell, command.point);
    case 'spellTarget':
      if (
        state.defense &&
        [null, 'fire', 'poison'].includes(command.spell) &&
        (!getMap(state.activeLevel).challenge ||
          command.spell === null ||
          getMap(state.activeLevel).challenge?.spell === command.spell)
      ) {
        state.defense.targeting = command.spell;
        state.defense.preview = null;
      }
      return [];
    case 'previewSpell':
      if (state.defense?.targeting && Number.isFinite(command.point.x) && Number.isFinite(command.point.y))
        state.defense.preview = clampToBattlefield(command.point, getMap(state.activeLevel));
      return [];
    case 'testWave':
      if (
        state.defense?.mode === 'sandbox' &&
        Object.entries(command.counts).every(
          ([kind, n]) => isDefenseMonster(kind) && Number.isInteger(n) && n! >= 0 && n! <= 999,
        )
      )
        state.defense.testWave = { ...command.counts };
      return [];
    case 'choose':
      if (
        !Object.prototype.hasOwnProperty.call(dragons, command.dragon) ||
        (getMap(state.activeLevel).challenge && getMap(state.activeLevel).challenge?.dragon !== command.dragon)
      )
        return [];
      state.chosen = command.dragon;
      state.selected = null;
      return [];
    case 'perch':
      return selectPerch(state, command.index);
    case 'place':
      return placeTower(state, command.point);
    case 'upgrade':
      return upgradeTower(state);
    case 'sell':
      return sellTower(state);
    case 'startWave':
      return startWave(state);
    default: {
      const unexpected: never = command;
      throw new Error(`Unexpected command: ${JSON.stringify(unexpected)}`);
    }
  }
}

function battleInputBlocked(state: GameState): boolean {
  if (state.phase === 'won' || state.phase === 'lost' || (state.phase === 'battle' && state.paused)) return true;
  return Boolean(state.defense && state.paused);
}

function buyPermanent(state: GameState, command: Extract<GameCommand, { type: 'buyPermanent' }>): GameEvent[] {
  const d = state.defense,
    node = upgradeTrees[command.dragon]?.nodes[command.node];
  if (!d || d.mode === 'sandbox' || state.phase === 'battle' || !node || !Number.isInteger(command.node)) return [];
  const current = d.ranks[command.dragon][command.node],
    cost = upgradeCost(current);
  if (state.bankedGold < cost || current >= (node.cap ?? defenseRules.maximumUpgradeRank)) return [];
  state.bankedGold -= cost;
  d.ranks[command.dragon][command.node]++;
  return [{ type: 'save' }, { type: 'message', text: 'Permanent upgrade purchased' }];
}

function setPaused(state: GameState, command: Extract<GameCommand, { type: 'pause' | 'resume' }>): GameEvent[] {
  if (command.type === 'resume') state.paused = false;
  else if (state.phase === 'battle' || (state.defense && state.phase === 'ready' && state.defense.countdown !== null))
    state.paused = true;
  return [];
}

function selectPerch(state: GameState, index: number): GameEvent[] {
  if (!Number.isInteger(index) || index < 0 || index >= state.towers.length) return [];
  if (state.towers[index]) {
    state.selected = index;
    state.chosen = null;
    return [];
  }
  if (!state.chosen) return [{ type: 'message', text: 'Choose a dragon first' }];
  const challenge = getMap(state.activeLevel).challenge;
  if (challenge && state.chosen !== challenge.dragon) return [];
  const dragon = dragons[state.chosen];
  if (state.gold < dragon.cost && state.defense?.mode !== 'sandbox')
    return [{ type: 'message', text: state.defense ? 'Not enough food' : 'Not enough gold' }];
  if (state.defense?.mode !== 'sandbox') state.gold -= dragon.cost;
  state.towers[index] = { type: state.chosen, level: 1, cooldown: 0 };
  if (state.defense) {
    state.defense.mana = Math.min(
      state.defense.maxMana,
      state.defense.mana + defenseRules.placementManaPerRank * rankOf(state, 'fire', 'placementMana'),
    );
    if (state.chosen === 'ice') Object.assign(state.towers[index]!, { charges: 1, chargeTimer: defenseRules.iceChargeIntervalMs });
  }
  state.selected = index;
  state.chosen = null;
  return [{ type: 'save' }];
}

function placeTower(state: GameState, point: { x: number; y: number }): GameEvent[] {
  if (!state.chosen) return [{ type: 'message', text: 'Choose a dragon first' }];
  const challenge = getMap(state.activeLevel).challenge;
  if (challenge && state.chosen !== challenge.dragon) return [];
  if (!canPlaceTower(state, point))
    return [{ type: 'message', text: 'Choose a clear area away from the road and other dragons' }];

  const dragon = dragons[state.chosen];
  if (state.gold < dragon.cost && state.defense?.mode !== 'sandbox')
    return [{ type: 'message', text: state.defense ? 'Not enough food' : 'Not enough gold' }];

  if (state.defense?.mode !== 'sandbox') state.gold -= dragon.cost;
  const index = state.towers.findIndex((tower) => tower === null);
  const slot = index < 0 ? state.towers.length : index;
  const tower = { type: state.chosen, level: 1, cooldown: 0, position: { ...point } };
  if (state.defense && state.chosen === 'ice') Object.assign(tower, { charges: 1, chargeTimer: defenseRules.iceChargeIntervalMs });
  state.towers[slot] = tower;
  if (state.defense) {
    state.defense.mana = Math.min(
      state.defense.maxMana,
      state.defense.mana + defenseRules.placementManaPerRank * rankOf(state, 'fire', 'placementMana'),
    );
  }
  state.selected = slot;
  state.chosen = null;
  return [{ type: 'save' }];
}

function upgradeTower(state: GameState): GameEvent[] {
  const tower = state.selected === null ? null : state.towers[state.selected];
  if (
    !tower ||
    tower.level >= levelCap(state, tower) ||
    (state.gold < towerUpgradeCost(tower) && state.defense?.mode !== 'sandbox')
  )
    return [];
  if (state.defense?.mode !== 'sandbox') state.gold -= towerUpgradeCost(tower);
  const previousInterval = towerAttackInterval(tower);
  tower.level++;
  const upgradedInterval = towerAttackInterval(tower);
  tower.cooldown = Math.max(0, tower.cooldown + upgradedInterval - previousInterval);
  if (state.defense) tower.cooldown = tower.type === 'fire' && tower.level >= 5 ? 1000 : 0;
  return [{ type: 'save' }, { type: 'message', text: 'Dragon upgraded to level ' + tower.level }];
}

function sellTower(state: GameState): GameEvent[] {
  const tower = state.selected === null ? null : state.towers[state.selected];
  if (!tower || state.selected === null) return [];
  const refund = towerSaleRefund(tower);
  state.gold += refund;
  state.towers[state.selected] = null;
  state.selected = null;
  return [{ type: 'save' }, { type: 'message', text: 'Dragon sold · ' + refund + (state.defense ? ' food' : ' gold') }];
}
