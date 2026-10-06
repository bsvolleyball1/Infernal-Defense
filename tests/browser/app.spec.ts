import { test, expect, type Page } from '@playwright/test';
import { createInitialState, GameEngine } from '../../src/game/engine';

async function startJourney(page: Page): Promise<void> {
  await page.goto('./');
  await page.locator('[data-open="levels"]').click();
  await page.locator('[data-level="level1"]').click();
  await page.locator('[data-new="0"]').click();
  await expect(page.locator('#gameScreen')).toBeVisible();
}

async function savedState(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('infernalDefense.save.0')!).state);
}

test('placement, upgrades, selling, wave controls and save navigation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await startJourney(page);
  await page.locator('[data-type="fire"]').click();
  await page.getByRole('button', { name: 'Empty perch 1', exact: true }).click();
  await expect(page.locator('#gold')).toHaveText('60');
  await page.locator('#upgrade').click();
  await expect(page.locator('#gold')).toHaveText('15');
  await expect(page.locator('#info')).toContainText('Level 2');
  await page.locator('#sell').click();
  await expect(page.locator('#gold')).toHaveText('63');
  await page.locator('#start').click();
  await expect(page.locator('#waveState')).toHaveText('UNDER ATTACK');
  await page.locator('#speed').click();
  await expect(page.locator('#speed')).toContainText('1.5×');
  await page.locator('#pause').click();
  await expect(page.locator('#pauseOverlay')).toBeVisible();
  const state = await savedState(page);
  await page.waitForTimeout(300);
  await page.locator('#saveProgress').click();
  expect((await savedState(page)).simulationTime).toBe(state.simulationTime);
  await page.locator('#pauseMenu').click();
  await expect(page.locator('#menuScreen')).toBeVisible();
  await page.locator('[data-open="saves"]').click();
  await page.locator('[data-load="0"]').click();
  await expect(page.locator('#pauseOverlay')).toBeVisible();
  expect((await savedState(page)).spawnSchedule).toEqual(state.spawnSchedule);
  await page.locator('#resumeBattle').click();
  await expect(page.locator('#waveState')).toHaveText('UNDER ATTACK');
  expect(errors).toEqual([]);
});

test('reload restores an exact battle with enemies, effects, carriers and projectiles', async ({ page }) => {
  const engine = new GameEngine();
  engine.dispatch({ type: 'startWave' });
  const state = engine.snapshot();
  state.simulationTime = 250;
  state.enemiesSummoned = 2;
  state.nextEntityId = 12;
  state.enemies = [
    { id: 6, kind: 'shield', hp: 90, max: 120, spd: .47, progress: 12, slow: 300, poison: 900, poisonD: 200, carryingEgg: 1, returning: true, escaped: false, rewarded: false },
    { id: 7, kind: 'scout', hp: 40, max: 45, spd: .72, progress: 4, slow: 0, poison: 0, poisonD: 0, carryingEgg: null, returning: false, escaped: false, rewarded: false },
  ];
  state.eggs[0] = { id: 1, status: 'carried', progress: null, carrier: 6 };
  state.eggs[1] = { id: 2, status: 'dropped', progress: 6, carrier: null };
  state.towers[0] = { type: 'ice', level: 2, cooldown: 321 };
  state.projectiles = [{ id: 8, x: 100, y: 200, targetId: 7, dragon: 'ice', damage: 11.36, speed: 5, level: 2 }];
  state.spawnSchedule = state.spawnSchedule.filter(spawn => spawn.at > 250);
  await page.goto('./');
  await page.evaluate(value => localStorage.setItem('infernalDefense.save.0', JSON.stringify({ version: 2, savedAt: Date.now(), state: value })), state);
  await page.reload();
  await page.locator('[data-open="saves"]').click();
  await page.locator('[data-load="0"]').click();
  await expect(page.locator('#pauseOverlay')).toBeVisible();
  await expect(page.locator('#enemies > g')).toHaveCount(2);
  await expect(page.locator('#eggObjects > g')).toHaveCount(5);
  await page.locator('#saveProgress').click();
  expect(await savedState(page)).toEqual({ ...state, paused: true });
  await page.reload();
  await page.locator('[data-open="saves"]').click();
  await page.locator('[data-load="0"]').click();
  await expect(page.locator('#pauseOverlay')).toBeVisible();
  await page.locator('#resumeBattle').click();
  await page.waitForTimeout(200);
  await page.locator('#pause').click();
  expect((await savedState(page)).simulationTime).toBeGreaterThan(state.simulationTime);
});

