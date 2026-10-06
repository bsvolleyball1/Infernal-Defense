import { test, expect, type Page } from '@playwright/test';
import { createDefenseState } from '../../src/game/defense-state';
import { createEnemy } from '../../src/game/enemy-factory';
import { finishBattle } from '../../src/game/rewards';
import { createJourney, recordJourneyResult } from '../../src/game/journey';
import { waitForServiceWorkerActivation, waitForServiceWorkerControl } from './service-worker';
import type { GameState } from '../../src/game/types';

async function putSave(page: Page, state: GameState, active = true): Promise<void> {
  await page.goto('./');
  const journey = recordJourneyResult({ ...createJourney(), activeBattle: active }, state);
  await page.evaluate((data) => localStorage.setItem('infernalDefense.save.0', JSON.stringify(data)), {
    version: 2,
    savedAt: 1,
    state,
    journey,
  });
  await page.reload();
  await page.locator('#continueJourney').click();
}
test('permanent trees purchase all nodes, persist across levels, and stay player-local', async ({ page }) => {
  const state = createDefenseState();
  state.bankedGold = 12000;
  state.phase = 'battle';
  state.wave = 5;
  finishBattle(state, true, []);
  await putSave(page, state, false);
  await page.locator('#openPermanent').click();
  await expect(page.locator('[data-permanent]')).toHaveCount(18);
  for (const type of ['fire', 'poison', 'ice'])
    for (let node = 0; node < 6; node++)
      await page.locator(`[data-permanent="${type}"][data-node="${node}"]`).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('infernalDefense.save.0')!).state);
  expect(saved.defense.ranks).toEqual({
    fire: [1, 1, 1, 1, 1, 1],
    ice: [1, 1, 1, 1, 1, 1],
    poison: [1, 1, 1, 1, 1, 1],
  });
  await page.locator('#upgradeToLevels').click();
  await page.locator('[data-level="meadow"]').click();
  await expect(page.locator('#gold')).toHaveText('145');
  await expect(page.locator('#hpText')).toHaveText('4 / 4');
  await page.reload();
  await page.locator('#continueJourney').click();
  await page.locator('#journeyResume').click();
  await expect(page.locator('#mana')).toContainText('/ 225');
  expect(await page.evaluate(() => localStorage.getItem('infernalDefense.save.1'))).toBeNull();
});
test('failed permanent purchase leaves the complete player save and bank unchanged', async ({ page }) => {
  const state = createDefenseState();
  state.bankedGold = 100;
  await putSave(page, state, false);
  await page.locator('#openPermanent').click();
  const raw = await page.evaluate(() => localStorage.getItem('infernalDefense.save.0'));
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Full', 'QuotaExceededError');
    };
  });
  await page.locator('[data-permanent="fire"][data-node="0"]').click();
  await expect(page.locator('#toast')).toContainText('storage is full');
  await expect(page.locator('#bankedGold')).toHaveText('100 gold');
  expect(await page.evaluate(() => localStorage.getItem('infernalDefense.save.0'))).toBe(raw);
});

