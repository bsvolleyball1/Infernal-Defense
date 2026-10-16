import { dragons, getMap } from '../content/catalog';
import type { GameState, Level, Point, Projectile } from '../game/types';
import { battlefieldArtwork } from './battlefield';
import {
  presentBattle,
  presentEggs,
  presentEnemies,
  presentPlacedTowers,
  presentSelectionRange,
  type EggSprite,
  type EnemySprite,
  type PlacedTowerView,
} from './battle-view-model';
import { DefenseEffects } from './defense-effects';
import { dragonPortrait } from './dragon-art';
import { element } from './dom';
import { createEggSprite, updateEggSprite } from './egg-view';
import { createEnemySprite, enemySpriteStale, updateEnemySprite } from './enemy-view';
import { HudView } from './hud-view';
import { KeyedLayer } from './keyed-layer';
import { PlacementView } from './placement-view';
import { ResultsView } from './results-view';
import { SummonView } from './summon-view';
import { attr, node, setPortrait } from './svg';
import { TowerActionsPopover } from './tower-actions';

export interface Renderer {
  render(state: GameState, showResults: boolean): void;
  renderPlacement(point: Point | null, state: GameState): void;
  /** Closes the selected dragon's popover and range until it is chosen again. */
  dismissTowerActions(): void;
  reopenTowerActions(): void;
  /** Closes the popover after an upgrade or sale and returns focus to the dragon. */
  afterTowerAction(): void;
}

const towerMarkup =
  '<circle class="tower-aura" r="19" fill="#18221d" stroke="#f0d58b" stroke-width="2"/><image class="tower-icon" x="-17" y="-17" width="34" height="34" preserveAspectRatio="xMidYMid meet"/><circle class="tower-hit" r="24" fill="transparent" pointer-events="all"/>';

/** Draws the battlefield from simulation state. Input handling lives in BattlefieldInput. */
export class SvgRenderer implements Renderer {
  private readonly placement = new PlacementView();
  private readonly summon = new SummonView();
  private readonly range = node('circle');
  private activeLevel: Level | null = null;
  private state: GameState | null = null;
  private readonly popover = new TowerActionsPopover();
  private readonly defenseEffects = new DefenseEffects();
  private readonly hud = new HudView();
  private readonly results = new ResultsView();
  private readonly towers = new KeyedLayer<PlacedTowerView, SVGGElement>({
    key: (item) => item.index,
    create: (item) => this.createTower(item.index),
    update: (group, item) => this.updateTower(group, item),
  });
  private readonly enemies = new KeyedLayer<EnemySprite>({
    key: (enemy) => enemy.id,
    create: createEnemySprite,
    update: updateEnemySprite,
    stale: enemySpriteStale,
  });
  private readonly shots = new KeyedLayer<Projectile>({
    key: (shot) => shot.id,
    create: (shot) => this.createShot(shot),
    update: (circle, shot) => {
      attr(circle, 'cx', shot.x);
      attr(circle, 'cy', shot.y);
    },
  });
  private readonly eggs = new KeyedLayer<EggSprite>({
    key: (egg) => egg.id,
    create: () => createEggSprite(),
    update: updateEggSprite,
  });

  constructor() {
    attr(this.range, 'fill', 'none');
    attr(this.range, 'stroke-dasharray', '4 5');
    attr(this.range, 'opacity', '.4');
    element('#effects').append(this.range);
  }

  render(state: GameState, showResults: boolean): void {
    this.state = state;
    const view = presentBattle(state, showResults);
    this.ensureBattlefield(state);
    this.popover.sync(state);
    this.hud.render(view);
    this.towers.sync(presentPlacedTowers(state), element('#towers'));
    this.placement.render(state);
    this.summon.render(state);
    this.enemies.sync(presentEnemies(state), element('#enemies'));
    this.shots.sync(state.projectiles, element('#effects'));
    this.eggs.sync(presentEggs(state), element('#eggObjects'));
    this.renderSelectionRange(state);
    this.results.render(view);
    this.defenseEffects.render(state);
    this.popover.position();
  }

  renderPlacement(point: Point | null, state: GameState): void {
    this.placement.setPoint(point);
    this.placement.render(state);
  }

  dismissTowerActions(): void {
    this.popover.dismiss();
    this.range.setAttribute('visibility', 'hidden');
  }

  reopenTowerActions(): void {
    this.popover.reopen();
  }

  afterTowerAction(): void {
    this.popover.dismissAfterAction();
  }

  /** Redraws terrain only when the level changes; entity nodes are rebuilt with it. */
  private ensureBattlefield(state: GameState): void {
    if (this.activeLevel === state.activeLevel) return;
    this.activeLevel = state.activeLevel;
    const geometry = getMap(state.activeLevel);
    const map = element<SVGSVGElement>('#map');
    map.innerHTML = battlefieldArtwork(state.activeLevel);
    map.setAttribute(
      'aria-label',
      `${geometry.name}. ${geometry.description} Dragons can be placed on clear ground away from the road.`,
    );
    map.style.background = geometry.background;
    for (const layer of [this.enemies, this.eggs, this.shots, this.towers]) layer.clear();
    element('#effects').append(this.range);
  }

  private createTower(index: number): SVGGElement {
    const group = node<SVGGElement>('g', towerMarkup);
    group.classList.add('tower-marker');
    group.setAttribute('role', 'button');
    group.dataset.id = String(index);
    return group;
  }

  private updateTower(group: SVGGElement, tower: PlacedTowerView): void {
    attr(group, 'transform', `translate(${tower.x} ${tower.y})`);
    attr(group, 'aria-label', tower.label);
    attr(group, 'aria-disabled', String(tower.inactive));
    attr(group, 'tabindex', tower.inactive ? -1 : 0);
    attr(group.querySelector('.tower-aura')!, 'fill', tower.color);
    setPortrait(group.querySelector('.tower-icon')!, dragonPortrait(tower.type, tower.level));
    const state = this.current();
    group.style.filter =
      tower.index === state.selected && !this.popover.isDismissed(tower.index) ? 'drop-shadow(0 0 7px #ffdd82)' : '';
  }

  private createShot(shot: Projectile): SVGElement {
    const circle = node('circle');
    attr(circle, 'r', shot.dragon === 'fire' ? 4 : 3.5);
    attr(circle, 'fill', dragons[shot.dragon].color);
    attr(circle, 'stroke', '#f3e7c9');
    attr(circle, 'stroke-width', 1);
    return circle;
  }

  private renderSelectionRange(state: GameState): void {
    const range = presentSelectionRange(state);
    const shown = range !== null && state.selected !== null && !this.popover.isDismissed(state.selected);
    attr(this.range, 'visibility', shown ? 'visible' : 'hidden');
    if (!range) return;
    attr(this.range, 'cx', range.x);
    attr(this.range, 'cy', range.y);
    attr(this.range, 'r', range.radius);
    attr(this.range, 'stroke', range.color);
  }

  /** The state of the render in progress; layers only update during render. */
  private current(): GameState {
    if (!this.state) throw new Error('Renderer used before its first render.');
    return this.state;
  }
}
