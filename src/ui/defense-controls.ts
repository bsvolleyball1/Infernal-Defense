import { enemyRoster, futureMonsters, playableMonsters } from '../content/enemies';
import { dragons } from '../content/catalog';
import { defenseRules } from '../content/defense-rules';
import { upgradeCost, upgradeTrees } from '../content/upgrades';
import type { DragonType, GameCommand, GameState, Point, SpellKind } from '../game/types';
import { element, elements, setText } from './dom';

export function mountDefenseControls(): void {
  const stats = document.createElement('span');
  stats.id = 'manaStat';
  stats.hidden = true;
  stats.innerHTML = '✦ MANA <b id="mana">0 / 200</b>';
  element('.stats').append(stats);
  const controls = document.createElement('section');
  controls.id = 'spellControls';
  controls.hidden = true;
  controls.innerHTML =
    '<h3>Battle spells</h3><div class="spell-buttons"><button data-spell="poison">Poison Gas</button><button data-spell="ice">Ice Freeze</button><button data-spell="fire">Fire Rain</button></div><p id="spellHelp">Area spells: tap the map, or focus it and use arrow keys then Enter. Escape cancels.</p>';
  element('.wave').before(controls);
  const test = document.createElement('section');
  test.id = 'testControls';
  test.hidden = true;
  test.innerHTML =
    '<h3>Test wave</h3><p>Unsaved sandbox. Unlimited food and mana; no journey rewards or discoveries.</p><div class="test-roster">' +
    playableMonsters
      .map(
        (kind) =>
          `<label>${enemyRoster[kind].name}<input type="number" min="0" max="999" value="${kind === 'imp' ? 3 : 0}" data-test-count="${kind}" aria-label="${enemyRoster[kind].name} count"></label>`,
      )
      .join('') +
    '</div><details><summary>Coming soon</summary><p>' +
    futureMonsters.join(', ') +
    '</p></details>';
  element('.wave').before(test);
  const button = document.createElement('button');
  button.id = 'startTestMode';
  button.className = 'menu-card';
  button.innerHTML =
    '<span class="menu-icon">⚒</span><span><strong>Test Mode</strong><small>Choose your own monster waves in an unsaved sandbox</small></span>';
  element('[data-page="home"] .menu-grid').append(button);
  const upgrades = document.createElement('div');
  upgrades.id = 'permanentControls';
  element('.upgrade-placeholder').replaceWith(upgrades);
  const entry = document.createElement('button');
  entry.id = 'openPermanent';
  entry.className = 'btn secondary';
  entry.textContent = 'Permanent upgrades';
  element('.journey-actions').append(entry);
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
  element('#manaStat').hidden = !d;
  element('#spellControls').hidden = !d;
  element('#testControls').hidden = d?.mode !== 'sandbox';
  element<HTMLButtonElement>('#openPermanent').disabled = state.phase === 'battle';
  const food = element('.stats span:first-child').firstChild;
  const prefix = d ? '🥩 FOOD ' : '✦ GOLD ';
  if (food?.nodeType === Node.TEXT_NODE && food.textContent !== prefix) food.textContent = prefix;
  const roles = d
    ? ['Fire beams and area waves', 'Rechargeable ice · chance to freeze', 'Rapid shots · poison and slow']
    : ['Fire · burst damage', 'Ice · slow & freeze', 'Venom · damage over time'];
  elements('.towerrole').forEach((role, i) => {
    if (role.textContent !== roles[i]) role.textContent = roles[i];
  });
  elements<HTMLButtonElement>('.tower').forEach((button) => {
    const type = button.dataset.type as DragonType,
      price = button.querySelector('.price')!,
      description = button.querySelector('.towerdesc')!;
    const label = `${dragons[type].cost}${d ? ' food' : 'g'}`;
    if (price.textContent !== label) price.textContent = label;
    const descriptions = d
      ? {
          fire: 'Level 1: one continuous 6 DPS beam.',
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
  if (sandbox) {
    setText('#gold', '∞');
    setText('#levelHeading', 'Test Mode');
    setText('#waveNum', state.wave);
    setText('#start', state.phase === 'battle' ? 'Test wave in progress' : 'Summon');
  } else if (d.countdown !== null)
    setText(
      '#start',
      `Summon wave ${state.wave + 1} · +${Math.ceil(d.countdown / 1000) * 10} mana (${Math.ceil(d.countdown / 1000)}s)`,
    );
  const names: Record<SpellKind, string> = { fire: 'Fire Rain', ice: 'Ice Freeze', poison: 'Poison Gas' };
  elements<HTMLButtonElement>('[data-spell]').forEach((b) => {
    const key = b.dataset.spell as SpellKind,
      seconds = Math.ceil(d.spellCooldowns[key] / 1000);
    b.disabled = state.paused || state.phase !== 'battle' || (!sandbox && d.mana < 150) || seconds > 0;
    const label = `${names[key]} · ${d.targeting === key ? 'Select target' : seconds ? `${seconds}s` : '150 mana'}`;
    if (b.textContent !== label) b.textContent = label;
    b.setAttribute('aria-pressed', String(d.targeting === key));
  });
}

function mapPoint(event: MouseEvent, map: SVGSVGElement): Point {
  const p = new DOMPoint(event.clientX, event.clientY),
    matrix = map.getScreenCTM();
  const target = matrix ? p.matrixTransform(matrix.inverse()) : p;
  return { x: Math.max(0, Math.min(700, target.x)), y: Math.max(0, Math.min(430, target.y)) };
}
export function bindDefenseControls(read: () => GameState, dispatch: (c: GameCommand) => void): void {
  const map = element<SVGSVGElement>('#map');
  elements<HTMLButtonElement>('[data-spell]').forEach((b) =>
    b.addEventListener('click', () => {
      const spell = b.dataset.spell as SpellKind;
      if (spell === 'ice') dispatch({ type: 'spell', spell });
      else {
        dispatch({ type: 'spellTarget', spell: read().defense?.targeting === spell ? null : spell });
        if (read().defense?.targeting) {
          dispatch({ type: 'previewSpell', point: { x: 350, y: 215 } });
          map.focus();
        }
      }
    }),
  );
  map.addEventListener(
    'click',
    (event) => {
      const spell = read().defense?.targeting;
      if (spell) {
        event.preventDefault();
        event.stopImmediatePropagation();
        dispatch({ type: 'spell', spell, point: mapPoint(event, map) });
      }
    },
    true,
  );
  map.addEventListener('pointermove', (event) => {
    if (read().defense?.targeting) dispatch({ type: 'previewSpell', point: mapPoint(event, map) });
  });
  map.addEventListener(
    'keydown',
    (event) => {
      const d = read().defense,
        spell = d?.targeting;
      if (!spell) return;
      if (!['Escape', 'Enter', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key))
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.key === 'Escape') dispatch({ type: 'spellTarget', spell: null });
      else if (event.key === 'Enter' || event.key === ' ')
        dispatch({ type: 'spell', spell, point: d.preview ?? { x: 350, y: 215 } });
      else {
        const p = d.preview ?? { x: 350, y: 215 };
        dispatch({
          type: 'previewSpell',
          point: {
            x: Math.max(
              0,
              Math.min(700, p.x + (event.key === 'ArrowLeft' ? -20 : event.key === 'ArrowRight' ? 20 : 0)),
            ),
            y: Math.max(
              0,
              Math.min(430, p.y + (event.key === 'ArrowUp' ? -20 : event.key === 'ArrowDown' ? 20 : 0)),
            ),
          },
        });
      }
    },
    true,
  );
  elements<HTMLInputElement>('[data-test-count]').forEach((input) =>
    input.addEventListener('change', () => {
      const counts = Object.fromEntries(
        elements<HTMLInputElement>('[data-test-count]').map((i) => [
          i.dataset.testCount,
          Math.max(0, Math.min(999, Math.floor(Number(i.value) || 0))),
        ]),
      );
      dispatch({ type: 'testWave', counts });
    }),
  );
}
export const permanentCommand = (button: HTMLElement): GameCommand => ({
  type: 'buyPermanent',
  dragon: button.dataset.permanent as DragonType,
  node: Number(button.dataset.node),
});
