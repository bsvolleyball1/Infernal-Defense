import { getMap } from '../content/catalog';
import { entityPosition } from '../game/geometry';
import type { GameState } from '../game/types';
import { element } from './dom';

/** Retained effect nodes: no frame-by-frame SVG reconstruction. */
export class DefenseEffects {
  private nodes = new Map<string, SVGElement>();
  render(state: GameState): void {
    const active = new Set<string>(),
      root = element('#effects');
    const use = (id: string, tag: string): SVGElement => {
      active.add(id);
      let node = this.nodes.get(id);
      if (!node || !node.isConnected) {
        node = document.createElementNS('http://www.w3.org/2000/svg', tag);
        node.setAttribute('pointer-events', 'none');
        this.nodes.set(id, node);
        root.append(node);
      }
      return node;
    };
    if (state.defense) {
      state.towers.forEach((t, i) => {
        if (!t?.beamIds || state.phase !== 'battle') return;
        const p = getMap(state.activeLevel).perches[i];
        for (const id of t.beamIds) {
          const enemy = state.enemies.find((e) => e.id === id);
          if (!enemy) continue;
          const [x, y] = entityPosition(state, enemy),
            line = use(`beam-${i}-${id}`, 'line');
          for (const [key, value] of Object.entries({
            x1: p.x,
            y1: p.y - 18,
            x2: x,
            y2: y,
            stroke: '#ee7959',
            'stroke-width': 3,
          }))
            line.setAttribute(key, String(value));
        }
      });
      for (const effect of state.defense.visuals) {
        const circle = use(`spell-${effect.id}`, 'circle');
        for (const [key, value] of Object.entries({
          cx: effect.x,
          cy: effect.y,
          r: effect.radius,
          fill: effect.kind === 'poison' ? '#94c968' : '#ee7959',
          opacity: 0.15,
          stroke: effect.kind === 'poison' ? '#94c968' : '#ee7959',
        }))
          circle.setAttribute(key, String(value));
      }
      const preview = state.defense.preview;
      if (state.defense.targeting && preview) {
        const circle = use('target-preview', 'circle');
        for (const [key, value] of Object.entries({
          cx: preview.x,
          cy: preview.y,
          r: state.defense.targeting === 'fire' ? 100 : 200,
          fill: 'none',
          stroke: '#f1d68a',
          'stroke-dasharray': '6 4',
        }))
          circle.setAttribute(key, String(value));
      }
    }
    for (const [id, node] of this.nodes)
      if (!active.has(id)) {
        node.remove();
        this.nodes.delete(id);
      }
  }
}
