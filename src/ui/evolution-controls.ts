import type { DragonColor, DragonForm, GameCommand, GameState } from '../game/types';
import { element } from './dom';
import { evolutionOwner, presentEvolutionChoices } from './evolution-view-model';

export function syncEvolutionChoices(owner: string, actionsVisible: boolean): void {
  const panel = element<HTMLElement>('#upgradeChoices');
  if (!actionsVisible || !owner || panel.dataset.owner !== owner) {
    panel.hidden = true;
    delete panel.dataset.owner;
    element('#upgrade').setAttribute('aria-expanded', 'false');
  }
}

export function bindEvolutionControls(
  actions: {
    readState(): GameState;
    dispatch(command: GameCommand): void;
    afterEvolve?(): void;
  },
  signal: AbortSignal,
): { open(): void; cancel(): void } {
  const panel = element<HTMLElement>('#upgradeChoices');
  const upgrade = element<HTMLButtonElement>('#upgrade');
  const cancel = () => {
    panel.hidden = true;
    delete panel.dataset.owner;
    upgrade.setAttribute('aria-expanded', 'false');
  };
  const open = () => {
    if (!panel.hidden) {
      cancel();
      upgrade.focus();
      return;
    }
    const state = actions.readState(),
      owner = evolutionOwner(state);
    if (!owner) return;
    const choices = presentEvolutionChoices(state);
    panel.dataset.owner = owner;
    panel.innerHTML = `<strong id="evolutionHeading">Add a color</strong><div class="upgrade-choice-buttons">${choices
      .map(
        (choice) =>
          `<button type="button" data-upgrade-color="${choice.color}" style="--choice-color:${choice.hex}" title="${choice.forms.map((form) => form.name).join(' or ')}">${choice.name}</button>`,
      )
      .join('')}</div><button type="button" data-upgrade-cancel>Cancel</button>`;
    panel.hidden = false;
    upgrade.setAttribute('aria-expanded', 'true');
    panel.querySelector<HTMLButtonElement>('[data-upgrade-color]')?.focus();
  };
  const commit = (color: DragonColor, form: DragonForm) => {
    const state = actions.readState();
    if (panel.dataset.owner !== evolutionOwner(state)) {
      cancel();
      return;
    }
    cancel();
    actions.dispatch({ type: 'evolve', color, form });
    actions.afterEvolve?.();
  };
  panel.addEventListener(
    'click',
    (event) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button') : null;
      if (!target) return;
      if (target.hasAttribute('data-upgrade-cancel')) {
        cancel();
        upgrade.focus();
        return;
      }
      const color = target.dataset.upgradeColor as DragonColor | undefined;
      if (color) {
        const choice = presentEvolutionChoices(actions.readState()).find((item) => item.color === color);
        if (!choice) {
          cancel();
          return;
        }
        if (choice.forms.length === 1) return commit(color, choice.forms[0].form);
        panel.innerHTML = `<strong id="evolutionHeading">Choose a form</strong><div class="upgrade-choice-buttons">${choice.forms
          .map(
            (form) =>
              `<button type="button" data-upgrade-form="${form.form}" data-color="${color}" style="--choice-color:${form.color}"><strong>${form.name}</strong><small>${form.description}</small></button>`,
          )
          .join('')}</div><button type="button" data-upgrade-cancel>Cancel</button>`;
        panel.querySelector<HTMLButtonElement>('[data-upgrade-form]')?.focus();
      } else if (target.dataset.upgradeForm)
        commit(target.dataset.color as DragonColor, target.dataset.upgradeForm as DragonForm);
    },
    { signal },
  );
  panel.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      cancel();
      upgrade.focus();
    },
    { signal },
  );
  return { open, cancel };
}
