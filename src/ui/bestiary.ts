import { monsters } from '../content/monsters';
import { enemyRoster, isDefenseMonster } from '../content/enemies';
import { waves } from '../content/legacy-waves';
import type { MonsterKind } from '../game/types';
import { element } from './dom';
import { monsterPortrait } from './monster-art';

let carouselResize: ResizeObserver | undefined;

function portrait(kind: MonsterKind): HTMLImageElement {
  const image = document.createElement('img');
  image.src = monsterPortrait(kind);
  image.alt = '';
  image.draggable = false;
  return image;
}

function range(values: number[]): string {
  const low = Math.min(...values),
    high = Math.max(...values);
  return low === high ? String(low) : `${low}–${high} (varies by wave)`;
}

/** Native touch scrolling, plus click-and-drag scrolling for mouse and pen input. */
function enableCarouselDrag(track: HTMLElement): void {
  let gesture: { id: number; x: number; y: number; scroll: number; dragging: boolean } | null = null;
  let suppressClick = false;
  track.addEventListener('pointerdown', (event) => {
    suppressClick = false;
    if (event.pointerType === 'touch' || event.button !== 0 || !event.isPrimary) return;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, scroll: track.scrollLeft, dragging: false };
  });
  track.addEventListener('pointermove', (event) => {
    if (!gesture || event.pointerId !== gesture.id) return;
    const delta = event.clientX - gesture.x;
    if (!gesture.dragging) {
      if (Math.abs(delta) < 6 || Math.abs(delta) <= Math.abs(event.clientY - gesture.y)) return;
      gesture.dragging = true;
      suppressClick = true;
      track.classList.add('is-dragging');
      track.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    track.scrollLeft = gesture.scroll - delta;
  });
  const finish = (event: PointerEvent): void => {
    if (!gesture || event.pointerId !== gesture.id) return;
    gesture = null;
    track.classList.remove('is-dragging');
    if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
  };
  track.addEventListener('pointerup', finish);
  track.addEventListener('pointercancel', finish);
  track.addEventListener('lostpointercapture', finish);
  track.addEventListener(
    'click',
    (event) => {
      if (suppressClick && event.detail > 0) {
        event.preventDefault();
        event.stopImmediatePropagation();
        suppressClick = false;
      }
    },
    { capture: true },
  );
}

