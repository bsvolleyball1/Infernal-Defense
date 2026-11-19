import { dragonForms } from '../content/dragon-forms';
import { entityPosition, towerPosition } from '../game/geometry';
import { mapBeamEndpoint } from '../game/evolution-combat';
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
        const p = towerPosition(state, i);
        if (t.evolution?.form === 'white' && t.beamIds.length) {
          const target = state.enemies.find((enemy) => enemy.id === t.beamIds![0]);
          if (target) {
            if (state.defense) {
              const endpoint = mapBeamEndpoint(state, { x: p.x, y: p.y - 18 }, target);
              const line = use(`map-beam-${i}`, 'line');
              for (const [key, value] of Object.entries({
                x1: p.x,
                y1: p.y - 18,
                x2: endpoint.x,
                y2: endpoint.y,
                stroke: dragonForms.white.color,
                'stroke-width': 3,
              }))
                line.setAttribute(key, String(value));
            }
          }
        }
        for (const id of t.beamIds) {
          if (t.evolution?.form === 'white') continue;
          const enemy = state.enemies.find((e) => e.id === id);
          if (!enemy) continue;
          const [x, y] = entityPosition(state, enemy),
            line = use(`beam-${i}-${id}`, 'line');
          for (const [key, value] of Object.entries({
            x1: p.x,
            y1: p.y - 18,
            x2: x,
            y2: y,
            stroke: t.evolution ? dragonForms[t.evolution.form].color : '#ee7959',
            'stroke-width': 3,
          }))
            line.setAttribute(key, String(value));
        }
      });
      for (const effect of state.defense.visuals) {
        if (effect.shape === 'cone') {
          const ux = effect.directionX ?? 1;
          const uy = effect.directionY ?? 0;
          const px = -uy;
          const py = ux;
          const coneLength = effect.length ?? effect.radius;
          const ex = effect.x + ux * coneLength;
          const ey = effect.y + uy * coneLength;
          const points = [
            `${effect.x},${effect.y}`,
            `${ex + px * effect.radius},${ey + py * effect.radius}`,
            `${ex},${ey}`,
            `${ex - px * effect.radius},${ey - py * effect.radius}`,
          ].join(' ');
          const polygon = use(`cone-${effect.id}`, 'polygon');
          for (const [key, value] of Object.entries({
            points,
            fill: effect.color ?? '#a26ce0',
            opacity: 0.16,
            stroke: effect.color ?? '#a26ce0',
            'stroke-width': 2,
          }))
            polygon.setAttribute(key, String(value));
          continue;
        }
        const circle = use(`spell-${effect.id}`, 'circle');
        for (const [key, value] of Object.entries({
          cx: effect.x,
          cy: effect.y,
          r: effect.radius,
          fill: effect.color ?? (effect.kind === 'poison' ? '#94c968' : '#ee7959'),
          opacity: 0.15,
          stroke: effect.color ?? (effect.kind === 'poison' ? '#94c968' : '#ee7959'),
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