test('a restored countdown waits for Resume and early summoning retains its bonus', async ({ page }) => {
  const state = createDefenseState();
  state.wave = 1;
  state.defense!.countdown = 2500;
  await putSave(page, state);
  await page.locator('#journeyResume').click();
  await expect(page.locator('#pauseOverlay')).toBeVisible();
  await expect(page.locator('#start')).toContainText('+30 mana');
  await page.locator('#saveProgress').click();
  const paused = await page.evaluate(() => JSON.parse(localStorage.getItem('infernalDefense.save.0')!).state);
  expect(paused.defense.countdown).toBe(2500);
  expect(paused.paused).toBe(true);
  await page.locator('#resumeBattle').click();
  await page.locator('#start').click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('infernalDefense.save.0')!).state);
  expect(saved.wave).toBe(2);
  expect(saved.phase).toBe('battle');
  expect(saved.defense.mana).toBeGreaterThanOrEqual(30);
  expect(saved.defense.countdown).toBeNull();
});
for (const viewport of [
  { width: 375, height: 812 },
  { width: 844, height: 390 },
]) {
  test(`Test Mode is isolated and touch-operable at ${viewport.width}x${viewport.height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport, hasTouch: true });
    const page = await context.newPage();
    try {
      await page.goto('./');
      await page.locator('[data-open="saves"]').click();
      await page.locator('[data-new="0"]').click();
      await page.locator('#journeyExit').click();
      const before = await page.evaluate(() => localStorage.getItem('infernalDefense.save.0'));
      await page.locator('#startTestMode').tap();
      await expect(page.locator('#gold')).toHaveText('∞');
      await expect(page.locator('#tutorialTree')).toHaveCount(1);
      await expect(page.locator('[data-test-count]')).toHaveCount(17);
      await page.locator('[data-test-count="imp"]').fill('0');
      await page.locator('[data-test-count="witch"]').fill('2');
      await page.locator('[data-test-count="witch"]').blur();
      await page.locator('[data-type="ice"]').tap();
      await page.getByRole('button', { name: 'Empty perch 1', exact: true }).tap();
      for (let i = 0; i < 5; i++) await page.locator('#upgrade').tap();
      await expect(page.getByRole('button', { name: 'Frost, level 6, perch 1', exact: true })).toBeVisible();
      await page.locator('#start').tap();
      await expect(page.locator('#enemies')).toContainText('Witch');
      await page.screenshot({
        path: test.info().outputPath(`sandbox-${viewport.width}.png`),
        fullPage: true,
      });
      await page.locator('#returnMenu').tap();
      expect(await page.evaluate(() => localStorage.getItem('infernalDefense.save.0'))).toBe(before);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      expect(overflow).toBe(false);
    } finally {
      await context.close();
    }
  });
}
for (const spell of ['fire', 'ice', 'poison'] as const) {
  test(`${spell} spell works with accessible controls and survives pause/reload`, async ({ page }) => {
    const state = createDefenseState();
    state.phase = 'battle';
    state.wave = 1;
    state.defense!.mana = 200;
    state.enemies = [createEnemy(state, 'demon', 1000, 0.1, 1)];
    state.enemiesSummoned = 1;
    await putSave(page, state);
    await page.locator('#journeyResume').click();
    await page.locator('#resumeBattle').click();
    await page.locator(`[data-spell="${spell}"]`).click();
    if (spell !== 'ice') {
      await page.locator('#map').focus();
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('Enter');
    }
    await page.locator('#pause').click();
    await expect(page.locator('#pauseOverlay')).toBeVisible();
    const before = await page.evaluate(
      () => JSON.parse(localStorage.getItem('infernalDefense.save.0')!).state,
    );
    expect(before.defense.mana).toBeLessThan(60);
    expect(before.defense.spellCooldowns[spell]).toBeGreaterThan(0);
    await page.reload();
    await page.locator('#continueJourney').click();
    await page.locator('#journeyResume').click();
    await expect(page.locator('#pauseOverlay')).toBeVisible();
    expect(
      await page.evaluate(() => JSON.parse(localStorage.getItem('infernalDefense.save.0')!).state),
    ).toEqual(before);
  });
}
test('offline cold launch retains expanded carrier, charges, spell impact and RNG state', async ({
  page,
  context,
}) => {
  const state = createDefenseState('volcanic');
  state.phase = 'battle';
  state.paused = true;
  state.wave = 1;
  const e = createEnemy(state, 'lich', 190, 0.3, 12, 1);
  e.max = 190;
  e.returning = true;
  e.carryingEgg = 1;
  e.empowered = true;
  state.enemies = [e];
  state.enemiesSummoned = 1;
  state.eggs[0] = { id: 1, status: 'carried', progress: null, carrier: e.id, routeId: 1, direct: false };
  state.towers[0] = { type: 'ice', level: 4, cooldown: 0, charges: 2, chargeTimer: 400 };
  state.defense!.impacts = [{ id: state.nextEntityId++, x: 500, y: 200, remaining: 300, damage: 25 }];
  state.defense!.rng = 987654;
  await putSave(page, state);
  await waitForServiceWorkerActivation(page);
  await page.reload();
  await waitForServiceWorkerControl(page);
  await page.close();
  await context.setOffline(true);
  const cold = await context.newPage();
  await cold.goto('./');
  await cold.locator('#continueJourney').click();
  await cold.locator('#journeyResume').click();
  await expect(cold.locator('#pauseOverlay')).toBeVisible();
  expect(
    await cold.evaluate(() => JSON.parse(localStorage.getItem('infernalDefense.save.0')!).state),
  ).toEqual(state);
  await context.setOffline(false);
});
