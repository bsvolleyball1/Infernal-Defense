import { dragons, map, positionAt } from '../content/catalog';
import type { GameState } from '../game/types';
import { towerRange, towerUpgradeCost } from '../game/rules';
import { element, elements, setText } from './dom';

export interface Renderer { render(state: GameState, showResults: boolean): void }
const NS = 'http://www.w3.org/2000/svg';
function node(tag: string): SVGElement { return document.createElementNS(NS, tag); }
function attr(n: Element, name: string, value: string | number): void {
  const text = String(value);
  if (n.getAttribute(name) !== text) n.setAttribute(name, text);
}

export class SvgRenderer implements Renderer {
  private enemyNodes = new Map<number, SVGElement>();
  private eggNodes = new Map<number, SVGElement>();
  private shotNodes = new Map<number, SVGElement>();
  private range = node('circle');

  constructor() {
    attr(this.range, 'fill', 'none');
    attr(this.range, 'stroke-dasharray', '4 5');
    attr(this.range, 'opacity', '.4');
    element('#effects').append(this.range);
  }

  render(state: GameState, showResults: boolean): void {
    this.renderHud(state);
    this.renderPerches(state);
    this.renderEnemies(state);
    this.renderProjectiles(state);
    this.renderEggs(state);
    this.renderSelectionRange(state);
    this.renderResults(state, showResults);
  }

  private renderHud(state: GameState): void {
    const lives = state.eggs.filter(egg => egg.status !== 'escaped').length;
    const battle = state.phase === 'battle';
    const ended = state.phase === 'won' || state.phase === 'lost';
    setText('#gold', Math.floor(state.gold));
    setText('#waveNum', `${state.wave} / 5`);
    setText('#lives', lives);
    setText('#hpText', `${lives} / 5`);
    element<HTMLElement>('#hpBar').style.width = `${lives / 5 * 100}%`;
    setText('#nestCount', `${state.eggs.filter(egg => egg.status === 'nest').length} in nest`);
    const start = element<HTMLButtonElement>('#start');
    start.disabled = battle || ended;
    setText('#start', state.phase === 'lost' ? 'Nest fallen' : state.phase === 'won' ? 'Valley defended' : battle ? 'Wave in progress' : `Begin wave ${state.wave + 1}`);
    setText('#waveState', battle ? state.paused ? 'PAUSED' : 'UNDER ATTACK' : state.phase === 'won' ? 'CLEARED' : state.phase === 'lost' ? 'FALLEN' : 'READY');
    setText('#waveTitle', battle ? 'Raiders on the pass' : state.phase === 'won' ? 'The eggs are safe' : state.phase === 'lost' ? 'The nest has fallen' : 'The raiders are gathering');
    setText('#waveDesc', battle ? 'Dragons attack automatically when raiders enter range.' : state.phase === 'won' ? 'All five waves repelled. The valley is yours.' : state.phase === 'lost' ? 'Return to the menu to begin another journey.' : state.activeLevel === 'tutorial' ? 'Training exercise: place dragons, then begin the wave.' : 'Place your dragons, then begin the wave.');
    setText('#levelHeading', state.activeLevel === 'tutorial' ? 'Tutorial · The Ashen Pass' : 'The Ashen Pass');
    setText('#speed', `▶ ${state.speed}×`);
    setText('#pause', state.paused ? 'Resume' : 'Pause');
    element<HTMLButtonElement>('#pause').disabled = !battle;
    element<HTMLElement>('#pauseOverlay').hidden = !(battle && state.paused);
    const selected = state.selected === null ? null : state.towers[state.selected];
    element<HTMLButtonElement>('#upgrade').disabled = !selected || state.gold < towerUpgradeCost(selected) || ended || state.paused;
    element<HTMLButtonElement>('#sell').disabled = !selected || ended || state.paused;
    let info = 'Choose a dragon, then tap an empty perch to place it.';
    if (selected) info = `${dragons[selected.type].name} · Level ${selected.level} · Range ${towerRange(selected)}`;
    else if (state.chosen) info = `${dragons[state.chosen].name} · ${dragons[state.chosen].cost} gold · Choose a perch.`;
    setText('#info', info);
    elements<HTMLButtonElement>('.tower').forEach(button => {
      const chosen = button.dataset.type === state.chosen;
      button.classList.toggle('selected', chosen);
      attr(button, 'aria-pressed', String(chosen));
      button.disabled = ended || state.paused;
    });
  }

  private renderPerches(state: GameState): void {
    const ended = state.phase === 'won' || state.phase === 'lost';
    elements<SVGGElement>('.perch').forEach((perch, i) => {
      const tower = state.towers[i];
      attr(perch.querySelector('circle')!, 'fill', tower ? dragons[tower.type].color : '#899d72');
      const text = perch.querySelector('text')!;
      const label = tower ? dragons[tower.type].icon : '✦';
      if (text.textContent !== label) text.textContent = label;
      attr(text, 'font-size', tower ? 18 : 17);
      attr(perch, 'aria-label', tower ? `${dragons[tower.type].name}, level ${tower.level}, perch ${i + 1}` : `Empty perch ${i + 1}`);
      attr(perch, 'aria-disabled', String(ended || state.paused));
      attr(perch, 'tabindex', ended || state.paused ? -1 : 0);
      perch.style.filter = i === state.selected ? 'drop-shadow(0 0 7px #ffdd82)' : '';
    });
  }

