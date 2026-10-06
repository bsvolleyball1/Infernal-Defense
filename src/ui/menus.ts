import { getMap, monsters } from '../content/catalog';
import { battlefields } from '../content/maps';
import { enemyRoster, isDefenseMonster } from '../content/enemies';
import type { Settings, SlotResult } from '../services/storage';
import type { GameState } from '../game/types';
import type { JourneyProgress } from '../game/journey';
import { importJourney } from '../game/journey';
import { element, elements, setText } from './dom';

const menuPages = ['home', 'bestiary', 'options', 'saves', 'levels', 'upgrades'] as const;
export type MenuPage = typeof menuPages[number];

export function isMenuPage(value: unknown): value is MenuPage {
  return typeof value === 'string' && menuPages.some(page => page === value);
}

export function showMenu(page: MenuPage): void {
  element('#menuScreen').style.display = 'block';
  element('#gameScreen').style.display = 'none';
  elements('.menu-page').forEach(section => section.classList.toggle('active', section.dataset.page === page));
  element('#gameOver').classList.remove('show');
}

export function showBattle(): void {
  element('#menuScreen').style.display = 'none';
  element('#gameScreen').style.display = 'block';
}

export function renderLevelSelect(): void {
  element('#levelList').innerHTML = Object.entries(battlefields).map(([id, map]) => `
    <button class="level-card" data-level="${id}">
      <div class="level-tag">${id === 'tutorial' ? 'Training grounds' : `${map.perches.length} dragon roosts`}</div>
      <strong>${id === 'tutorial' ? 'Tutorial' : map.name}</strong>
      <small>${map.description}</small>
      <span class="level-number">${map.forks.length ? '⑂' : map.perches.length}</span>
    </button>`).join('');
}

export function renderJourney(slot: number, state: GameState, journey: JourneyProgress): void {
  setText('#journeyHeading', `Save slot ${slot + 1} · Your journey`);
  setText('#journeyGold', `${state.bankedGold} gold banked`);
  setText('#journeyCleared', `${journey.completedLevels.length} / ${Object.keys(battlefields).length} levels cleared`);
  setText('#journeyLevelNotice', journey.activeBattle
    ? `${getMap(state.activeLevel).name} is in progress. Continue it, or end this attempt before choosing another level.`
    : 'Choose your next level. Your banked gold and cleared levels stay with this player save.');
  const resume = element<HTMLButtonElement>('#journeyResume');
  const terminal = state.phase === 'won' || state.phase === 'lost';
  resume.hidden = !journey.activeBattle && !terminal;
  resume.textContent = journey.activeBattle ? `Continue ${getMap(state.activeLevel).name}` : 'View last result';
  element('#abandonBattle').hidden = !journey.activeBattle;
  const upgrades=document.querySelector<HTMLButtonElement>('#openPermanent');
  if(upgrades) upgrades.disabled=journey.activeBattle;
  elements<HTMLButtonElement>('[data-level]').forEach(button => {
    button.disabled = journey.activeBattle;
    const cleared = journey.completedLevels.includes(button.dataset.level as GameState['activeLevel']);
    button.classList.toggle('level-cleared', cleared);
    button.querySelector('.level-number')!.textContent = cleared ? '✓' : button.dataset.level === 'volcanic' ? '⑂' : String(getMap(button.dataset.level as GameState['activeLevel']).perches.length);
    button.setAttribute('aria-label', `${button.querySelector('strong')!.textContent}${cleared ? ', cleared' : ''}${journey.activeBattle ? ', finish your current attempt first' : ''}`);
  });
}

export function renderContinue(readSlot: (index: number) => SlotResult): number | null {
  let latest: { slot: number; time: number } | null = null;
  for (let index = 0; index < 3; index++) {
    const read = readSlot(index);
    if (read.status === 'valid' && (!latest || read.data.savedAt > latest.time)) latest = { slot: index, time: read.data.savedAt };
  }
  const button = element<HTMLButtonElement>('#continueJourney');
  button.hidden = latest === null;
  if (latest) setText('#continueJourneyDetail', `Load player save ${latest.slot + 1} and keep your progress`);
  return latest?.slot ?? null;
}

export function renderSaveSlots(readSlot: (index: number) => SlotResult): void {
  const host = element('#saveList');
  host.replaceChildren();
  for (let index = 0; index < 3; index++) host.append(createSaveCard(index, readSlot(index)));
}

function createSaveCard(index: number, read: SlotResult): HTMLElement {
  const card = document.createElement('article');
  card.className = 'save-card';
  const label = document.createElement('span');
  label.className = 'slot';
  label.textContent = `Save slot ${index + 1}`;
  const title = document.createElement('strong');
  title.textContent = read.status === 'valid' ? 'Journey in progress'
    : read.status === 'error' ? 'Save needs attention' : 'Empty slot';
  const meta = document.createElement('small');
  if (read.status === 'valid') {
    const state = read.data.state;
    const journey = read.data.journey ?? importJourney(state);
    const current = journey.activeBattle ? `${getMap(state.activeLevel).name} · Wave ${state.wave}/5` : 'Choose a level';
    meta.textContent = `${journey.completedLevels.length} levels cleared · ${state.bankedGold} gold banked · ${current} · Last played ${new Date(read.data.savedAt).toLocaleDateString()}`;
  } else {
    meta.textContent = read.status === 'error'
      ? read.message + ' Your stored save has been preserved.' : 'No journey saved in this slot yet.';
  }
  card.append(label, title, meta);
  if (read.status === 'error') {
    card.classList.add('error-card');
    return card;
  }
  const buttons = document.createElement('div');
  buttons.className = 'save-buttons';
  if (read.status === 'valid') {
    const load = document.createElement('button');
    load.dataset.load = String(index);
    load.textContent = 'Continue';
    buttons.append(load);
  }
  const fresh = document.createElement('button');
  fresh.className = 'alt';
  fresh.dataset.new = String(index);
  fresh.textContent = read.status === 'valid' ? 'New journey' : 'Start journey';
  buttons.append(fresh);
  card.append(buttons);
  return card;
}

export function renderBestiary(bestiary: string[]): void {
  const host = element('#bestiaryContent');
  host.replaceChildren();
  if (!bestiary.length) {
    host.innerHTML = '<div class="empty-state"><div class="empty-icon">⌕</div><h3>No creatures recorded yet</h3><p>Your field notes are blank. Encounter and defeat new creatures during a level to uncover them here.</p></div>';
    return;
  }
  const list = document.createElement('div');
  list.className = 'level-list';
  for (const kind of bestiary) {
    const entry = monsters[kind as keyof typeof monsters];
    if (!entry) continue;
    const card = document.createElement('article');
    card.className = 'level-card';
    const title = document.createElement('strong');
    const description = document.createElement('small');
    title.textContent = entry.name;
    description.textContent = isDefenseMonster(kind)
      ? `Speed rating ${enemyRoster[kind].rating} · ${enemyRoster[kind].hp} HP · ${entry.description}`
      : entry.description;
    card.append(title, description);
    list.append(card);
  }
  host.append(list);
}

export function renderOptions(settings: Settings): void {
  element<HTMLInputElement>('#musicVolume').value = String(settings.music);
  element<HTMLInputElement>('#soundVolume').value = String(settings.sound);
  setText('#musicValue', `${settings.music}%`);
  setText('#soundValue', `${settings.sound}%`);
}
