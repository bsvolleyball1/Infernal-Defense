import { enemyRoster, futureMonsters, playableMonsters } from '../content/enemies';
import { dragons, getMap } from '../content/catalog';
import { defenseRules } from '../content/defense-rules';
import { upgradeCost, upgradeTrees } from '../content/upgrades';
import type { DragonType, GameCommand, GameState, SpellKind } from '../game/types';
import { currencyOf } from '../game/ruleset';
import { element, elements, setText } from './dom';
import { dragonPortrait } from './dragon-art';
import { challengeAllowsDragon, challengeAllowsSpell } from '../content/maps';

/** Fills the sandbox roster from the playable monster list. */
export function renderTestRoster(): void {
  element('#testControls .test-roster').innerHTML = playableMonsters
    .map(
      (kind) =>
        `<label>${enemyRoster[kind].name}<input type="number" min="0" max="999" value="${kind === 'imp' ? 3 : 0}" data-test-count="${kind}" aria-label="${enemyRoster[kind].name} count"></label>`,
    )
    .join('');
  element('#testControls .future-monsters').textContent = futureMonsters.join(', ');
}

export function renderPermanent(state: GameState): void {
  const host = element('#permanentControls');
  if (!state.defense) {
    host.textContent =
      'This saved battle uses the original rules. The expanded upgrade trees become available when you start your next level.';
    return;
  }
  host.innerHTML = (['fire', 'poison', 'ice'] as const)
    .map(
      (type) =>
        `<section class="upgrade-tree"><h3>${upgradeTrees[type].name}</h3><p>${type === 'fire' ? 'Each non-attack rank also adds 1% fire damage.' : type === 'poison' ? 'Each non-attack rank also adds 1% attack rate.' : 'Each non-attack rank also adds 1% ice range.'}</p>${upgradeTrees[
          type
        ].nodes
          .map((node, i) => {
            const rank = state.defense!.ranks[type][i],
              cost = upgradeCost(rank),
              capped = rank >= (node.cap ?? defenseRules.maximumUpgradeRank);
            return `<div class="upgrade-row"><div><strong>${node.name} · Rank ${rank}</strong><small>${node.effect}</small></div><button data-permanent="${type}" data-node="${i}" ${capped || state.bankedGold < cost || state.phase === 'battle' ? 'disabled' : ''}>${capped ? 'Maximum rank' : `Upgrade · ${cost} gold`}</button></div>`;
          })
          .join('')}</section>`,
    )
    .join('');
}

export function renderDefenseControls(state: GameState): void {
  const d = state.defense;
  const geometry = getMap(state.activeLevel);
  const challenge = geometry.challenge;
  const stats = element<HTMLElement>('.stats');
  stats.dataset.mode = d ? 'defense' : 'classic';
  stats.children.item(0)?.setAttribute('aria-label', d ? 'Food' : 'Gold');
  stats.children.item(1)?.setAttribute('aria-label', 'Wave');
  stats.children.item(2)?.setAttribute('aria-label', 'Nest life points');
  element<HTMLElement>('#manaStat').setAttribute('aria-label', 'Mana');
  element('#manaStat').hidden = !d;
  element('#spellControls').hidden = !d;
  element('#testControls').hidden = d?.mode !== 'sandbox';
  element<HTMLButtonElement>('#openPermanent').disabled = state.phase === 'battle';
  const food = element('.stats span:first-child').firstChild;
  const currency = currencyOf(state);
  const prefix = `${currency.icon} ${currency.name.toUpperCase()} `;
  if (food?.nodeType === Node.TEXT_NODE && food.textContent !== prefix) food.textContent = prefix;
  const roles = d
    ? ['Red · continuous beam', 'Blue · charged attack', 'Yellow · rapid attack']
    : ['Red · burst damage', 'Blue · slow & freeze', 'Yellow · damage over time'];
  elements('.towerrole').forEach((role, i) => {
    if (role.textContent !== roles[i]) role.textContent = roles[i];
  });
  elements<HTMLButtonElement>('.tower').forEach((button) => {
    const type = button.dataset.type as DragonType,
      price = button.querySelector('.price')!,
      description = button.querySelector('.towerdesc')!;
    const orb = button.querySelector<HTMLElement>('.orb')!;
    let portrait = orb.querySelector<HTMLImageElement>('.dragon-portrait');
    if (!portrait) {
      portrait = document.createElement('img');
      portrait.className = 'dragon-portrait';
      portrait.alt = '';
      portrait.setAttribute('aria-hidden', 'true');
      orb.replaceChildren(portrait);
    }
    portrait.src = dragonPortrait(type);
    const label = `${currency.icon} ${dragons[type].cost}`;
    if (price.textContent !== label) price.textContent = label;
    const descriptions = d
      ? {
          fire: 'Tier 1: one continuous 6 DPS beam.',
          ice: 'One 15-damage charge, recharging every second.',
          poison: 'Four shots per second for 2 damage each.',
        }
      : {
          fire: 'Scorches raiders with fierce bursts of flame.',
          ice: 'Chills targets, giving the nest more time.',
          poison: 'Poisons raiders with lingering venom.',
        };
    if (description.textContent !== descriptions[type]) description.textContent = descriptions[type];
  });
  const map = element<SVGSVGElement>('#map');
  map.style.cursor = d?.targeting ? 'crosshair' : '';
  map.setAttribute('tabindex', d?.targeting ? '0' : '-1');
  if (!d) return;
  const sandbox = d.mode === 'sandbox';
  setText('#mana', sandbox ? '∞ / ∞' : `${Math.floor(d.mana)} / ${d.maxMana}`);
  const names: Record<SpellKind, string> = { fire: 'Fire Rain', ice: 'Ice Freeze', poison: 'Poison Gas' };
  elements<HTMLButtonElement>('[data-spell]').forEach((b) => {
    const key = b.dataset.spell as SpellKind,
      seconds = Math.ceil(d.spellCooldowns[key] / 1000);
    b.hidden = !challengeAllowsSpell(geometry, key);
    b.disabled =
      b.hidden ||
      state.paused ||
      state.phase !== 'battle' ||
      (!sandbox && d.mana < defenseRules.spellCost) ||
      seconds > 0;
    const label = `${names[key]} · ${d.targeting === key ? 'Select target' : seconds ? `${seconds} seconds cooldown` : `${defenseRules.spellCost} mana`}`;
    b.setAttribute('aria-label', label);
    b.title = label;
    const status = b.querySelector<HTMLElement>('.spell-cost');
    if (status) status.textContent = seconds ? `${seconds}s` : String(defenseRules.spellCost);
    b.setAttribute('aria-pressed', String(d.targeting === key));
  });
}

/** Sends the sandbox roster counts whenever one changes. */
export function bindTestWaveInputs(dispatch: (command: GameCommand) => void): () => void {
  const controller = new AbortController();
  elements<HTMLInputElement>('[data-test-count]').forEach((input) =>
    input.addEventListener(
      'change',
      () => {
        const counts = Object.fromEntries(
          elements<HTMLInputElement>('[data-test-count]').map((i) => [
            i.dataset.testCount,
            Math.max(0, Math.min(999, Math.floor(Number(i.value) || 0))),
          ]),
        );
        dispatch({ type: 'testWave', counts });
      },
      { signal: controller.signal },
    ),
  );
  return () => controller.abort();
}
export const permanentCommand = (button: HTMLElement): GameCommand => ({
  type: 'buyPermanent',
  dragon: button.dataset.permanent as DragonType,
  node: Number(button.dataset.node),
});
