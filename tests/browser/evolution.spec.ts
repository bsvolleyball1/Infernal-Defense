import { openPause } from './pause';
import { test, expect, type Page } from '@playwright/test';
import { createDefenseState } from '../../src/game/defense-state';
import { GameEngine, createInitialState } from '../../src/game/engine';
import { clickMapAt } from './map';
import { waitForServiceWorkerActivation, waitForServiceWorkerControl } from './service-worker';
import type { GameState, Level } from '../../src/game/types';
import { getMap } from '../../src/content/maps';

function purpleState() {
  const state = createDefenseState('level1', undefined, false, 'defense-2');
  state.gold = 1000;
  state.defense.countdown = 5000;
  const engine = new GameEngine(state);
  engine.dispatch({ type: 'choose', dragon: 'fire' });
  engine.dispatch({ type: 'place', point: { x: 75, y: 225 } });
  engine.dispatch({ type: 'evolve', color: 'blue', form: 'purple' });
  return engine.snapshot();
}
async function seed(page: Page, state: GameState, completedLevels: Level[] = []) {
  await page.goto('./');
  await page.evaluate((data) => localStorage.setItem('infernalDefense.save.0', JSON.stringify(data)), {
    version: 2,
    savedAt: 1,
    state,
    journey: { activeBattle: true, completedLevels },
  });
  await page.reload();
  await page.locator('#continueJourney').click();
  await page.locator('#journeyResume').click();
  if (await page.locator('#pauseOverlay').isVisible()) await page.locator('#resumeBattle').click();
}

for (const viewport of [
  { width: 812, height: 375 },
  { width: 844, height: 390 },
]) {
  test(`alternate evolution choices remain usable and restore at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await seed(page, purpleState());
    await page.locator('#upgrade').click();
    await expect(page.locator('#upgradeChoices')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#upgradeChoices')).toBeHidden();
    await expect(page.locator('#upgrade')).toBeFocused();
    await page.locator('#upgrade').click();
    await page.locator('[data-upgrade-color="red"]').click();
    await expect(page.locator('[data-upgrade-form]')).toHaveCount(2);
    const box = await page.locator('#upgradeChoices').boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    await page.screenshot({ path: test.info().outputPath(`evolution-choices-${viewport.width}.png`), fullPage: true });
    await page.locator('[data-upgrade-form="purple2"]').click();
    await expect(page.locator('#upgradeChoices')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Purple 2, tier 3, dragon 1', exact: true })).toBeVisible();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('infernalDefense.save.0')!).state);
    expect(saved.towers[0].evolution).toEqual({ colors: ['blue', 'red', 'red'], form: 'purple2' });
    expect(saved.gold).toBe(805);
    await page.reload();
    await page.locator('#continueJourney').click();
    await page.locator('#journeyResume').click();
    await page.locator('#resumeBattle').click();
    await page.getByRole('button', { name: 'Purple 2, tier 3, dragon 1', exact: true }).click();
    await expect(page.locator('#upgrade')).toBeDisabled();
    expect(errors).toEqual([]);
  });
}

test('keyboard places snapped cells and cancellation never spends food', async ({ page }) => {
  await page.goto('./');
  await page.locator('[data-open="saves"]').click();
  await page.locator('[data-new="0"]').click();
  await page.locator('[data-level="level1"]').click();
  const initial = await page.evaluate(() => JSON.parse(localStorage.getItem('infernalDefense.save.0')!).state);
  const firstCell = getMap(initial.activeLevel, initial.defense?.ruleset, initial.defense?.mobileLayout).perches[0];
  await page.locator('[data-type="poison"]').click();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.locator('#towers .tower-marker')).toHaveCount(1);
  await expect(page.locator('#towers .tower-marker')).toHaveAttribute(
    'transform',
    `translate(${firstCell.x + 50} ${firstCell.y})`,
  );
  await expect(page.locator('#towers .tower-icon')).toHaveAttribute('href', /yellow-1/);
  await page.locator('[data-type="fire"]').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.placement-preview')).toHaveAttribute('visibility', 'hidden');
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('infernalDefense.save.0')!).state);
  expect(state.chosen).toBeNull();
  expect(state.gold).toBe(70);
});

test('all 22 forms can be created through the player controls', async ({ page }) => {
  test.setTimeout(120_000);
  const cases = [
    ['red', 'red'],
    ['blue', 'blue'],
    ['yellow', 'yellow'],
    ['red,red', 'red2'],
    ['red,blue', 'purple'],
    ['red,yellow', 'orange'],
    ['blue,blue', 'blue2'],
    ['blue,yellow', 'green'],
    ['yellow,yellow', 'yellow2'],
    ['red,red,red', 'red3'],
    ['red,red,blue', 'bloodRed'],
    ['red,red,blue', 'purple2'],
    ['red,red,yellow', 'pink'],
    ['red,red,yellow', 'orange2'],
    ['blue,blue,blue', 'blue3'],
    ['blue,blue,red', 'black'],
    ['blue,blue,yellow', 'gray'],
    ['blue,blue,yellow', 'green2'],
    ['yellow,yellow,yellow', 'yellow3'],
    ['red,yellow,yellow', 'sun'],
    ['blue,yellow,yellow', 'turquoise'],
    ['red,blue,yellow', 'white'],
  ] as const;
  const types = { red: 'fire', blue: 'ice', yellow: 'poison' };
  for (const [recipe, form] of cases) {
    const state = createDefenseState('level1', undefined, false, 'defense-2');
    state.gold = 1000;
    state.defense.countdown = 5000;
    await seed(page, state);
    const colors = recipe.split(',') as ('red' | 'blue' | 'yellow')[];
    await page.locator(`[data-type="${types[colors[0]]}"]`).click();
    await clickMapAt(page, 75, 225);
    for (const color of colors.slice(1)) {
      await page.locator('#towers .tower-marker').first().click();
      await page.locator('#upgrade').click();
      await page.locator(`[data-upgrade-color="${color}"]`).click();
      if (await page.locator('[data-upgrade-form]').count())
        await page.locator(`[data-upgrade-form="${form}"]`).click();
    }
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('infernalDefense.save.0')!).state);
    expect(saved.towers[0].evolution.form, recipe).toBe(form);
    expect(saved.towers[0].level).toBe(colors.length);
  }
});

test('open color choices close when another tower is selected', async ({ page }) => {
  const state = purpleState();
  state.gold = 1000;
  const engine = new GameEngine(state);
  engine.dispatch({ type: 'choose', dragon: 'ice' });
  engine.dispatch({ type: 'place', point: { x: 25, y: 25 } });
  await seed(page, engine.snapshot());
  await page.getByRole('button', { name: 'Purple, tier 2, dragon 1', exact: true }).click();
  await page.locator('#upgrade').click();
  await page.getByRole('button', { name: /Blue, tier 1, dragon 2/ }).click();
  await expect(page.locator('#upgradeChoices')).toBeHidden();
});

for (const [level, forbidden] of [
  ['noPoisonTrial', 'poison'],
  ['noIceTrial', 'ice'],
  ['noFireTrial', 'fire'],
] as const) {
  test(`${level} restricts placement, spells and evolution colors consistently`, async ({ page }) => {
    const state = createDefenseState(level, undefined, false, 'defense-2');
    state.defense.countdown = 5000;
    await seed(page, state, ['fireTrial', 'iceTrial', 'poisonTrial', 'noPoisonTrial', 'noIceTrial']);
    await expect(page.locator(`#battleDragons [data-type="${forbidden}"]`)).toBeHidden();
    await expect(page.locator(`#battleSpells [data-spell="${forbidden}"]`)).toBeHidden();
    await expect(page.locator('#battleDragons .tower:visible')).toHaveCount(2);
    await page.locator('#battleDragons .tower:visible').first().click();
    await clickMapAt(page, 75, 125);
    await page.locator('#upgrade').click();
    await expect(page.locator('[data-upgrade-color]')).toHaveCount(2);
    const colors = { fire: 'red', ice: 'blue', poison: 'yellow' };
    await expect(page.locator(`[data-upgrade-color="${colors[forbidden]}"]`)).toHaveCount(0);
    const stateAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('infernalDefense.save.0')!).state);
    expect(stateAfter.towers.filter(Boolean)).toHaveLength(1);
  });
}

