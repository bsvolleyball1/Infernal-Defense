import { dragons, getMap } from '../content/catalog';
import type { Egg, Enemy, GameState, Level, Point, Projectile, Tower } from '../game/types';
import { canPlaceTower, entityPosition, towerPosition } from '../game/geometry';
import { battlefieldArtwork } from './battlefield';
import { towerRange } from '../game/rules';
import { element } from './dom';
import { enemyRoster, isDefenseMonster } from '../content/enemies';
import { defenseRange } from '../game/defense-combat';
import { defenseRules } from '../content/defense-rules';
import { DefenseEffects } from './defense-effects';
import { HudView } from './hud-view';
import { ResultsView } from './results-view';
import { presentBattle, presentTowerLabel } from './battle-view-model';
import { dragonPortrait } from './dragon-art';
import { monsterPortrait } from './monster-art';
import { KeyedLayer } from './keyed-layer';
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

const NS = 'http://www.w3.org/2000/svg';
const XLINK = 'http://www.w3.org/1999/xlink';

/** Parses markup in the SVG namespace. innerHTML on a detached SVG node does not. */
function appendMarkup(parent: SVGElement, markup: string): void {
  const parsed = new DOMParser().parseFromString(`<svg xmlns="${NS}">${markup}</svg>`, 'image/svg+xml');
  for (const child of [...parsed.documentElement.childNodes]) parent.appendChild(child);
}

function node<T extends SVGElement = SVGElement>(tag: string, markup = ''): T {
  const created = document.createElementNS(NS, tag) as T;
  if (markup) appendMarkup(created, markup);
  return created;
}

function attr(n: Element, name: string, value: string | number): void {
  const text = String(value);
  if (n.getAttribute(name) !== text) n.setAttribute(name, text);
}

function setPortrait(image: Element, url: string): void {
  image.setAttribute('href', url);
  image.setAttributeNS(XLINK, 'href', url);
}

const towerMarkup =
  '<circle class="tower-aura" r="19" fill="#18221d" stroke="#f0d58b" stroke-width="2"/><image class="tower-icon" x="-17" y="-17" width="34" height="34" preserveAspectRatio="xMidYMid meet"/><circle class="tower-hit" r="24" fill="transparent" pointer-events="all"/>';
const placementMarkup =
  '<circle class="placement-ring" r="23" fill="none" stroke-width="2" stroke-dasharray="4 3"/><image class="placement-icon" x="-18" y="-18" width="36" height="36" preserveAspectRatio="xMidYMid meet"/>';
const summonMarkup =
  '<circle class="summon-hit" r="54" fill="transparent"/><circle r="31" fill="#18221d" fill-opacity=".86" stroke="#c78a6a" stroke-width="2"/><circle class="summon-track" r="25" fill="none" stroke="#f3ead3" stroke-opacity=".25" stroke-width="3"/><circle class="summon-progress" r="25" fill="none" stroke="#e0b45f" stroke-width="3" stroke-linecap="round" transform="rotate(-90)"/><text class="summon-icon" text-anchor="middle" y="8" font-size="23" aria-hidden="true">👹</text>';
const eggMarkup =
  '<ellipse cy="5" rx="5" ry="2" fill="#263324" opacity=".3"/><ellipse rx="4" ry="6" fill="#f1e3b0" stroke="#8c7448"/><ellipse cx="-1" cy="-2" rx="1" ry="2" fill="#fff9de"/>';
const enemyMarkup = (shielded: boolean) =>
  `<ellipse cy="9" rx="12" ry="4" fill="#263324" opacity=".35"/><image class="enemy-icon" x="-12" y="-14" width="24" height="24" preserveAspectRatio="xMidYMid meet"/>${shielded ? '<path d="M-13-7l-4 8 5 9 6-5V-5z" fill="#aeb5a5" stroke="#47524a"/>' : ''}<rect x="-11" y="-19" width="22" height="3" rx="1.5" fill="#433e35"/><rect class="health" x="-11" y="-19" height="3" rx="1.5" fill="#cd6651"/><circle class="frozen" cy="-2" r="13" fill="none" stroke="#8de4ea" stroke-width="2"/>`;
const summonRadius = 25;

interface PlacedTower {
  index: number;
  tower: Tower;
}

