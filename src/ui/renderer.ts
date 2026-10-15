import { dragons, getMap } from '../content/catalog';
import type { GameState, Level, Point } from '../game/types';
import { canPlaceTower, entityPosition } from '../game/geometry';
import { battlefieldArtwork } from './battlefield';
import { towerRange } from '../game/rules';
import { element } from './dom';
import { enemyRoster, isDefenseMonster } from '../content/enemies';
import { defenseRange } from '../game/defense-combat';
import { defenseRules } from '../content/defense-rules';
import { DefenseEffects } from './defense-effects';
import { HudView } from './hud-view';
import { ResultsView } from './results-view';
import { presentBattle } from './battle-view-model';
import { towerPosition } from '../game/geometry';
import { dragonPortrait } from './dragon-art';
import { monsterPortrait } from './monster-art';
import { towerBonus } from '../game/tower-bonuses';

export interface Renderer {
  render(state: GameState, showResults: boolean): void;
  renderPlacement(point: Point | null, state: GameState): void;
}
const NS = 'http://www.w3.org/2000/svg';
function node(tag: string): SVGElement {
  return document.createElementNS(NS, tag);
}
function attr(n: Element, name: string, value: string | number): void {
  const text = String(value);
  if (n.getAttribute(name) !== text) n.setAttribute(name, text);
}

export class SvgRenderer implements Renderer {
  private enemyNodes = new Map<number, SVGElement>();
  private eggNodes = new Map<number, SVGElement>();
  private shotNodes = new Map<number, SVGElement>();
  private towerNodes = new Map<number, SVGGElement>();
  private placementPoint: Point | null = null;
  private placementNode: SVGGElement | null = null;
  private range = node('circle');
  private activeLevel: Level | null = null;
  private selectedPerch: number | null = null;
  private dismissedPerch: number | null = null;
  private defenseEffects = new DefenseEffects();
  private hud = new HudView();
  private results = new ResultsView();

  constructor() {
    attr(this.range, 'fill', 'none');
    attr(this.range, 'stroke-dasharray', '4 5');
    attr(this.range, 'opacity', '.4');
    element('#effects').append(this.range);
    const actions = element<HTMLElement>('.actions');
    actions.addEventListener('click', (event) => {
      if (!(event.target instanceof Element) || !event.target.closest('#upgrade, #sell')) return;
      this.dismissedPerch = this.selectedPerch;
      if (this.selectedPerch !== null) {
        element<SVGGElement>(`#map .tower-marker[data-id="${this.selectedPerch}"]`).focus();
      }
      this.positionTowerActions();
    });
    const map = element<SVGSVGElement>('#map');
    map.addEventListener(
      'click',
      (event) => {
        if (!(event.target instanceof Element) || !event.target.closest('.tower-marker')) {
          this.dismissSelectedTowerActions();
        } else {
          this.dismissedPerch = null;
        }
      },
      true,
    );
    map.addEventListener(
      'keydown',
      (event) => {
        if (
          ['Enter', ' '].includes(event.key) &&
          event.target instanceof Element &&
          event.target.closest('.tower-marker')
        ) {
          this.dismissedPerch = null;
        }
      },
      true,
    );
    window.addEventListener('resize', () => this.positionTowerActions());
    window.addEventListener('scroll', () => this.positionTowerActions(), true);
  }

  render(state: GameState, showResults: boolean): void {
    const view = presentBattle(state, showResults);
    this.ensureBattlefield(state);
    this.syncSelection(state);
    this.hud.render(view);
    this.renderTowers(state);
    this.renderPlacementPreview(state);
    this.renderSummonControl(state);
    this.renderEnemies(state);
    this.renderProjectiles(state);
    this.renderEggs(state);
    this.renderSelectionRange(state);
    this.results.render(view);
    this.defenseEffects.render(state);
    this.positionTowerActions();
  }

