import template from './template.html?raw';
import { element } from './dom';
import { battlefieldArtwork } from './battlefield';
import { renderLevelSelect } from './menus';
import { renderTestRoster } from './defense-controls';

/** The template holds the static structure; only content-driven parts are generated here. */
export function mountApplication(): void {
  element('#app').innerHTML = template;
  renderLevelSelect();
  renderTestRoster();
  element('#map').innerHTML = battlefieldArtwork();
}
