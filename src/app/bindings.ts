import type { Level } from '../game/types';
import { permanentCommand } from '../ui/defense-controls';
import { element, elements } from '../ui/dom';
import { isMenuPage } from '../ui/menus';
import { copy } from './copy';
import type { JourneyController } from './journey-controller';
import type { NavigationController } from './navigation';
import type { SettingsController } from './settings-controller';

export interface MenuBindingTargets {
  navigation: NavigationController;
  journeys: JourneyController;
  settings: SettingsController;
  unlockAudio(): void;
  setSaveIntro(text: string): void;
  /** Leave the results overlay and open the permanent-upgrade screen. */
  continueFromResults(): void;
}

function bindOptionsPopup(): void {
  const options = element<HTMLDialogElement>('#optionsDialog');
  element('#closeOptions').addEventListener('click', () => options.close());
  options.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key !== 'Tab') return;
    const controls = Array.from(options.querySelectorAll<HTMLElement>('button, input'));
    const index = controls.indexOf(document.activeElement as HTMLElement);
    if (index < 0 || (event.shiftKey && index === 0) || (!event.shiftKey && index === controls.length - 1)) {
      event.preventDefault();
      (event.shiftKey ? controls.at(-1) : controls[0])?.focus();
    }
  });
  options.addEventListener('click', (event) => {
    if (event.target !== options) return;
    const bounds = options.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )
      options.close();
  });
}

/** Wires menu DOM events to the controllers. Holds no state of its own. */
export function bindMenuControls(targets: MenuBindingTargets): void {
  const { navigation, journeys, settings } = targets;
  bindOptionsPopup();
  element('#sound').addEventListener('click', () => settings.toggleQuiet());
  for (const field of ['music', 'sound'] as const) {
    element<HTMLInputElement>(`#${field}Volume`).addEventListener('input', (event) => {
      settings.setVolume(field, Number((event.target as HTMLInputElement).value));
    });
  }
  elements<HTMLButtonElement>('[data-open]').forEach((button) =>
    button.addEventListener('click', () => {
      targets.unlockAudio();
      targets.setSaveIntro(copy.saveIntro);
      if (isMenuPage(button.dataset.open)) navigation.navigate(button.dataset.open);
    }),
  );
  elements('[data-home]').forEach((button) => button.addEventListener('click', () => navigation.returnHome()));
  element('#continueJourney').addEventListener('click', () => journeys.continueLatest());
  element('#openPermanent').addEventListener('click', () => journeys.openUpgrades());
  element('#permanentControls').addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLElement>('[data-permanent]');
    if (button) journeys.buyPermanent(permanentCommand(button));
  });
  element('#startTestMode').addEventListener('click', () => journeys.startTestMode());
  element('#journeyResume').addEventListener('click', () => journeys.resumeBattle());
  element('#abandonBattle').addEventListener('click', () => navigation.abandonBattle());
  element('#journeyExit').addEventListener('click', () => journeys.exit());
  elements<HTMLButtonElement>('[data-level]').forEach((button) =>
    button.addEventListener('click', () => navigation.launchLevel(button.dataset.level as Level)),
  );
  element('#saveList').addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const load = event.target.closest<HTMLElement>('[data-load]');
    const fresh = event.target.closest<HTMLElement>('[data-new]');
    if (load) journeys.load(Number(load.dataset.load));
    if (fresh) journeys.create(Number(fresh.dataset.new));
  });
  element('#resultContinue').addEventListener('click', () => targets.continueFromResults());
  element('#upgradeToLevels').addEventListener('click', () => navigation.navigate('levels'));
}
