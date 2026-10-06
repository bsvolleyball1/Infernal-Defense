import { test, expect } from '@playwright/test';
import { createInitialState, GameEngine } from '../../src/game/engine';

for (const viewport of [{ width: 375, height: 812 }, { width: 844, height: 390 }]) {
  for (const level of [{ id: 'meadow', name: 'Willow Bend', count: 5 }, { id: 'volcanic', name: 'Obsidian Fork', count: 10 }]) {
    test(`${level.name} supports touch, keyboard and reload at ${viewport.width}x${viewport.height}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport, hasTouch: true });
      const page = await context.newPage(); const errors: string[] = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto('./'); await page.locator('[data-open="saves"]').click();
      await page.locator('[data-new="0"]').click();
      await expect(page.locator('[data-level]')).toHaveCount(4);
      await page.locator(`[data-level="${level.id}"]`).click();
      await expect(page.locator('#levelHeading')).toHaveText(level.name);
      await expect(page.locator('.perch')).toHaveCount(level.count);
      await page.locator('[data-type="fire"]').tap();
      const perch = page.getByRole('button', { name: `Empty perch ${level.count}`, exact: true });
      await perch.tap(); await expect(page.locator('#gold')).toHaveText('60');
      await page.locator('#upgrade').click();
      await expect(page.getByRole('button', { name: `Ember, level 2, perch ${level.count}`, exact: true })).toBeVisible();
      const targets = await page.locator('.perch-hit').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().width));
      expect(targets.every(width => width >= 43.9)).toBe(true);
      await page.reload(); await page.locator('[data-open="saves"]').click();
      await expect(page.locator('#saveList')).toContainText(level.name);
      await page.locator('[data-load="0"]').click(); await page.locator("#journeyResume").click();
      await expect(page.locator('.perch')).toHaveCount(level.count);
      const occupied = page.getByRole('button', { name: `Ember, level 2, perch ${level.count}`, exact: true });
      await occupied.focus(); await page.keyboard.press('Enter'); await page.locator('#sell').click();
      await expect(page.locator('#gold')).toHaveText('63');
      await page.locator('#start').click(); await page.locator('#pause').click();
      await expect(page.locator('#pauseOverlay')).toBeVisible();
      await page.reload(); await page.locator('[data-open="saves"]').click();
      await page.locator('[data-load="0"]').click(); await page.locator("#journeyResume").click();
      await expect(page.locator('#pauseOverlay')).toBeVisible();
      await page.locator('#resumeBattle').click(); await expect(page.locator('#waveState')).toHaveText('UNDER ATTACK');
      expect(errors).toEqual([]); await context.close();
    });
  }
}

test('switches geometry and controls between all three battlefields without a page reload', async ({ page }) => {
  await page.goto('./');
  for (const [slot, id, count] of [[0, 'level1', 8], [1, 'meadow', 5], [2, 'volcanic', 10]] as const) {
    await page.locator('[data-open="saves"]').click(); await page.locator(`[data-new="${slot}"]`).click();
    await page.locator(`[data-level="${id}"]`).click(); await expect(page.locator('.perch')).toHaveCount(count);
    await page.locator('[data-type="ice"]').click();
    const perch = page.getByRole('button', { name: `Empty perch ${count}`, exact: true });
    await perch.focus(); await page.keyboard.press('Space');
    await expect(page.locator('#gold')).toHaveText('65');
    await page.locator('#returnMenu').click();
    await page.locator('#journeyExit').click();
  }
  for (const [slot, count] of [[0, 8], [1, 5], [2, 10]] as const) {
    await page.locator('[data-open="saves"]').click(); await page.locator(`[data-load="${slot}"]`).click(); await page.locator("#journeyResume").click();
    await expect(page.locator('.perch')).toHaveCount(count);
    await expect(page.getByRole('button', { name: `Frost, level 1, perch ${count}`, exact: true })).toBeVisible();
    await page.locator('#returnMenu').click();
    await page.locator('#journeyExit').click();
  }
});

test('offline cold launch restores forked enemies, an egg and future route assignments', async ({ page, context }) => {
  await page.goto('./');
  expect(await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state)).toBe('activated');
  await expect(page.locator('#pwaPanel')).toHaveCount(0);
  const engine = new GameEngine(createInitialState('volcanic'));
  engine.dispatch({ type: 'startWave' });
  for (let i = 0; i < 120; i++) engine.step(1000 / 60);
  const state = engine.snapshot(); state.paused = true;
  state.enemies[1].carryingEgg = 1; state.enemies[1].returning = true;
  state.enemies[1].progress = 6;
  state.eggs[0] = { id: 1, status: 'carried', progress: null, carrier: state.enemies[1].id, routeId: 1 };
  await page.evaluate(s => localStorage.setItem('infernalDefense.save.0', JSON.stringify({ version: 2, savedAt: Date.now(), state: s })), state);
  await page.close(); await context.setOffline(true);
  const offline = await context.newPage(); await offline.goto('./');
  await offline.locator('[data-open="saves"]').click(); await offline.locator('[data-load="0"]').click(); await offline.locator("#journeyResume").click();
  await expect(offline.locator('#levelHeading')).toHaveText('Obsidian Fork');
  await expect(offline.locator('.perch')).toHaveCount(10);
  await expect(offline.locator('[data-route]')).toHaveCount(2);
  await expect(offline.locator('#pauseOverlay')).toBeVisible();
  const restored = await offline.evaluate(() => JSON.parse(localStorage.getItem('infernalDefense.save.0')!).state);
  expect(restored).toEqual(state);
  await offline.locator('#resumeBattle').click(); await offline.waitForTimeout(250);
  await offline.locator('#pause').click(); await offline.locator('#saveProgress').click();
  const saved = await offline.evaluate(() => JSON.parse(localStorage.getItem('infernalDefense.save.0')!).state);
  expect(saved.simulationTime).toBeGreaterThan(state.simulationTime);
  expect(saved.enemies.some((enemy: { routeId?: number }) => enemy.routeId === 1)).toBe(true);
  await context.setOffline(false);
});
