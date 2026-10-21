import { challengeAllowsDragon } from '../content/maps';
import { formatGold } from './currency-format';
import { dragonForms, colorForDragon } from '../content/dragon-forms';
import { evolutionOwner } from './evolution-view-model';
import { dragons, getMap } from '../content/catalog';
import { defenseRules } from '../content/defense-rules';
import { defenseRange, towerSummary } from '../game/defense-combat';
import { levelCap } from '../game/defense-state';
import { currencyOf } from '../game/ruleset';
import { battleRules, towerRange, towerUpgradeCost } from '../game/rules';
import { towerBonus, towerRangeMultiplier } from '../game/tower-bonuses';
import type { DragonType, GameState } from '../game/types';

export {
  presentEggs,
  presentEnemies,
  presentPlacement,
  presentPlacedTowers,
  presentSelectionRange,
  presentSummon,
  presentTowerLabel,
  type EggSprite,
  type EnemySprite,
  type PlacementPreview,
  type PlacedTowerView,
  type SummonControlView,
} from './sprite-view-model';

export interface PlacementButton {
  type: DragonType;
  selected: boolean;
  label: string;
  disabled: boolean;
  /** Challenge levels allow only their own dragon. */
  hidden: boolean;
}

export interface BattleViewModel {
  gold: string;
  evolutionOwner: string;
  wave: string;
  lives: string;
  hpText: string;
  hpWidth: string;
  nestCount: string;
  startLabel: string;
  startDisabled: boolean;
  /** The overlay button supplements the journey's map summon control. */
  startHidden: boolean;
  waveState: string;
  waveTitle: string;
  waveDesc: string;
  levelHeading: string;
  speed: string;
  pauseGlyph: string;
  pauseAria: string;
  pauseDisabled: boolean;
  pauseOverlayHidden: boolean;
  upgradeDisabled: boolean;
  sellDisabled: boolean;
  upgradeLabel: string;
  actionCost: string;
  sellLabel: string;
  info: string;
  placement: PlacementButton[];
  showResults: boolean;
  ended: boolean;
  resultKicker: string;
  resultTitle: string;
  resultEnemies: string;
  resultEggs: string;
  resultGold: string;
  bankedGold: string;
}

