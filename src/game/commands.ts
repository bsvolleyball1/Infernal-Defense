import { dragons, getMap } from '../content/catalog';
import { towerAttackInterval, towerSaleRefund, towerUpgradeCost } from './rules';
import { startWave } from './waves';
import type { GameCommand, GameEvent, GameState } from './types';
import { castSpell } from './spells';
import { rank, levelCap } from './defense-state';
import { upgradeTrees, upgradeCost } from '../content/upgrades';
import { isDefenseMonster } from '../content/enemies';
import { defenseRules } from '../content/defense-rules';

/** Commands mutate only engine-owned state and return data-only events. */
export function applyCommand(state: GameState, command: GameCommand): GameEvent[] {
  if (command.type === 'buyPermanent') {
    const d = state.defense,
      node = upgradeTrees[command.dragon]?.nodes[command.node];
    if (!d || d.mode === 'sandbox' || state.phase === 'battle' || !node || !Number.isInteger(command.node))
      return [];
    const current = d.ranks[command.dragon][command.node],
      cost = upgradeCost(current);
    if (state.bankedGold < cost || current >= (node.cap ?? defenseRules.maximumUpgradeRank)) return [];
    state.bankedGold -= cost;
    d.ranks[command.dragon][command.node]++;
    return [{ type: 'save' }, { type: 'message', text: 'Permanent upgrade purchased' }];
  }
  if (command.type === 'pause' || command.type === 'resume') {
    if (command.type === 'resume') state.paused = false;
    else if (
      state.phase === 'battle' ||
      (state.defense && state.phase === 'ready' && state.defense.countdown !== null)
    )
      state.paused = true;
    return [];
  }
  if (command.type === 'speed') {
    if ([1, 1.5, 2].includes(command.speed)) state.speed = command.speed;
    return [];
  }
  if (state.phase === 'won' || state.phase === 'lost' || (state.phase === 'battle' && state.paused))
    return [];
  if (state.defense && state.paused) return [];
  switch (command.type) {
    case 'spell':
      return castSpell(state, command.spell, command.point);
    case 'spellTarget':
      if (state.defense && [null, 'fire', 'poison'].includes(command.spell)) {
        state.defense.targeting = command.spell;
        state.defense.preview = null;
      }
      return [];
    case 'previewSpell':
      if (state.defense?.targeting && Number.isFinite(command.point.x) && Number.isFinite(command.point.y))
        state.defense.preview = {
          x: Math.max(0, Math.min(700, command.point.x)),
          y: Math.max(0, Math.min(430, command.point.y)),
        };
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
      if (!Object.prototype.hasOwnProperty.call(dragons, command.dragon)) return [];
      state.chosen = command.dragon;
      state.selected = null;
      return [];
    case 'perch':
      return selectPerch(state, command.index);
    case 'upgrade':
      return upgradeTower(state);
    case 'sell':
      return sellTower(state);
    case 'startWave':
      return startWave(state);
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
  if (state.gold < dragon.cost && state.defense?.mode !== 'sandbox')
    return [{ type: 'message', text: state.defense ? 'Not enough food' : 'Not enough gold' }];
  if (state.defense?.mode !== 'sandbox') state.gold -= dragon.cost;
  state.towers[index] = { type: state.chosen, level: 1, cooldown: 0 };
  if (state.defense) {
    state.defense.mana = Math.min(
      state.defense.maxMana,
      state.defense.mana + defenseRules.placementManaPerRank * rank(state, 'fire', 2),
    );
    if (state.chosen === 'ice') Object.assign(state.towers[index]!, { charges: 1, chargeTimer: 1000 });
  }
  state.selected = index;
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
  return [
    { type: 'save' },
    { type: 'message', text: 'Dragon sold · ' + refund + (state.defense ? ' food' : ' gold') },
  ];
}