  private renderEnemies(state: GameState): void {
    for (const enemy of state.enemies) {
      let group = this.enemyNodes.get(enemy.id);
      if (!group) {
        group = node('g');
        const color = enemy.kind === 'chief' ? '#513a31' : enemy.kind === 'shield' ? '#666d6c' : enemy.kind === 'runner' ? '#8c4637' : '#79483a';
        group.innerHTML = `<ellipse cy="9" rx="12" ry="4" fill="#263324" opacity=".35"/><circle cy="-2" r="10" fill="${color}" stroke="#e0c8a0" stroke-width="1.5"/><circle cx="-3" cy="-4" r="1.2" fill="#f4d98e"/><path d="M-6 -9l-3 -5 7 3M5 -9l4 -5-7 3" fill="${enemy.kind === 'chief' ? '#d0b15f' : '#cbb593'}"/><path d="M-7 5v8M7 5v8M-3 7v7M3 7v7" stroke="#42342c" stroke-width="3"/>${enemy.kind === 'shield' ? '<path d="M-13-7l-4 8 5 9 6-5V-5z" fill="#aeb5a5" stroke="#47524a"/>' : ''}<rect x="-11" y="-19" width="22" height="3" rx="1.5" fill="#433e35"/><rect class="health" x="-11" y="-19" height="3" rx="1.5" fill="#cd6651"/><circle class="frozen" cy="-2" r="13" fill="none" stroke="#8de4ea" stroke-width="2"/>`;
        this.enemyNodes.set(enemy.id, group);
        element('#enemies').append(group);
      }
      const [x, y] = positionAt(enemy.progress);
      attr(group, 'transform', `translate(${x} ${y})`);
      attr(group.querySelector('.health')!, 'width', 22 * Math.max(0, enemy.hp / enemy.max));
      attr(group.querySelector('.frozen')!, 'visibility', enemy.slow > 0 ? 'visible' : 'hidden');
    }
    this.prune(this.enemyNodes, state.enemies.map(enemy => enemy.id));
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
      attr(circle, 'cx', shot.x); attr(circle, 'cy', shot.y);
    }
    this.prune(this.shotNodes, state.projectiles.map(shot => shot.id));
  }

  private renderEggs(state: GameState): void {
    const visibleEggs = state.eggs.filter(egg => egg.status !== 'escaped');
    for (const egg of visibleEggs) {
      let group = this.eggNodes.get(egg.id);
      if (!group) {
        group = node('g');
        group.innerHTML = '<ellipse cy="5" rx="5" ry="2" fill="#263324" opacity=".3"/><ellipse rx="4" ry="6" fill="#f1e3b0" stroke="#8c7448"/><ellipse cx="-1" cy="-2" rx="1" ry="2" fill="#fff9de"/>';
        this.eggNodes.set(egg.id, group); element('#eggObjects').append(group);
      }
      let x = 647 + (egg.id - 1) * 8, y = 165;
      if (egg.status === 'dropped') { [x, y] = positionAt(egg.progress ?? 0); y -= 7; }
      if (egg.status === 'carried') {
        const carrier = state.enemies.find(enemy => enemy.id === egg.carrier);
        if (carrier) { [x, y] = positionAt(carrier.progress); y -= 18; }
      }
      attr(group, 'transform', `translate(${x} ${y})`);
    }
    this.prune(this.eggNodes, visibleEggs.map(egg => egg.id));
  }

  private renderSelectionRange(state: GameState): void {
    const selected = state.selected === null ? null : state.towers[state.selected];
    attr(this.range, 'visibility', selected ? 'visible' : 'hidden');
    if (selected && state.selected !== null) {
      const perch = map.perches[state.selected];
      attr(this.range, 'cx', perch.x); attr(this.range, 'cy', perch.y);
      attr(this.range, 'r', towerRange(selected));
      attr(this.range, 'stroke', dragons[selected.type].color);
    }
  }

  private renderResults(state: GameState, showResults: boolean): void {
    const ended = state.phase === 'won' || state.phase === 'lost';
    const lives = state.eggs.filter(egg => egg.status !== 'escaped').length;
    element('#gameOver').classList.toggle('show', ended && showResults);
    if (ended) {
      setText('#resultKicker', state.phase === 'won' ? 'All waves cleared' : 'The nest was breached');
      setText('#resultTitle', state.phase === 'won' ? 'Valley defended' : 'The nest has fallen');
      setText('#resultEnemies', `${state.enemiesKilled} / ${state.enemiesSummoned}`);
      setText('#resultEggs', `${lives} / 5`);
      setText('#resultGold', `${state.rewardGold} gold`);
    }
    setText('#bankedGold', `${state.bankedGold} gold`);
  }

  private prune(nodes: Map<number, SVGElement>, ids: number[]): void {
    const active = new Set(ids);
    for (const [id, group] of nodes) if (!active.has(id)) { group.remove(); nodes.delete(id); }
  }
}
