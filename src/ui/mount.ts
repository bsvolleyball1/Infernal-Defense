import template from './template.html?raw';
import { element } from './dom';
import { battlefieldArtwork } from './battlefield';
import { renderLevelSelect } from './menus';

export function mountApplication(): void {
  element('#app').innerHTML = template;
  renderLevelSelect();
  element('#map').innerHTML = battlefieldArtwork();
  element('#map').setAttribute('aria-label', 'A gridded battlefield. Place one dragon in each open cell; route cells are blocked.');
  element('.side h3').textContent = 'Dragon roster';
  element('.legend span:last-child').textContent = 'Choose a dragon, then tap an open grid cell';
  element<HTMLElement>('.legend span:nth-child(3) .dot').style.backgroundColor = '#e2bf48';
  const pauseOverlay = document.createElement('div');
  pauseOverlay.id = 'pauseOverlay';
  pauseOverlay.className = 'pause-overlay';
  pauseOverlay.hidden = true;
  pauseOverlay.innerHTML = '<section class="pause-card" role="dialog" aria-labelledby="pauseTitle"><h2 id="pauseTitle">Battle paused</h2><p>Your dragons are waiting.</p><button class="btn" id="resumeBattle">Resume battle</button><button class="btn secondary" id="pauseMenu">Save and return to menu</button></section>';
  const battlefield = document.createElement('div');
  battlefield.className = 'battlefield';
  const toolbar = document.createElement('div');
  toolbar.className = 'battle-toolbar';
  toolbar.innerHTML =
    '<div class="battle-shortcuts"><div id="battleSpells" role="group" aria-label="Battle spells"></div><div id="battleMiddle"><div id="battleStatus"></div><div id="battleControls"></div></div><div id="battleDragons" role="group" aria-label="Choose a dragon"></div></div>';
  const saveButton = element<HTMLButtonElement>('#saveProgress');
  saveButton.setAttribute('aria-label', 'Save progress');
  saveButton.title = 'Save progress';
  const menuButton = element<HTMLButtonElement>('#returnMenu');
  menuButton.setAttribute('aria-label', 'Return to menu');
  menuButton.title = 'Return to menu';
  const mapElement = element('#map');
  mapElement.before(battlefield);
  battlefield.append(mapElement, pauseOverlay);
  battlefield.after(toolbar);
  element('#battleStatus').append(element('.stats'), element('.nest'));
  element('#battleControls').append(element('.controls'));
  element('#battleDragons').append(element('.towerlist'));
}