/** A discovered-creature carousel with one native, keyboard-accessible detail dialog. */
export function renderBestiary(bestiary: string[]): void {
  carouselResize?.disconnect();
  const host = element('#bestiaryContent');
  host.replaceChildren();
  const kinds = [...new Set(bestiary)].filter((kind): kind is MonsterKind => Object.hasOwn(monsters, kind));
  if (!kinds.length) {
    host.innerHTML =
      '<div class="empty-state"><div class="empty-icon">⌕</div><h3>No creatures recorded yet</h3><p>Your field notes are blank. Encounter and defeat new creatures during a level to uncover them here.</p></div>';
    return;
  }

  const carousel = document.createElement('section');
  carousel.className = 'bestiary-carousel';
  carousel.setAttribute('aria-label', 'Discovered creatures');
  carousel.setAttribute('aria-roledescription', 'carousel');
  const track = document.createElement('div');
  track.className = 'bestiary-track';
  track.id = 'bestiaryTrack';
  track.setAttribute('role', 'list');
  enableCarouselDrag(track);
  const dialog = document.createElement('dialog');
  dialog.className = 'creature-dialog';
  dialog.setAttribute('aria-labelledby', 'creatureName');
  dialog.innerHTML =
    '<button class="back-btn creature-close" autofocus aria-label="Close creature details">Close</button><div class="creature-portrait"></div><h2 id="creatureName"></h2><dl class="creature-stats"></dl><h3>Traits</h3><p class="creature-description"></p>';
  let opener: HTMLButtonElement | null = null;
  dialog.querySelector('button')!.addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', (event) => {
    // Let the native dialog close without also triggering the menu's Escape shortcut.
    if (event.key === 'Escape') event.stopPropagation();
    if (event.key === 'Tab') {
      event.preventDefault();
      dialog.querySelector('button')!.focus();
    }
  });
  dialog.addEventListener('close', () => opener?.focus({ preventScroll: true }));
  dialog.addEventListener('click', (event) => {
    const bounds = dialog.getBoundingClientRect();
    if (
      event.target === dialog &&
      (event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom)
    )
      dialog.close();
  });

  const cards = kinds.map((kind) => {
    const item = document.createElement('div');
    item.setAttribute('role', 'listitem');
    const card = document.createElement('button');
    card.className = 'creature-card';
    card.dataset.creature = kind;
    card.setAttribute('aria-haspopup', 'dialog');
    const name = document.createElement('strong');
    name.textContent = monsters[kind].name;
    card.append(portrait(kind), name);
    card.addEventListener('click', () => {
      opener = card;
      dialog.querySelector('.creature-portrait')!.replaceChildren(portrait(kind));
      dialog.querySelector('h2')!.textContent = monsters[kind].name;
      dialog.querySelector('.creature-description')!.textContent = monsters[kind].description;
      const stats = dialog.querySelector('dl')!;
      stats.replaceChildren();
      const legacy = waves.flat().filter((group) => group.kind === kind);
      const pairs = isDefenseMonster(kind)
        ? [
            ['Health', `${enemyRoster[kind].hp} HP`],
            ['Speed rating', String(enemyRoster[kind].rating)],
          ]
        : [
            ['Health', `${range(legacy.map((group) => group.hp))} HP`],
            ['Speed', range(legacy.map((group) => group.spd))],
          ];
      for (const [label, value] of pairs) {
        const term = document.createElement('dt'),
          definition = document.createElement('dd');
        term.textContent = label;
        definition.textContent = value;
        stats.append(term, definition);
      }
      dialog.showModal();
    });
    item.append(card);
    track.append(item);
    return card;
  });

  const controls = document.createElement('div');
  controls.className = 'bestiary-navigation';
  const previous = document.createElement('button'),
    next = document.createElement('button');
  previous.className = next.className = 'back-btn';
  previous.textContent = '←';
  next.textContent = '→';
  previous.setAttribute('aria-label', 'Previous creature');
  next.setAttribute('aria-label', 'Next creature');
  previous.setAttribute('aria-controls', track.id);
  next.setAttribute('aria-controls', track.id);
  const position = document.createElement('span');
  position.className = 'bestiary-position';
  const offset = (index: number): number => cards[index].offsetLeft - cards[0].offsetLeft;
  function current(): number {
    return cards.reduce(
      (nearest, card, index) =>
        Math.abs(card.offsetLeft - cards[0].offsetLeft - track.scrollLeft) <
        Math.abs(offset(nearest) - track.scrollLeft)
          ? index
          : nearest,
      0,
    );
  }
  function update(): void {
    position.textContent = `${cards.length} ${cards.length === 1 ? 'creature' : 'creatures'}`;
    previous.disabled = track.scrollLeft <= 1;
    next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 1;
  }
  function move(direction: number): void {
    const index = Math.max(0, Math.min(cards.length - 1, current() + direction));
    track.scrollTo({
      left: offset(index),
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  }
  previous.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  track.addEventListener('scroll', update, { passive: true });
  track.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const focused = cards.indexOf(document.activeElement as HTMLButtonElement);
    const index =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? cards.length - 1
          : Math.max(0, Math.min(cards.length - 1, focused + (event.key === 'ArrowRight' ? 1 : -1)));
    cards[index].focus({ preventScroll: true });
    track.scrollTo({ left: offset(index) });
  });
  controls.append(previous, position, next);
  carousel.append(track, controls);
  host.append(carousel, dialog);
  carouselResize = new ResizeObserver(update);
  carouselResize.observe(track);
  update();
}
