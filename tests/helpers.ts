import { colorForDragon, nextForms } from '../src/content/dragon-forms';
import { GameEngine } from '../src/game/engine';

export function upgradeSelected(engine: GameEngine) {
  const tower = engine.state.selected === null ? null : engine.state.towers[engine.state.selected];
  if (!tower) return engine.dispatch({ type: 'upgrade' });
  const color = colorForDragon[tower.type];
  const form = nextForms(tower, color)[0];
  return form ? engine.dispatch({ type: 'upgrade', color, form }) : engine.dispatch({ type: 'upgrade' });
}