test('backgrounding pauses and captures the battle before returning', async ({ page, context }) => {
  await startJourney(page);
  await page.locator('#start').click();
  await page.waitForTimeout(150);
  // Trigger the same lifecycle event with the hidden flag browsers expose.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const state = await savedState(page);
  expect(state.paused).toBe(true);
  const second = await context.newPage(); await second.goto('about:blank');
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('#pauseOverlay')).toBeVisible();
  await page.locator('#saveProgress').click();
  expect((await savedState(page)).simulationTime).toBe(state.simulationTime);
});

test('completed results survive reload without awarding rewards twice', async ({ page }) => {
  const state = createInitialState();
  state.phase = 'won'; state.wave = 5; state.enemiesKilled = 12; state.enemiesSummoned = 12;
  state.rewardGold = 62; state.bankedGold = 62; state.rewardsApplied = true;
  await page.goto('./');
  await page.evaluate(value => localStorage.setItem('infernalDefense.save.0', JSON.stringify({ version: 2, savedAt: Date.now(), state: value })), state);
  for (let i = 0; i < 2; i++) {
    await page.reload(); await page.locator('[data-open="saves"]').click(); await page.locator('[data-load="0"]').click();
    await expect(page.locator('#resultTitle')).toHaveText('Valley defended');
    await expect(page.locator('#resultGold')).toHaveText('62 gold');
    await page.locator('#resultContinue').click();
    await expect(page.locator('#bankedGold')).toHaveText('62 gold');
  }
});

test('corrupt saves are preserved and storage failures never claim success', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.setItem('infernalDefense.save.1', '{broken'));
  await page.locator('[data-open="saves"]').click();
  await expect(page.locator('.error-card')).toContainText('preserved');
  await expect(page.locator('[data-new="1"]')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('infernalDefense.save.1'))).toBe('{broken');
  await page.locator('[data-new="0"]').click(); await page.locator('[data-level="level1"]').click();
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Device storage is full.', 'QuotaExceededError'); }; });
  await page.locator('#saveProgress').click();
  await expect(page.locator('#toast')).toContainText('storage is full');
  await expect(page.locator('#toast')).not.toContainText('Journey saved');
});

test('stale background tabs cannot overwrite a newer journey', async ({ page, context }) => {
  await startJourney(page);
  await page.locator('[data-type="fire"]').click();
  await page.getByRole('button', { name: 'Empty perch 1', exact: true }).click();
  const newer = await context.newPage(); await newer.goto('./');
  await newer.locator('[data-open="saves"]').click(); await newer.locator('[data-load="0"]').click();
  await newer.locator('#upgrade').click();
  expect((await savedState(newer)).towers[0].level).toBe(2);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect((await savedState(newer)).towers[0].level).toBe(2);
  expect((await savedState(newer)).gold).toBe(15);
  await expect(page.locator('#toast')).toContainText('changed in another tab');
});

test('failed result saves keep the result open until saving succeeds', async ({ page }) => {
  const state = createInitialState();
  state.phase = 'battle'; state.wave = 5; state.paused = true; state.enemiesKilled = 1; state.enemiesSummoned = 1;
  await page.goto('./');
  await page.evaluate(value => localStorage.setItem('infernalDefense.save.0', JSON.stringify({ version: 2, savedAt: Date.now(), state: value })), state);
  await page.reload(); await page.locator('[data-open="saves"]').click(); await page.locator('[data-load="0"]').click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    (window as unknown as { restoreStorage: () => void }).restoreStorage = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = () => { throw new DOMException('Storage full', 'QuotaExceededError'); };
  });
  await page.locator('#resumeBattle').click();
  await expect(page.locator('#gameOver')).toBeVisible();
  expect((await savedState(page)).bankedGold).toBe(0);
  await page.locator('#resultContinue').click();
  await expect(page.locator('#gameOver')).toBeVisible();
  await expect(page.locator('#toast')).toContainText('storage is full');
  await expect(page.locator('[data-page="upgrades"]')).toBeHidden();
  await page.evaluate(() => (window as unknown as { restoreStorage: () => void }).restoreStorage());
  await page.locator('#resultContinue').click();
  await expect(page.locator('#bankedGold')).toHaveText('51 gold');
});