test('offline cold launch switches historical and new profiles on the same map and caches yellow portraits', async ({
  page,
  context,
}) => {
  await page.goto('./');
  await waitForServiceWorkerActivation(page);
  await page.reload();
  await waitForServiceWorkerControl(page);
  const original = createInitialState();
  original.towers[0] = { type: 'fire', level: 8, cooldown: 0 };
  const expanded = createDefenseState();
  expanded.towers[0] = { type: 'fire', level: 5, cooldown: 400, position: { x: 90, y: 202 } };
  expanded.defense.countdown = 5000;
  await page.evaluate(
    (states) =>
      states.forEach((state, i) =>
        localStorage.setItem(
          `infernalDefense.save.${i}`,
          JSON.stringify({
            version: 2,
            savedAt: i + 1,
            state,
            journey: { activeBattle: true, completedLevels: [] },
          }),
        ),
      ),
    [original, expanded, purpleState()],
  );
  await context.setOffline(true);
  const offline = await context.newPage();
  await offline.goto('./');
  for (const [slot, grid, position] of [
    [2, true, 'translate(75 225)'],
    [1, false, 'translate(90 202)'],
    [0, false, 'translate(90 202)'],
  ] as const) {
    await offline.locator('[data-open="saves"]').click();
    await offline.locator(`[data-load="${slot}"]`).click();
    await offline.locator('#journeyResume').click();
    if (grid) await expect(offline.locator('#towerGrid rect')).not.toHaveCount(0);
    else await expect(offline.locator('#towerGrid rect')).toHaveCount(0);
    await expect(offline.locator('#towers .tower-marker')).toHaveAttribute('transform', position);
    await openPause(offline);
    await offline.locator('#returnMenu').click();
    await offline.locator('#journeyExit').click();
  }
  const cached = await offline.evaluate(async () => {
    const requests = (
      await Promise.all((await caches.keys()).map(async (key) => (await caches.open(key)).keys()))
    ).flat();
    const yellow = requests.filter((request) => /yellow-[123]-/.test(request.url));
    return {
      count: yellow.length,
      accessible: (
        await Promise.all(yellow.map((request) => fetch(request.url).then((response) => response.ok)))
      ).every(Boolean),
    };
  });
  expect(cached.count).toBe(3);
  expect(cached.accessible).toBe(true);
});
