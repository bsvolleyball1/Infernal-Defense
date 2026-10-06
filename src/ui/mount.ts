import template from './template.html?raw';
import { element } from './dom';

export function mountApplication(): void {
  element('#app').innerHTML = template;
  const pauseOverlay = document.createElement('div');
  pauseOverlay.id = 'pauseOverlay';
  pauseOverlay.className = 'pause-overlay';
  pauseOverlay.hidden = true;
  pauseOverlay.innerHTML = '<section class="pause-card" role="dialog" aria-labelledby="pauseTitle"><h2 id="pauseTitle">Battle paused</h2><p>Your dragons are waiting.</p><button class="btn" id="resumeBattle">Resume battle</button><button class="btn secondary" id="pauseMenu">Save and return to menu</button></section>';
  const battlefield = document.createElement('div');
  battlefield.className = 'battlefield';
  const mapElement = element('#map');
  mapElement.before(battlefield);
  battlefield.append(mapElement, pauseOverlay);
}
