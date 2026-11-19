import type { DragonColor, DragonForm, GameCommand, GameState } from '../game/types';
import { element } from './dom';
import { evolutionOwner, presentDirectUpgradeChoices, presentEvolutionChoices } from './evolution-view-model';

export function syncEvolutionChoices(state: GameState, actionsVisible: boolean): void {
  const panel = element<HTMLElement>('#upgradeChoices');
  if (!actionsVisible) {
    panel.hidden = true;
    delete panel.dataset.owner;
    element('#upgrade').setAttribute('aria-expanded', 'false');
    element('#mixBlue').setAttribute('aria-expanded', 'false');
    element('#mixYellow').setAttribute('aria-expanded', 'false');
  }
  const buttons: [DragonColor, string][] = [
    ['red', '#upgrade'],
    ['blue', '#mixBlue'],
    ['yellow', '#mixYellow'],
  ];
  const choices = presentEvolutionChoices(state);
  const evolved = state.defense?.ruleset === 'defense-2';
  const tower = state.selected === null ? null : state.towers[state.selected];
  const directTierThree = Boolean(tower?.evolution && tower.level >= 2);
  buttons.forEach(([color, selector]) => {
    const button = element<HTMLButtonElement>(selector);
    const choice = choices.find((item) => item.color === color);
    if (!evolved) {
      button.hidden = selector !== '#upgrade' || !actionsVisible;
      button.disabled = selector !== '#upgrade';
      const glyph = button.querySelector<HTMLElement>('.mix-glyph');
      const result = button.querySelector<HTMLElement>('.mix-result');
      if (glyph) glyph.textContent = '↑';
      if (result) result.textContent = '';
    } else {
      button.hidden = !choice || !actionsVisible;
      button.disabled = !choice;
      if (directTierThree && selector !== '#upgrade') {
        button.hidden = true;
      }
    }
    const result = button.querySelector<HTMLElement>('.mix-result');
    if (choice) {
      const label = choice.forms.map((form) => form.name).join(' / ');
      if (result) result.textContent = label;
      button.title = `Mix with ${choice.name}: ${label}`;
      button.setAttribute('aria-label', button.title);
    }
  });
}

export function bindEvolutionControls(
  actions: {
    readState(): GameState;
    dispatch(command: GameCommand): void;
    afterEvolve?(): void;
    afterChoicesChange?(): void;
  },
  signal: AbortSignal,
): { open(): void; cancel(): void } {
  const panel = element<HTMLElement>('#upgradeChoices');
  const upgrade = element<HTMLButtonElement>('#upgrade');
  const cancel = () => {
    panel.hidden = true;
    delete panel.dataset.owner;
    upgrade.setAttribute('aria-expanded', 'false');
    element('#mixBlue').setAttribute('aria-expanded', 'false');
    element('#mixYellow').setAttribute('aria-expanded', 'false');
    actions.afterChoicesChange?.();
  };
  const open = () => {
    const state = actions.readState(),
      owner = evolutionOwner(state);
    if (!owner) return;
    const choices = presentEvolutionChoices(state);
    const choice = choices.find((item) => item.color === 'red');
    const tower = state.selected === null ? null : state.towers[state.selected];
    if (tower?.evolution && tower.level >= 2) {
      panel.dataset.owner = owner;
      showDirectChoices();
      return;
    }
    if (!choice) return;
    panel.dataset.owner = owner;
    if (choice.forms.length === 1) commit(choice.color, choice.forms[0].form);
    else showFormChoices(choice.color, choice.forms);
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
  const showFormChoices = (
    color: DragonColor,
    forms: { form: DragonForm; name: string; description: string; color: string }[],
  ) => {
    panel.innerHTML = `<strong id="evolutionHeading">Choose a form</strong><div class="upgrade-choice-buttons">${forms
      .map(
        (form) =>
          `<button type="button" data-upgrade-form="${form.form}" data-color="${color}" style="--choice-color:${form.color}"><strong>${form.name}</strong><small>${form.description}</small></button>`,
      )
      .join('')}</div><button type="button" data-upgrade-cancel>Cancel</button>`;
    panel.hidden = false;
    actions.afterChoicesChange?.();
    panel.querySelector<HTMLButtonElement>('[data-upgrade-form]')?.focus();
  };
  const showDirectChoices = () => {
    const choices = presentDirectUpgradeChoices(actions.readState());
    panel.innerHTML = `<strong id="evolutionHeading">Choose upgrade</strong><div class="upgrade-choice-buttons">${choices
      .map(
        (choice) =>
          `<button type="button" data-upgrade-form="${choice.form}" data-color="${choice.mixColor}" style="--choice-color:${choice.color}"><strong>${choice.name}</strong><small>${choice.description}</small></button>`,
      )
      .join('')}</div><button type="button" data-upgrade-cancel>Cancel</button>`;
    panel.hidden = false;
    actions.afterChoicesChange?.();
    panel.querySelector<HTMLButtonElement>('[data-upgrade-form]')?.focus();
  };
  const mix = (color: DragonColor) => {
    const state = actions.readState(),
      owner = evolutionOwner(state);
    if (!owner) return;
    const tower = state.selected === null ? null : state.towers[state.selected];
    if (tower?.evolution && tower.level >= 2) {
      panel.dataset.owner = owner;
      showDirectChoices();
      return;
    }
    const choice = presentEvolutionChoices(state).find((item) => item.color === color);
    if (!choice) return;
    panel.dataset.owner = owner;
    if (choice.forms.length === 1) commit(color, choice.forms[0].form);
    else showFormChoices(color, choice.forms);
  };
  ([
    ['red', '#upgrade'],
    ['blue', '#mixBlue'],
    ['yellow', '#mixYellow'],
  ] as [DragonColor, string][]).forEach(([color, selector]) =>
    element<HTMLButtonElement>(selector).addEventListener('click', () => mix(color), {
      signal,
    }),
  );
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
        actions.afterChoicesChange?.();
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
