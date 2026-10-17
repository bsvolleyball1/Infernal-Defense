import { dragons } from '../content/catalog';
import { towerAttackInterval, towerSaleRefund, towerUpgradeCost } from './rules';
import { startWave } from './waves';
import type { DragonType, GameCommand, GameEvent, GameState, MonsterKind, Point, Tower } from './types';
import { castSpell } from './spells';
import { levelCap, rankOf } from './defense-state';
import { upgradeTrees, upgradeCost } from '../content/upgrades';
import { isDefenseMonster } from '../content/enemies';
import { defenseRules } from '../content/defense-rules';
import { canPlaceTower, clampToBattlefield } from './geometry';
import { getMap } from '../content/catalog';
import { currencyOf } from './ruleset';

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
    default:
      return battleInputBlocked(state) ? [] : applyBattleCommand(state, command);
  }
}

/** Commands that act on the battlefield and are ignored after a result or while paused. */
type BattleCommand = Exclude<GameCommand, { type: 'buyPermanent' | 'pause' | 'resume' | 'speed' }>;

function applyBattleCommand(state: GameState, command: BattleCommand): GameEvent[] {
  switch (command.type) {
    case 'spell':
      return castSpell(state, command.spell, command.point);
    case 'spellTarget':
      return setSpellTarget(state, command.spell);
    case 'previewSpell':
      return previewSpell(state, command.point);
    case 'testWave':
      return setTestWave(state, command.counts);
    case 'choose':
      return chooseDragon(state, command.dragon);
    case 'perch':
      return selectPerch(state, command.index);
    case 'place':
      return placeTower(state, command.point);
    case 'upgrade':
      return upgradeTower(state, command);
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

/** Only area spells take a target; a challenge level allows only its own spell. */
function setSpellTarget(state: GameState, spell: 'poison' | 'fire' | null): GameEvent[] {
  if (!state.defense || ![null, 'fire', 'poison'].includes(spell)) return [];
  const challenge = getMap(state.activeLevel).challenge;
  if (challenge && spell !== null && challenge.spell !== spell) return [];
  state.defense.targeting = spell;
  state.defense.preview = null;
  return [];
}

function previewSpell(state: GameState, point: Point): GameEvent[] {
  if (state.defense?.targeting && Number.isFinite(point.x) && Number.isFinite(point.y))
    state.defense.preview = clampToBattlefield(point, getMap(state.activeLevel));
  return [];
}

function setTestWave(state: GameState, counts: Partial<Record<MonsterKind, number>>): GameEvent[] {
  const valid = Object.entries(counts).every(
    ([kind, n]) => isDefenseMonster(kind) && typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 999,
  );
  if (state.defense?.mode === 'sandbox' && valid) state.defense.testWave = { ...counts };
  return [];
}

function chooseDragon(state: GameState, dragon: DragonType): GameEvent[] {
  const challenge = getMap(state.activeLevel).challenge;
  if (!Object.prototype.hasOwnProperty.call(dragons, dragon) || (challenge && challenge.dragon !== dragon)) return [];
  state.chosen = dragon;
  state.selected = null;
  return [];
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
  return purchaseTower(state, index);
}

function placeTower(state: GameState, point: Point): GameEvent[] {
  const free = state.towers.findIndex((tower) => tower === null);
  return purchaseTower(state, free < 0 ? state.towers.length : free, point);
}

/** Buys the chosen dragon into a slot; free placement also checks the ground at `position`. */
function purchaseTower(state: GameState, slot: number, position?: Point): GameEvent[] {
  const type = state.chosen;
  if (!type) return [{ type: 'message', text: 'Choose a dragon first' }];
  const challenge = getMap(state.activeLevel).challenge;
  if (challenge && type !== challenge.dragon) return [];
  if (position && !canPlaceTower(state, position))
    return [{ type: 'message', text: 'Choose a clear area away from the road and other dragons' }];
  const cost = dragons[type].cost;
  if (state.gold < cost && !isSandbox(state))
    return [{ type: 'message', text: `Not enough ${currencyOf(state).name}` }];
  if (!isSandbox(state)) state.gold -= cost;
  state.towers[slot] = newTower(state, type, position);
  if (state.defense)
    state.defense.mana = Math.min(
      state.defense.maxMana,
      state.defense.mana + defenseRules.placementManaPerRank * rankOf(state, 'fire', 'placementMana'),
    );
  state.selected = slot;
  state.chosen = null;
  return [{ type: 'save' }];
}

function newTower(state: GameState, type: DragonType, position?: Point): Tower {
  const placed = position ? { position: { ...position } } : {};
  if (type !== 'ice') return { type, level: 1, cooldown: 0, ...placed };
  const charged = state.defense ? { charges: 1, chargeTimer: defenseRules.iceChargeIntervalMs } : {};
  return { type, level: 1, cooldown: 0, ...placed, ...charged };
}

/** Sandbox battles ignore food costs. */
function isSandbox(state: GameState): boolean {
  return state.defense?.mode === 'sandbox';
}

function upgradeTower(state: GameState): GameEvent[] {
  const tower = state.selected === null ? null : state.towers[state.selected];
  if (!tower || tower.level >= levelCap(state, tower) || (state.gold < towerUpgradeCost(tower) && !isSandbox(state)))
    return [];
  if (!isSandbox(state)) state.gold -= towerUpgradeCost(tower);
  const previousInterval = towerAttackInterval(tower);
  tower.level++;
  tower.colors = nextColors;
  tower.form = choice.form;
  delete tower.charges;
  delete tower.chargeTimer;
  delete tower.beamIds;
  const upgradedInterval = towerAttackInterval(tower);
  tower.cooldown = Math.max(0, tower.cooldown + upgradedInterval - previousInterval);
  if (state.defense) tower.cooldown = 0;
  return [
    { type: 'save' },
    { type: 'message', text: `${dragonForms[formForTower(tower)].name} · Tier ${tower.level}` },
  ];
}

function sellTower(state: GameState): GameEvent[] {
  const tower = state.selected === null ? null : state.towers[state.selected];
  if (!tower || state.selected === null) return [];
  const refund = towerSaleRefund(tower);
  state.gold += refund;
  state.towers[state.selected] = null;
  state.selected = null;
  return [{ type: 'save' }, { type: 'message', text: `Dragon sold · ${refund} ${currencyOf(state).name}` }];
}