/** Pure HUD and result copy. Views bind this model and do not call game rules. */
export function presentBattle(state: GameState, showResults: boolean): BattleViewModel {
  const lives = state.eggs.filter((egg) => egg.status !== 'escaped').length;
  const battle = state.phase === 'battle';
  const ended = state.phase === 'won' || state.phase === 'lost';
  const selected = state.selected === null ? null : state.towers[state.selected];
  const selectedPerch = selected ? state.selected : null;
  const money = currencyOf(state);
  const upgradeLabel = selected
    ? selected.level >= levelCap(state, selected)
      ? 'Maximum dragon level'
      : `Upgrade · ${towerUpgradeCost(selected)} ${money.name}`
    : 'Upgrade dragon';
  let info =
    state.defense?.ruleset === 'defense-2'
      ? 'Choose a dragon, then tap an empty, open grid cell.'
      : 'Choose a dragon, then tap clear ground away from the road.';
  if (selected && selectedPerch !== null) {
    const bonus = towerBonus(state, selectedPerch);
    const range = Math.round(towerRange(selected) * towerRangeMultiplier(state, selectedPerch));
    info = `${dragons[selected.type].name} · Level ${selected.level} · Range ${range}${bonus ? ` · ${bonus.kind} bonus` : ''}`;
  }
  if (selected && state.defense)
    info = `${selected.evolution ? dragonForms[selected.evolution.form].name : dragons[selected.type].name} · ${selected.evolution ? 'Tier' : 'Level'} ${selected.level} / ${levelCap(state, selected)} · ${towerSummary(state, selected)} · Range ${Math.round(defenseRange(state, selected))}`;
  else if (state.chosen)
    info = `${state.defense?.ruleset === 'defense-2' ? dragonForms[colorForDragon[state.chosen]].name : dragons[state.chosen].name} · ${dragons[state.chosen].cost} ${money.name} · ${state.defense?.ruleset === 'defense-2' ? 'Choose an open cell.' : 'Choose clear ground.'}`;

  const sandbox = state.defense?.mode === 'sandbox';
  const countdown = state.defense?.countdown ?? null;
  const evolved = state.defense?.ruleset === 'defense-2';
  const seconds = countdown === null ? 0 : Math.ceil(countdown / 1000);
  const startLabel = sandbox
    ? battle
      ? 'Test wave in progress'
      : 'Summon'
    : countdown !== null
      ? `Summon wave ${state.wave + 1} · +${seconds * defenseRules.earlyWaveManaPerSecond} mana (${seconds}s)`
      : state.phase === 'lost'
        ? 'Nest fallen'
        : state.phase === 'won'
          ? 'Valley defended'
          : battle
            ? 'Wave in progress'
            : `Begin wave ${state.wave + 1}`;

  return {
    evolutionOwner: evolutionOwner(state),
    gold: sandbox ? '∞' : state.defense ? String(Math.floor(state.gold)) : formatGold(state.gold),
    wave: sandbox ? String(state.wave) : `${state.wave} / ${battleRules.waveCount}`,
    lives: String(lives),
    hpText: `${lives} / ${state.eggs.length}`,
    hpWidth: `${(lives / state.eggs.length) * 100}%`,
    nestCount: `${state.eggs.filter((egg) => egg.status === 'nest').length} in nest`,
    startLabel,
    startDisabled: battle || ended,
    startHidden: false,
    waveState: battle
      ? state.paused
        ? 'PAUSED'
        : 'UNDER ATTACK'
      : state.phase === 'won'
        ? 'CLEARED'
        : state.phase === 'lost'
          ? 'FALLEN'
          : 'READY',
    waveTitle: battle
      ? 'Raiders on the pass'
      : state.phase === 'won'
        ? 'The eggs are safe'
        : state.phase === 'lost'
          ? 'The nest has fallen'
          : 'The raiders are gathering',
    waveDesc: battle
      ? 'Dragons attack automatically when raiders enter range.'
      : state.phase === 'won'
        ? 'All five waves repelled. The valley is yours.'
        : state.phase === 'lost'
          ? 'Return to the menu to begin another journey.'
          : state.activeLevel === 'tutorial'
            ? 'Training exercise: place dragons, then begin the wave.'
            : 'Place your dragons, then begin the wave.',
    levelHeading: sandbox
      ? 'Test Mode'
      : `${state.activeLevel === 'tutorial' ? 'Tutorial · ' : ''}${getMap(state.activeLevel, state.defense?.ruleset, state.defense?.mobileLayout).name}`,
    speed: `${state.speed}×`,
    pauseGlyph: state.paused ? '▶' : 'Ⅱ',
    pauseAria: state.paused ? 'Resume' : 'Pause',
    pauseDisabled: false,
    pauseOverlayHidden: !((battle || state.defense) && state.paused),
    upgradeDisabled:
      !selected ||
      selected.level >= levelCap(state, selected) ||
      (state.gold < towerUpgradeCost(selected) && state.defense?.mode !== 'sandbox') ||
      ended ||
      state.paused,
    sellDisabled: !selected || ended || state.paused,
    upgradeLabel,
    actionCost: selected ? `${money.icon} ${state.defense?.mode === 'sandbox' ? '∞' : towerUpgradeCost(selected)}` : '',
    sellLabel: `Sell dragon · ${Math.round(battleRules.saleFraction * 100)}% refund`,
    info,
    placement: (Object.keys(dragons) as DragonType[]).map((type) => {
      const chosen = type === state.chosen;
      const hidden = !challengeAllowsDragon(getMap(state.activeLevel), type);
      return {
        type,
        selected: chosen,
        label: `${evolved ? dragonForms[colorForDragon[type]].name : dragons[type].name} dragon · ${dragons[type].cost} ${money.name}${chosen ? ' · selected for placement' : ' · choose for placement'}`,
        disabled: ended || state.paused || hidden,
        hidden,
      };
    }),
    showResults: ended && showResults,
    ended,
    resultKicker: state.phase === 'won' ? 'All waves cleared' : 'The nest was breached',
    resultTitle: state.phase === 'won' ? 'Valley defended' : 'The nest has fallen',
    resultEnemies: `${state.enemiesKilled} / ${state.enemiesSummoned}`,
    resultEggs: `${lives} / ${state.eggs.length}`,
    resultGold: `${formatGold(state.rewardGold)} gold`,
    bankedGold: `${formatGold(state.bankedGold)} gold`,
  };
}
