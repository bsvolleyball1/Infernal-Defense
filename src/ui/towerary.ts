import { dragonFormRecipes, dragonForms, dragonTypeForColor } from '../content/dragon-forms';
import type { DragonForm } from '../game/types';
import { dragonPortrait } from './dragon-art';
import { element } from './dom';

const colorNames = { red: 'Red', blue: 'Blue', yellow: 'Yellow' } as const;

export function renderTowerary(): void {
  const host = element('#toweraryContent');
  host.replaceChildren();
  const dialog = document.createElement('dialog');
  dialog.className = 'towerary-dialog';
  dialog.setAttribute('aria-labelledby', 'toweraryName');
  dialog.innerHTML =
    '<button class="back-btn towerary-close" autofocus aria-label="Close dragon details">Close</button><div class="towerary-portrait"></div><h2 id="toweraryName"></h2><dl class="towerary-stats"></dl><p class="towerary-description"></p><div class="towerary-recipe"></div>';
  let opener: HTMLButtonElement | null = null;
  dialog.querySelector('button')!.addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') event.stopPropagation();
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

  const grid = document.createElement('div');
  grid.className = 'towerary-grid';
  for (const form of Object.keys(dragonForms) as DragonForm[]) {
    const profile = dragonForms[form];
    const recipes = dragonFormRecipes[form];
    const recipe = recipes[0];
    const tier = recipe.length;
    const baseColor = tier === 1 ? recipe[0] : recipe.find((color) => color === 'red') ?? recipe[0];
    const type = dragonTypeForColor[baseColor];
    const card = document.createElement('button');
    card.className = 'towerary-card';
    card.dataset.form = form;
    card.setAttribute('aria-haspopup', 'dialog');
    const image = document.createElement('img');
    image.src = dragonPortrait(type, tier, tier > 1, form);
    image.alt = '';
    image.draggable = false;
    const name = document.createElement('strong');
    name.textContent = profile.name;
    const recipeText = document.createElement('small');
    recipeText.textContent = `Tier ${tier} · ${recipe.map((color) => colorNames[color]).join(' + ')}`;
    card.append(image, name, recipeText);
    card.addEventListener('click', () => {
      opener = card;
      dialog.querySelector('.towerary-portrait')!.replaceChildren(image.cloneNode() as HTMLImageElement);
      dialog.querySelector('#toweraryName')!.textContent = profile.name;
      dialog.querySelector('.towerary-description')!.textContent = profile.description;
      const stats = dialog.querySelector<HTMLElement>('.towerary-stats')!;
      stats.replaceChildren();
      for (const [label, value] of [
        ['Tier', String(tier)],
        ['Damage', String(profile.damage)],
        ['Attack', profile.interval ? `${profile.interval / 1000}s interval` : 'Continuous'],
        ['Ability', profile.ability],
      ]) {
        const term = document.createElement('dt');
        const dd = document.createElement('dd');
        term.textContent = label;
        dd.textContent = value;
        stats.append(term, dd);
      }
      const recipeHost = dialog.querySelector<HTMLElement>('.towerary-recipe')!;
      recipeHost.replaceChildren();
      const title = document.createElement('h3');
      title.textContent = 'Creation recipe';
      recipes.forEach((recipe, recipeIndex) => {
        if (recipes.length > 1) {
          const recipeTitle = document.createElement('h4');
          recipeTitle.textContent = `Recipe ${recipeIndex + 1}`;
          recipeHost.append(recipeTitle);
        }
        const steps = document.createElement('ol');
        recipe.forEach((color, index) => {
          const step = document.createElement('li');
          step.textContent =
            index === 0
              ? `Place a Tier 1 ${colorNames[color]} dragon.`
              : `Mix it with ${colorNames[color]} for Tier ${index + 1}.`;
          steps.append(step);
        });
        recipeHost.append(steps);
      });
      recipeHost.prepend(title);
      dialog.showModal();
    });
    grid.append(card);
  }
  host.append(grid, dialog);
}