/** Draws the battlefield from simulation state. Input handling lives in BattlefieldInput. */
export class SvgRenderer implements Renderer {
  private placementPoint: Point | null = null;
  private placementNode: SVGGElement | null = null;
  private readonly range = node('circle');
  private activeLevel: Level | null = null;
  private state: GameState | null = null;
  private readonly popover = new TowerActionsPopover();
  private readonly defenseEffects = new DefenseEffects();
  private readonly hud = new HudView();
  private readonly results = new ResultsView();
  private readonly towers = new KeyedLayer<PlacedTower, SVGGElement>({
    key: (item) => item.index,
    create: (item) => this.createTower(item.index),
    update: (group, item) => this.updateTower(group, item),
  });
  private readonly enemies = new KeyedLayer<Enemy>({
    key: (enemy) => enemy.id,
    create: (enemy) => this.createEnemy(enemy),
    update: (group, enemy) => this.updateEnemy(group, enemy),
    stale: (group, enemy) => group.getAttribute('data-appearance') !== this.appearance(enemy),
  });
  private readonly shots = new KeyedLayer<Projectile>({
    key: (shot) => shot.id,
    create: (shot) => this.createShot(shot),
    update: (circle, shot) => {
      attr(circle, 'cx', shot.x);
      attr(circle, 'cy', shot.y);
    },
  });
  private readonly eggs = new KeyedLayer<Egg>({
    key: (egg) => egg.id,
    create: () => node('g', eggMarkup),
    update: (group, egg) => this.updateEgg(group, egg),
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
    this.towers.sync(
      state.towers.flatMap((tower, index) => (tower ? [{ index, tower }] : [])),
      element('#towers'),
    );
    this.renderPlacementPreview(state);
    this.renderSummonControl(state);
    this.enemies.sync(state.enemies, element('#enemies'));
    this.shots.sync(state.projectiles, element('#effects'));
    this.eggs.sync(
      state.eggs.filter((egg) => egg.status !== 'escaped'),
      element('#eggObjects'),
    );
    this.renderSelectionRange(state);
    this.results.render(view);
    this.defenseEffects.render(state);
    this.popover.position();
  }

  renderPlacement(point: Point | null, state: GameState): void {
    this.placementPoint = point;
    this.renderPlacementPreview(state);
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

  private updateTower(group: SVGGElement, { index, tower }: PlacedTower): void {
    const state = this.current();
    const inactive = state.phase === 'won' || state.phase === 'lost' || state.paused;
    const position = towerPosition(state, index);
    attr(group, 'transform', `translate(${position.x} ${position.y})`);
    attr(group, 'aria-label', presentTowerLabel(state, index));
    attr(group, 'aria-disabled', String(inactive));
    attr(group, 'tabindex', inactive ? -1 : 0);
    attr(group.querySelector('.tower-aura')!, 'fill', dragons[tower.type].color);
    setPortrait(group.querySelector('.tower-icon')!, dragonPortrait(tower.type, tower.level));
    group.style.filter =
      index === state.selected && !this.popover.isDismissed(index) ? 'drop-shadow(0 0 7px #ffdd82)' : '';
  }

  private renderPlacementPreview(state: GameState): void {
    const layer = element<SVGGElement>('#placementPreview');
    if (!this.placementNode || !this.placementNode.isConnected) {
      this.placementNode = node<SVGGElement>('g', placementMarkup);
      this.placementNode.classList.add('placement-preview');
      this.placementNode.setAttribute('aria-hidden', 'true');
      this.placementNode.setAttribute('pointer-events', 'none');
      layer.append(this.placementNode);
    }
    if (!state.chosen || !this.placementPoint || state.paused || state.phase === 'won' || state.phase === 'lost') {
      this.placementNode.setAttribute('visibility', 'hidden');
      return;
    }
    const valid = canPlaceTower(state, this.placementPoint);
    attr(this.placementNode, 'transform', `translate(${this.placementPoint.x} ${this.placementPoint.y})`);
    attr(this.placementNode, 'visibility', 'visible');
    attr(this.placementNode, 'opacity', '.58');
    attr(this.placementNode.querySelector('.placement-ring')!, 'stroke', valid ? '#c5f39a' : '#ff8671');
    setPortrait(this.placementNode.querySelector('.placement-icon')!, dragonPortrait(state.chosen));
  }

  private renderSummonControl(state: GameState): void {
    const layer = element<SVGGElement>('#summonControl');
    let button = layer.querySelector<SVGGElement>('.summon-control');
    if (!button) {
      button = node<SVGGElement>('g', summonMarkup);
      button.classList.add('summon-control');
      button.setAttribute('role', 'button');
      button.setAttribute('aria-label', 'Summon next wave');
      button.setAttribute('pointer-events', 'all');
      layer.append(button);
    }
    const defense = state.defense;
    const visible = defense?.mode === 'journey' && state.phase === 'ready';
    button.setAttribute('visibility', visible ? 'visible' : 'hidden');
    button.setAttribute('tabindex', visible && !state.paused ? '0' : '-1');
    button.setAttribute('aria-disabled', String(state.paused || !visible));
    if (!visible) return;

    const entranceY = getMap(state.activeLevel).path[0][1];
    attr(button, 'transform', `translate(29 ${entranceY})`);
    const remaining =
      defense.countdown === null ? 0 : Math.max(0, Math.min(1, defense.countdown / defenseRules.waveCountdownMs));
    const circumference = 2 * Math.PI * summonRadius;
    const progress = button.querySelector('.summon-progress')!;
    attr(progress, 'stroke-dasharray', circumference);
    attr(progress, 'stroke-dashoffset', circumference * (1 - remaining));
    attr(progress, 'visibility', remaining > 0 ? 'visible' : 'hidden');
    const seconds = Math.ceil((defense.countdown ?? 0) / 1000);
    button.setAttribute(
      'aria-label',
      defense.countdown === null
        ? `Summon wave ${state.wave + 1}`
        : `Summon wave ${state.wave + 1}; ${seconds} seconds remain for the early summon mana bonus`,
    );
  }

  private appearance(enemy: Enemy): string {
    return `${enemy.kind}:${this.current().defense?.mode ?? 'legacy'}`;
  }

  private createEnemy(enemy: Enemy): SVGElement {
    const group = node('g', enemyMarkup(enemy.kind === 'shield'));
    attr(group, 'data-appearance', this.appearance(enemy));
    setPortrait(group.querySelector('.enemy-icon')!, monsterPortrait(enemy.kind));
    const title = node('title');
    title.textContent = isDefenseMonster(enemy.kind) ? enemyRoster[enemy.kind].name : enemy.kind;
    group.append(title);
    if (this.current().defense?.mode === 'sandbox') {
      const label = node('text');
      label.textContent = title.textContent;
      attr(label, 'y', -25);
      attr(label, 'text-anchor', 'middle');
      attr(label, 'font-size', 9);
      attr(label, 'fill', '#fff1cf');
      group.append(label);
    }
    return group;
  }

  private updateEnemy(group: SVGElement, enemy: Enemy): void {
    const state = this.current();
    const [x, y] = entityPosition(state, enemy);
    attr(group, 'transform', `translate(${x} ${y})`);
    attr(group.querySelector('.health')!, 'width', 22 * Math.max(0, enemy.hp / enemy.max));
    const frozen = state.defense ? (enemy.frozen ?? 0) > 0 : enemy.slow > 0;
    attr(group.querySelector('.frozen')!, 'visibility', frozen ? 'visible' : 'hidden');
    attr(
      group,
      'opacity',
      (enemy.untargetable ?? 0) > 0 ? 0.3 : (enemy.invulnerable ?? 0) > 0 || (enemy.deathDelay ?? 0) > 0 ? 0.6 : 1,
    );
  }

  private createShot(shot: Projectile): SVGElement {
    const circle = node('circle');
    attr(circle, 'r', shot.dragon === 'fire' ? 4 : 3.5);
    attr(circle, 'fill', dragons[shot.dragon].color);
    attr(circle, 'stroke', '#f3e7c9');
    attr(circle, 'stroke-width', 1);
    return circle;
  }

  /** Eggs rest in the nest, lie where they were dropped, or ride above their carrier. */
  private updateEgg(group: SVGElement, egg: Egg): void {
    const state = this.current();
    const map = getMap(state.activeLevel);
    let x = map.nest.x - 16 + (egg.id - 1) * 8,
      y = map.nest.y + 1;
    if (egg.status === 'dropped') {
      [x, y] = entityPosition(state, { progress: egg.progress ?? 0, routeId: egg.routeId, direct: egg.direct });
      y -= 7;
    }
    if (egg.status === 'carried') {
      const carrier = state.enemies.find((enemy) => enemy.id === egg.carrier);
      if (carrier) {
        [x, y] = entityPosition(state, carrier);
        y -= 18;
      }
    }
    attr(group, 'transform', `translate(${x} ${y})`);
  }

  private renderSelectionRange(state: GameState): void {
    const selected = state.selected === null ? null : state.towers[state.selected];
    const shown = Boolean(selected) && state.selected !== null && !this.popover.isDismissed(state.selected);
    attr(this.range, 'visibility', shown ? 'visible' : 'hidden');
    if (selected && state.selected !== null) {
      const position = towerPosition(state, state.selected);
      attr(this.range, 'cx', position.x);
      attr(this.range, 'cy', position.y);
      attr(this.range, 'r', state.defense ? defenseRange(state, selected) : towerRange(selected));
      attr(this.range, 'stroke', dragons[selected.type].color);
    }
  }

  /** The state of the render in progress; layers only update during render. */
  private current(): GameState {
    if (!this.state) throw new Error('Renderer used before its first render.');
    return this.state;
  }
}
