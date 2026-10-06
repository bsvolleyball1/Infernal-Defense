import { monsters } from '../content/catalog';
import type { Settings, SlotResult } from '../services/storage';
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
    meta.textContent = `${state.activeLevel === 'tutorial' ? 'Tutorial' : 'The Ashen Pass'} · Wave ${state.wave}/5 · ${Math.floor(state.gold)} gold · Last played ${new Date(read.data.savedAt).toLocaleDateString()}`;
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
    description.textContent = entry.description;
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
