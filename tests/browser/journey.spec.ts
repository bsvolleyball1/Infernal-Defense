import { test, expect, type Page } from '@playwright/test';
import { createInitialState } from '../../src/game/engine';

async function newPlayer(page: Page) {
  await page.goto('./'); await page.locator('[data-open="saves"]').click(); await page.locator('[data-new="0"]').click();
  await expect(page.locator('[data-page="levels"]')).toBeVisible();
}
async function saved(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('infernalDefense.save.0')!));
}
async function failWrites(page: Page) {
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    (window as unknown as { restoreStorage: () => void }).restoreStorage = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = () => { throw new DOMException('Storage full', 'QuotaExceededError'); };
  });
}

test('startup is save-first and creates player progress before level selection', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('#continueJourney')).toBeHidden();
  await expect(page.locator('[data-level]').first()).toBeHidden();
  await page.locator('[data-open="saves"]').click(); await page.locator('[data-new="0"]').click();
  expect((await saved(page)).journey).toEqual({ activeBattle: false, completedLevels: [] });
  await expect(page.locator('#journeyGold')).toHaveText('0 gold banked');
  await expect(page.locator('#journeyResume')).toBeHidden();
  await page.locator('#journeyExit').click(); await page.reload();
  await expect(page.locator('#continueJourney')).toBeVisible(); await page.locator('#continueJourney').click();
  await expect(page.locator('#journeyHeading')).toContainText('Save slot 1');
  expect((await saved(page)).journey.activeBattle).toBe(false);
});

test('one active attempt locks level selection and resumes the same player without another slot', async ({ page }) => {
  await newPlayer(page); await page.locator('[data-level="meadow"]').click();
  await page.locator('[data-type="fire"]').click(); await page.getByRole('button', { name: 'Empty perch 5', exact: true }).click();
  await page.locator('#start').click(); await page.locator('#returnMenu').click();
  const before = await saved(page);
  for (const level of ['tutorial', 'level1', 'meadow', 'volcanic']) await expect(page.locator(`[data-level="${level}"]`)).toBeDisabled();
  await expect(page.locator('#journeyLevelNotice')).toContainText('Willow Bend is in progress');
  await page.locator('#journeyExit').click(); await page.reload(); await page.locator('#continueJourney').click();
  await expect(page.locator('#journeyResume')).toContainText('Willow Bend'); await page.locator('#journeyResume').click();
  await expect(page.locator('#pauseOverlay')).toBeVisible();
  expect((await saved(page)).state).toEqual(before.state);
  expect(await page.evaluate(() => [0, 1, 2].filter(i => localStorage.getItem(`infernalDefense.save.${i}`) !== null))).toEqual([0]);
});

test('two completed levels and rewards carry into a third level in the same player save', async ({ page }) => {
  const state = createInitialState('meadow', 62); state.phase = 'battle'; state.wave = 5; state.paused = true;
  state.knownMonsters = ['scout'];
  await page.goto('./');
  await page.evaluate(state => localStorage.setItem('infernalDefense.save.0', JSON.stringify({ version: 2, savedAt: 1, state,
    journey: { activeBattle: true, completedLevels: ['level1'] } })), state);
  await page.reload(); await page.locator('#continueJourney').click(); await page.locator('#journeyResume').click();
  await page.locator('#resumeBattle').click(); await expect(page.locator('#resultTitle')).toHaveText('Valley defended');
  expect((await saved(page)).journey).toEqual({ activeBattle: false, completedLevels: ['level1', 'meadow'] });
  expect((await saved(page)).state.bankedGold).toBe(112);
  await page.locator('#resultContinue').click(); await page.locator('#upgradeToLevels').click();
  await expect(page.locator('#journeyCleared')).toHaveText('2 / 4 levels cleared');
  await page.locator('[data-level="volcanic"]').click();
  const next = await saved(page);
  expect(next.journey).toEqual({ activeBattle: true, completedLevels: ['level1', 'meadow'] });
  expect(next.state).toMatchObject({ activeLevel: 'volcanic', bankedGold: 112, knownMonsters: ['scout'] });
  expect(next.state.towers).toHaveLength(10);
  await page.reload(); await page.locator('#continueJourney').click();
  await expect(page.locator('#journeyGold')).toHaveText('112 gold banked');
  await expect(page.locator('.level-cleared')).toHaveCount(2);
  expect((await saved(page)).state.bankedGold).toBe(112);
});

test('ending an attempt is explicit and preserves player progress', async ({ page }) => {
  await newPlayer(page); await page.locator('[data-level="meadow"]').click(); await page.locator('#returnMenu').click();
  page.once('dialog', dialog => dialog.dismiss()); await page.locator('#abandonBattle').click();
  expect((await saved(page)).journey.activeBattle).toBe(true);
  page.once('dialog', dialog => dialog.accept()); await page.locator('#abandonBattle').click();
  expect((await saved(page)).journey).toEqual({ activeBattle: false, completedLevels: [] });
  await expect(page.locator('[data-level="volcanic"]')).toBeEnabled();
  await page.locator('[data-level="volcanic"]').click(); expect((await saved(page)).state.activeLevel).toBe('volcanic');
});

test('failed player creation does not allow an unsaved journey or level to start', async ({ page }) => {
  await page.goto('./'); await page.locator('[data-open="saves"]').click(); await failWrites(page);
  await page.locator('[data-new="0"]').click(); await expect(page.locator('[data-page="saves"]')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('infernalDefense.save.0'))).toBeNull();
  await expect(page.locator('#toast')).toContainText('storage is full');
});

test('failed level selection or abandonment keeps the previous journey intact', async ({ page }) => {
  await newPlayer(page); const empty = await saved(page); await failWrites(page);
  await page.locator('[data-level="meadow"]').click(); await expect(page.locator('[data-page="levels"]')).toBeVisible();
  expect(await saved(page)).toEqual(empty);
  await page.evaluate(() => (window as unknown as { restoreStorage: () => void }).restoreStorage());
  await page.locator('[data-level="meadow"]').click(); await page.locator('#returnMenu').click();
  const active = await saved(page); await failWrites(page);
  page.once('dialog', dialog => dialog.accept()); await page.locator('#abandonBattle').click();
  expect(await saved(page)).toEqual(active); await expect(page.locator('[data-level="volcanic"]')).toBeDisabled();
});
