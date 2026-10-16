import { dragons, getMap } from '../content/catalog';
import { defenseRules } from '../content/defense-rules';
import { enemyRoster, isDefenseMonster } from '../content/enemies';
import { defenseRange } from '../game/defense-combat';
import { canPlaceTower, entityPosition, towerPosition } from '../game/geometry';
import { towerRange } from '../game/rules';
import { towerBonus } from '../game/tower-bonuses';
import type { DragonType, GameState, MonsterKind, Point } from '../game/types';

export function presentSelectionRange(
  state: GameState,
): { x: number; y: number; radius: number; color: string } | null {
  const selected = state.selected === null ? null : state.towers[state.selected];
  if (!selected || state.selected === null) return null;
  const position = towerPosition(state, state.selected);
  return {
    x: position.x,
    y: position.y,
    radius: state.defense ? defenseRange(state, selected) : towerRange(selected),
    color: dragons[selected.type].color,
  };
}

/** Accessible name for a placed dragon, including any bonus area it occupies. */
export function presentTowerLabel(state: GameState, index: number): string {
  const tower = state.towers[index];
  if (!tower) return '';
  const bonus = towerBonus(state, index);
  const resourceRate =
    bonus?.kind === 'mana'
      ? bonus.manaPerSecond
      : bonus?.kind === 'food'
        ? bonus.foodPerSecond
        : bonus?.kind === 'gold'
          ? bonus.goldPerSecond
          : 0;
  const bonusLabel =
    bonus?.kind === 'damage'
      ? `, damage bonus +${Math.round((bonus.damageMultiplier - 1) * 100)}%`
      : bonus?.kind === 'range'
        ? `, range bonus +${Math.round((bonus.rangeMultiplier - 1) * 100)}%`
        : bonus
          ? `, ${bonus.kind} bonus${state.defense?.mode === 'sandbox' ? ' (journey only)' : ` +${resourceRate.toFixed(2)}/s`}`
          : '';
  return `${dragons[tower.type].name}, level ${tower.level}, dragon ${index + 1}${bonusLabel}`;
}

export interface PlacedTowerView {
  index: number;
  x: number;
  y: number;
  label: string;
  inactive: boolean;
  color: string;
  type: DragonType;
  level: number;
}

/** One placed dragon, with its map position already resolved. */
export function presentPlacedTowers(state: GameState): PlacedTowerView[] {
  const inactive = state.phase === 'won' || state.phase === 'lost' || state.paused;
  return state.towers.flatMap((tower, index) => {
    if (!tower) return [];
    const position = towerPosition(state, index);
    return [
      {
        index,
        x: position.x,
        y: position.y,
        label: presentTowerLabel(state, index),
        inactive,
        color: dragons[tower.type].color,
        type: tower.type,
        level: tower.level,
      },
    ];
  });
}

export interface PlacementPreview {
  x: number;
  y: number;
  valid: boolean;
  dragon: DragonType;
}

/** The ghost dragon under the pointer, or nothing when placement is closed. */
export function presentPlacement(state: GameState, point: Point | null): PlacementPreview | null {
  if (!state.chosen || !point || state.paused || state.phase === 'won' || state.phase === 'lost') return null;
  return { x: point.x, y: point.y, valid: canPlaceTower(state, point), dragon: state.chosen };
}

export interface SummonControlView {
  visible: boolean;
  interactive: boolean;
  x: number;
  y: number;
  /** Fraction of the early-summon window still open, from 0 to 1. */
  remaining: number;
  label: string;
}

/** Journey summon button at the road entrance. Hidden outside a ready journey. */
export function presentSummon(state: GameState): SummonControlView {
  const defense = state.defense;
  const visible = defense?.mode === 'journey' && state.phase === 'ready';
  const countdown = defense?.countdown ?? null;
  const remaining = countdown === null ? 0 : Math.max(0, Math.min(1, countdown / defenseRules.waveCountdownMs));
  const seconds = Math.ceil((countdown ?? 0) / 1000);
  return {
    visible,
    interactive: visible && !state.paused,
    x: 29,
    y: getMap(state.activeLevel).path[0][1],
    remaining,
    label:
      countdown === null
        ? `Summon wave ${state.wave + 1}`
        : `Summon wave ${state.wave + 1}; ${seconds} seconds remain for the early summon mana bonus`,
  };
}

export interface EnemySprite {
  id: number;
  kind: MonsterKind;
  x: number;
  y: number;
  hpWidth: number;
  frozen: boolean;
  opacity: number;
  appearance: string;
  shielded: boolean;
  name: string;
  showName: boolean;
}

export function presentEnemies(state: GameState): EnemySprite[] {
  const mode = state.defense?.mode ?? 'legacy';
  return state.enemies.map((enemy) => {
    const [x, y] = entityPosition(state, enemy);
    return {
      id: enemy.id,
      kind: enemy.kind,
      x,
      y,
      hpWidth: 22 * Math.max(0, enemy.hp / enemy.max),
      frozen: state.defense ? (enemy.frozen ?? 0) > 0 : enemy.slow > 0,
      opacity:
        (enemy.untargetable ?? 0) > 0 ? 0.3 : (enemy.invulnerable ?? 0) > 0 || (enemy.deathDelay ?? 0) > 0 ? 0.6 : 1,
      appearance: `${enemy.kind}:${mode}`,
      shielded: enemy.kind === 'shield',
      name: isDefenseMonster(enemy.kind) ? enemyRoster[enemy.kind].name : enemy.kind,
      showName: mode === 'sandbox',
    };
  });
}

export interface EggSprite {
  id: number;
  x: number;
  y: number;
}

/** Eggs in the nest, on the road, or riding a carrier. Escaped eggs are omitted. */
export function presentEggs(state: GameState): EggSprite[] {
  const map = getMap(state.activeLevel);
  return state.eggs.flatMap((egg) => {
    if (egg.status === 'escaped') return [];
    let x = map.nest.x - 16 + (egg.id - 1) * 8;
    let y = map.nest.y + 1;
    if (egg.status === 'dropped') {
      const [roadX, roadY] = entityPosition(state, {
        progress: egg.progress ?? 0,
        routeId: egg.routeId,
        direct: egg.direct,
      });
      x = roadX;
      y = roadY - 7;
    }
    if (egg.status === 'carried') {
      const carrier = state.enemies.find((enemy) => enemy.id === egg.carrier);
      if (carrier) {
        const [roadX, roadY] = entityPosition(state, carrier);
        x = roadX;
        y = roadY - 18;
      }
    }
    return [{ id: egg.id, x, y }];
  });
}