test('keyboard placement works and renderer preserves live entity nodes', async ({ page }) => {
  await startJourney(page);
  await page.locator('[data-type="fire"]').focus(); await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Empty perch 1', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#gold')).toHaveText('60');
  await page.locator('#start').click();
  await expect(page.locator('#enemies > g')).not.toHaveCount(0);
  const enemy = await page.locator('#enemies > g').first().elementHandle();
  await page.waitForTimeout(60);
  expect(await enemy!.evaluate(node => node.isConnected)).toBe(true);
  await page.locator('#pause').click();
});

test.describe('phone touch input', () => {
test.use({ hasTouch: true, isMobile: true });
for (const viewport of [{ width: 375, height: 812 }, { width: 320, height: 640 }, { width: 844, height: 390 }]) {
  test(`touch controls and layout at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await startJourney(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('[data-type="fire"] .price')).toBeVisible();
    const box = await page.locator('#start').boundingBox(); expect(box!.height).toBeGreaterThanOrEqual(44);
    const touchWidth = await page.locator('.perch').first().evaluate(perch => {
      const svg = perch.closest('svg')!;
      const matrix = svg.getScreenCTM()!;
      return Number(perch.lastElementChild!.getAttribute('r')) * 2 * Math.min(Math.abs(matrix.a), Math.abs(matrix.d));
    });
    expect(touchWidth).toBeGreaterThanOrEqual(43.9);
    await page.locator('[data-type="fire"]').tap();
    await page.getByRole('button', { name: 'Empty perch 1', exact: true }).tap();
    await expect(page.locator('#gold')).toHaveText('60');
    await page.screenshot({ path: test.info().outputPath(`phone-${viewport.width}.png`), fullPage: true });
  });
}
});

test('manifest, icons, service worker and offline cold launch work at repository subpath', async ({ page, context, request }) => {
  const requests: string[] = [];
  context.on('request', request => requests.push(request.url()));
  await startJourney(page);
  await expect(page.locator('#pwaPanel')).toContainText(/offline ready|ready to play offline/i);
  const manifestUrl = await page.locator('link[rel="manifest"]').getAttribute('href');
  const response = await request.get(new URL(manifestUrl!, page.url()).href);
  const manifest = await response.json();
  expect(manifest.scope).toBe('/Infernal-Defense/'); expect(manifest.start_url).toBe('/Infernal-Defense/');
  expect(manifest.display).toBe('standalone'); expect(manifest.orientation).toBe('any');
  for (const icon of manifest.icons) expect((await request.get(new URL(icon.src, page.url()).href)).ok()).toBe(true);
  await page.locator('#start').click(); await page.locator('#pause').click();
  const before = await savedState(page);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await context.setOffline(true);
  await page.close();
  const cold = await context.newPage(); await cold.goto('./');
  await cold.locator('[data-open="saves"]').click(); await cold.locator('[data-load="0"]').click();
  await expect(cold.locator('#pauseOverlay')).toBeVisible();
  await cold.evaluate(() => document.fonts.ready);
  expect(await cold.evaluate(() => document.fonts.check('14px "DM Sans"'))).toBe(true);
  await cold.locator('#saveProgress').click();
  expect(await savedState(cold)).toEqual(before);
  await cold.locator('#resumeBattle').click(); await cold.waitForTimeout(100); await cold.locator('#pause').click();
  expect((await savedState(cold)).simulationTime).toBeGreaterThan(before.simulationTime);
  await context.setOffline(false);
  expect(requests.filter(url => new URL(url).origin !== new URL(cold.url()).origin)).toEqual([]);
});
