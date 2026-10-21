import { getMap } from '../content/catalog';
import { battlefields, challengeLabel } from '../content/maps';
export { renderBestiary } from './bestiary';
import type { Settings, SlotResult } from '../services/storage';
import type { GameState } from '../game/types';
import type { JourneyProgress } from '../game/journey';
import { importJourney, isLevelUnlocked, levelPrerequisite } from '../game/journey';
import { element, elements, setText } from './dom';
import { formatGold } from './currency-format';

const menuPages = ['home', 'bestiary', 'options', 'saves', 'levels', 'upgrades'] as const;
export type MenuPage = (typeof menuPages)[number];

export function isMenuPage(value: unknown): value is MenuPage {
  return typeof value === 'string' && menuPages.some((page) => page === value);
}

export function showMenu(page: MenuPage): void {
  const options = element<HTMLDialogElement>('#optionsDialog');
  if (page === 'options') {
    if (!options.open) options.showModal();
    return;
  }
  if (options.open) options.close();
  element<HTMLElement>('#upgradeChoices').hidden = true;
  element('#menuScreen').style.display = 'flex';
  element('#gameScreen').removeAttribute('data-pause-open');
  element('#gameScreen').style.display = 'none';
  elements('.menu-page').forEach((section) => section.classList.toggle('active', section.dataset.page === page));
  element('#gameOver').classList.remove('show');
}

export function showBattle(): void {
  element('#menuScreen').style.display = 'none';
  element('#gameScreen').style.display = 'block';
}

export function renderLevelSelect(): void {
  element('#levelList').innerHTML = Object.entries(battlefields)
    .map(
      ([id, map]) => `
    <button class="level-card" data-level="${id}">
      <div class="level-tag">${id === 'tutorial' ? 'Training grounds' : (challengeLabel(map) ?? (map.forks.length ? 'Branching routes' : 'Grid dragon placement'))}</div>
      <strong>${id === 'tutorial' ? 'Tutorial' : map.name}</strong>
      <small>${map.description}</small>
      <span class="level-number">${map.forks.length ? '⑂' : '✦'}</span>
    </button>`,
    )
    .join('');
}

export function renderJourney(_slot: number, state: GameState, journey: JourneyProgress): void {
  setText('#journeyGold', `${formatGold(state.bankedGold)} gold`);
  setText('#journeyCleared', `${journey.completedLevels.length} / ${Object.keys(battlefields).length} levels cleared`);
  setText(
    '#journeyLevelNotice',
    journey.activeBattle
      ? `${getMap(state.activeLevel, state.defense?.ruleset, state.defense?.mobileLayout).name} is in progress. Continue it, or end this attempt before choosing another level.`
      : '',
  );
  const resume = element<HTMLButtonElement>('#journeyResume');
  const terminal = state.phase === 'won' || state.phase === 'lost';
  resume.hidden = !journey.activeBattle && !terminal;
  resume.textContent = journey.activeBattle
    ? `Continue ${getMap(state.activeLevel, state.defense?.ruleset, state.defense?.mobileLayout).name}`
    : 'View last result';
  element('#abandonBattle').hidden = !journey.activeBattle;
  const upgrades = document.querySelector<HTMLButtonElement>('#openPermanent');
  if (upgrades) upgrades.disabled = journey.activeBattle;
  elements<HTMLButtonElement>('[data-level]').forEach((button) => {
    const level = button.dataset.level as GameState['activeLevel'],
      prerequisite = levelPrerequisite(level),
      locked = !isLevelUnlocked(level, journey);
    button.disabled = journey.activeBattle || locked;
    const cleared = journey.completedLevels.includes(button.dataset.level as GameState['activeLevel']);
    button.classList.toggle('level-cleared', cleared);
    button.querySelector('.level-number')!.textContent = cleared
      ? '✓'
      : button.dataset.level === 'volcanic'
        ? '⑂'
        : '✦';
    button.setAttribute(
      'aria-label',
      `${button.querySelector('strong')!.textContent}${cleared ? ', cleared' : ''}${locked ? `, locked until ${getMap(prerequisite!).name} is cleared` : ''}${journey.activeBattle ? ', finish your current attempt first' : ''}`,
    );
  });
}

export function renderContinue(readSlot: (index: number) => SlotResult): number | null {
  let latest: { slot: number; time: number } | null = null;
  for (let index = 0; index < 3; index++) {
    const read = readSlot(index);
    if (read.status === 'valid' && (!latest || read.data.savedAt > latest.time))
      latest = { slot: index, time: read.data.savedAt };
  }
  const button = element<HTMLButtonElement>('#continueJourney');
  button.hidden = latest === null;
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
  title.textContent =
    read.status === 'valid' ? 'Journey in progress' : read.status === 'error' ? 'Save needs attention' : 'Empty slot';
  const meta = document.createElement('small');
  if (read.status === 'valid') {
    const state = read.data.state;
    const journey = read.data.journey ?? importJourney(state);
    const current = journey.activeBattle
      ? `${getMap(state.activeLevel, state.defense?.ruleset, state.defense?.mobileLayout).name} · Wave ${state.wave}/5`
      : 'Choose a level';
    meta.textContent = `${journey.completedLevels.length} levels cleared · ${formatGold(state.bankedGold)} gold banked · ${current} · Last played ${new Date(read.data.savedAt).toLocaleDateString()}`;
  } else {
    meta.textContent =
      read.status === 'error'
        ? read.message + ' Your stored save has been preserved.'
        : 'No journey saved in this slot yet.';
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

export function renderOptions(settings: Settings): void {
  element<HTMLInputElement>('#musicVolume').value = String(settings.music);
  element<HTMLInputElement>('#soundVolume').value = String(settings.sound);
  setText('#musicValue', `${settings.music}%`);
  setText('#soundValue', `${settings.sound}%`);
}

export function renderSoundToggle(settings: Settings): void {
  const label = settings.quiet ? 'Turn sound on' : 'Turn sound off';
  const button = element<HTMLButtonElement>('#sound');
  setText('#sound', '♫');
  button.setAttribute('aria-label', label);
  button.title = label;
}