  renderPlacement(point: Point | null, state: GameState): void {
    this.placementPoint = point;
    this.renderPlacementPreview(state);
  }

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
    this.enemyNodes.clear();
    this.eggNodes.clear();
    this.shotNodes.clear();
    element('#effects').append(this.range);
    this.towerNodes.clear();
  }

  private syncSelection(state: GameState): void {
    const selected = state.selected === null ? null : state.towers[state.selected];
    const selectedPerch = selected ? state.selected : null;
    if (selectedPerch !== this.selectedPerch) this.dismissedPerch = null;
    this.selectedPerch = selectedPerch;
  }

  private positionTowerActions(): void {
    const actions = element<HTMLElement>('.actions');
    if (this.selectedPerch === null || this.selectedPerch === this.dismissedPerch) {
      actions.hidden = true;
      return;
    }

    const perch = element<SVGSVGElement>('#map').querySelector<SVGGElement>(
      `.tower-marker[data-id="${this.selectedPerch}"]`,
    );
    if (!perch) {
      actions.hidden = true;
      return;
    }

    actions.hidden = false;
    const tower = perch.getBoundingClientRect();
    const popup = actions.getBoundingClientRect();
    const margin = 8;
    const centerX = tower.left + tower.width / 2;
    const left = Math.max(popup.width / 2 + margin, Math.min(centerX, window.innerWidth - popup.width / 2 - margin));
    const gap = 8;
    const above = tower.top - gap;
    const top = above - popup.height >= margin;
    const position = top ? above : Math.min(tower.bottom + gap, window.innerHeight - popup.height - margin);
    actions.dataset.placement = top ? 'above' : 'below';
    actions.style.left = `${left}px`;
    actions.style.top = `${Math.max(margin, position)}px`;
  }

  private dismissSelectedTowerActions(): void {
    this.dismissedPerch = this.selectedPerch;
    this.positionTowerActions();
    this.range.setAttribute('visibility', 'hidden');
    if (this.selectedPerch !== null) {
      const perch = element<SVGSVGElement>('#map').querySelector<SVGGElement>(
        `.tower-marker[data-id="${this.selectedPerch}"]`,
      );
      if (perch) perch.style.filter = '';
    }
  }

  private renderTowers(state: GameState): void {
    const ended = state.phase === 'won' || state.phase === 'lost';
    const active = new Set<number>();
    state.towers.forEach((tower, i) => {
      if (!tower) return;
      active.add(i);
      let group = this.towerNodes.get(i);
      if (!group) {
        group = node('g') as SVGGElement;
        group.classList.add('tower-marker');
        group.setAttribute('role', 'button');
        group.dataset.id = String(i);
        group.innerHTML =
          '<circle class="tower-aura" r="19" fill="#18221d" stroke="#f0d58b" stroke-width="2"/><image class="tower-icon" x="-17" y="-17" width="34" height="34" preserveAspectRatio="xMidYMid meet"/><circle class="tower-hit" r="24" fill="transparent" pointer-events="all"/>';
        this.towerNodes.set(i, group);
        element('#towers').append(group);
      }
      const position = towerPosition(state, i);
      const bonus = towerBonus(state, i);
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
      const label = `${dragons[tower.type].name}, level ${tower.level}, dragon ${i + 1}${bonusLabel}`;
      attr(group, 'transform', `translate(${position.x} ${position.y})`);
      attr(group, 'aria-label', label);
      attr(group, 'aria-disabled', String(ended || state.paused));
      attr(group, 'tabindex', ended || state.paused ? -1 : 0);
      attr(group.querySelector('.tower-aura')!, 'fill', dragons[tower.type].color);
      attr(group.querySelector('.tower-icon')!, 'href', dragonPortrait(tower.type, tower.level));
      group.style.filter = i === state.selected && i !== this.dismissedPerch ? 'drop-shadow(0 0 7px #ffdd82)' : '';
    });
    for (const [index, group] of this.towerNodes) {
      if (active.has(index)) continue;
      group.remove();
      this.towerNodes.delete(index);
    }
  }

  private renderPlacementPreview(state: GameState): void {
    const layer = element<SVGGElement>('#placementPreview');
    if (!this.placementNode || !this.placementNode.isConnected) {
      this.placementNode = node('g') as SVGGElement;
      this.placementNode.classList.add('placement-preview');
      this.placementNode.setAttribute('aria-hidden', 'true');
      this.placementNode.setAttribute('pointer-events', 'none');
      this.placementNode.innerHTML =
        '<circle class="placement-ring" r="23" fill="none" stroke-width="2" stroke-dasharray="4 3"/><image class="placement-icon" x="-18" y="-18" width="36" height="36" preserveAspectRatio="xMidYMid meet"/>';
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
    attr(this.placementNode.querySelector('.placement-icon')!, 'href', dragonPortrait(state.chosen));
  }

  private renderSummonControl(state: GameState): void {
    const layer = element<SVGGElement>('#summonControl');
    let button = layer.querySelector<SVGGElement>('.summon-control');
    if (!button) {
      button = node('g') as SVGGElement;
      button.classList.add('summon-control');
      button.setAttribute('role', 'button');
      button.setAttribute('aria-label', 'Summon next wave');
      button.setAttribute('pointer-events', 'all');
      button.innerHTML =
        '<circle class="summon-hit" r="54" fill="transparent"/><circle r="31" fill="#18221d" fill-opacity=".86" stroke="#c78a6a" stroke-width="2"/><circle class="summon-track" r="25" fill="none" stroke="#f3ead3" stroke-opacity=".25" stroke-width="3"/><circle class="summon-progress" r="25" fill="none" stroke="#e0b45f" stroke-width="3" stroke-linecap="round" transform="rotate(-90)"/><text class="summon-icon" text-anchor="middle" y="8" font-size="23" aria-hidden="true">👹</text>';
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
    const circumference = 2 * Math.PI * 25;
    attr(button.querySelector('.summon-progress')!, 'stroke-dasharray', circumference);
    attr(button.querySelector('.summon-progress')!, 'stroke-dashoffset', circumference * (1 - remaining));
    attr(button.querySelector('.summon-progress')!, 'visibility', remaining > 0 ? 'visible' : 'hidden');
    const seconds = Math.ceil((defense.countdown ?? 0) / 1000);
    button.setAttribute(
      'aria-label',
      defense.countdown === null
        ? `Summon wave ${state.wave + 1}`
        : `Summon wave ${state.wave + 1}; ${seconds} seconds remain for the early summon mana bonus`,
    );
  }

  private renderEnemies(state: GameState): void {
    for (const enemy of state.enemies) {
      let group = this.enemyNodes.get(enemy.id);
      const appearance = `${enemy.kind}:${state.defense?.mode ?? 'legacy'}`;
      if (group && group.getAttribute('data-appearance') !== appearance) {
        group.remove();
        group = undefined;
      }
      if (!group) {
        group = node('g');
        attr(group, 'data-appearance', appearance);
        group.innerHTML = `<ellipse cy="9" rx="12" ry="4" fill="#263324" opacity=".35"/><image class="enemy-icon" x="-12" y="-14" width="24" height="24" preserveAspectRatio="xMidYMid meet"/>${enemy.kind === 'shield' ? '<path d="M-13-7l-4 8 5 9 6-5V-5z" fill="#aeb5a5" stroke="#47524a"/>' : ''}<rect x="-11" y="-19" width="22" height="3" rx="1.5" fill="#433e35"/><rect class="health" x="-11" y="-19" height="3" rx="1.5" fill="#cd6651"/><circle class="frozen" cy="-2" r="13" fill="none" stroke="#8de4ea" stroke-width="2"/>`;
        attr(group.querySelector('.enemy-icon')!, 'href', monsterPortrait(enemy.kind));
        this.enemyNodes.set(enemy.id, group);
        const title = node('title');
        title.textContent = isDefenseMonster(enemy.kind) ? enemyRoster[enemy.kind].name : enemy.kind;
        group.append(title);
        if (state.defense?.mode === 'sandbox') {
          const label = node('text');
          label.textContent = title.textContent;
          attr(label, 'y', -25);
          attr(label, 'text-anchor', 'middle');
          attr(label, 'font-size', 9);
          attr(label, 'fill', '#fff1cf');
          group.append(label);
        }
        element('#enemies').append(group);
      }
      const [x, y] = entityPosition(state, enemy);
      attr(group, 'transform', `translate(${x} ${y})`);
      attr(group.querySelector('.health')!, 'width', 22 * Math.max(0, enemy.hp / enemy.max));
      attr(
        group.querySelector('.frozen')!,
        'visibility',
        (state.defense ? (enemy.frozen ?? 0) > 0 : enemy.slow > 0) ? 'visible' : 'hidden',
      );
      attr(
        group,
        'opacity',
        (enemy.untargetable ?? 0) > 0 ? 0.3 : (enemy.invulnerable ?? 0) > 0 || (enemy.deathDelay ?? 0) > 0 ? 0.6 : 1,
      );
    }
    this.prune(
      this.enemyNodes,
      state.enemies.map((enemy) => enemy.id),
    );
  }

  private renderProjectiles(state: GameState): void {
    for (const shot of state.projectiles) {
      let circle = this.shotNodes.get(shot.id);
      if (!circle) {
        circle = node('circle');
        attr(circle, 'r', shot.dragon === 'fire' ? 4 : 3.5);
        attr(circle, 'fill', dragons[shot.dragon].color);
        attr(circle, 'stroke', '#f3e7c9');
        attr(circle, 'stroke-width', 1);
        this.shotNodes.set(shot.id, circle);
        element('#effects').append(circle);
      }
      attr(circle, 'cx', shot.x);
      attr(circle, 'cy', shot.y);
    }
    this.prune(
      this.shotNodes,
      state.projectiles.map((shot) => shot.id),
    );
  }

  private renderEggs(state: GameState): void {
    const visibleEggs = state.eggs.filter((egg) => egg.status !== 'escaped');
    for (const egg of visibleEggs) {
      let group = this.eggNodes.get(egg.id);
      if (!group) {
        group = node('g');
        group.innerHTML =
          '<ellipse cy="5" rx="5" ry="2" fill="#263324" opacity=".3"/><ellipse rx="4" ry="6" fill="#f1e3b0" stroke="#8c7448"/><ellipse cx="-1" cy="-2" rx="1" ry="2" fill="#fff9de"/>';
        this.eggNodes.set(egg.id, group);
        element('#eggObjects').append(group);
      }
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
    this.prune(
      this.eggNodes,
      visibleEggs.map((egg) => egg.id),
    );
  }

  private renderSelectionRange(state: GameState): void {
    const selected = state.selected === null ? null : state.towers[state.selected];
    attr(this.range, 'visibility', selected && state.selected !== this.dismissedPerch ? 'visible' : 'hidden');
    if (selected && state.selected !== null) {
      const position = towerPosition(state, state.selected);
      attr(this.range, 'cx', position.x);
      attr(this.range, 'cy', position.y);
      attr(this.range, 'r', state.defense ? defenseRange(state, selected) : towerRange(selected));
      attr(this.range, 'stroke', dragons[selected.type].color);
    }
  }

  private prune(nodes: Map<number, SVGElement>, ids: number[]): void {
    const active = new Set(ids);
    for (const [id, group] of nodes)
      if (!active.has(id)) {
        group.remove();
        nodes.delete(id);
      }
  }
}
