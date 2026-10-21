import { test, expect, type Page } from '@playwright/test';
import { monsters } from '../../src/content/monsters';

async function openBestiary(page: Page, kinds: string[]): Promise<void> {
  await page.addInitScript(
    (entries) => localStorage.setItem('infernalDefense.bestiary', JSON.stringify(entries)),
    kinds,
  );
  await page.goto('./');
  await page.locator('[data-open="bestiary"]').click();
}

test('empty bestiary retains discovery guidance', async ({ page }) => {
  await openBestiary(page, []);
  await expect(page.getByText('No creatures recorded yet')).toBeVisible();
  await expect(page.locator('.creature-card')).toHaveCount(0);
  await expect(page.locator('.creature-dialog')).toHaveCount(0);
});

test('single discovered creature opens accessible stats and returns focus on dismissal', async ({ page }) => {
  await openBestiary(page, ['hellhound']);
  const card = page.getByRole('button', { name: 'Hellhound', exact: true });
  await expect(page.locator('.creature-card')).toHaveCount(1);
  await expect(card).toHaveText('Hellhound');
  await expect(page.getByRole('button', { name: 'Previous creature' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Next creature' })).toBeDisabled();
  await card.click();
  const dialog = page.getByRole('dialog', { name: 'Hellhound' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('dd')).toHaveText(['50 HP', '5']);
  await expect(dialog).toContainText('75% resistance to fire dragons.');
  await expect
    .poll(() => dialog.locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(card).toBeFocused();
  await expect(page.locator('[data-page="bestiary"]')).toBeVisible();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Close creature details' }).click();
  await expect(card).toBeFocused();
  await card.click();
  await page.mouse.click(2, 2);
  await expect(dialog).not.toBeVisible();
  await expect(card).toBeFocused();
});

test('dragging and touch swiping browse creatures without opening a popup', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
  try {
    const page = await context.newPage();
    await openBestiary(page, Object.keys(monsters));
    const track = page.locator('.bestiary-track');
    const box = (await track.boundingBox())!;
    const left = box.x + 30,
      right = box.x + box.width - 30,
      y = box.y + box.height / 2;
    await page.mouse.move(right, y);
    await page.mouse.down();
    await page.mouse.move(left, y, { steps: 15 });
    await page.mouse.up();
    await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.mouse.move(left, y);
    await page.mouse.down();
    await page.mouse.move(right, y, { steps: 15 });
    await page.mouse.up();
    await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBe(0);
    const client = await context.newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: right, y }] });
    for (let step = 1; step <= 12; step++) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: right + ((left - right) * step) / 12, y }],
      });
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await client.detach();
    await page.locator('.creature-card').nth(6).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  } finally {
    await context.close();
  }
});

for (const viewport of [
  { width: 568, height: 320 },
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
]) {
  test(`carousel navigation and popup bounds at ${viewport.width}x${viewport.height}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: 'reduce' });
    try {
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await openBestiary(page, Object.keys(monsters));
      const track = page.locator('.bestiary-track');
      await expect(page.locator('.creature-card')).toHaveCount(Object.keys(monsters).length);
      await expect(track).toHaveCSS('scrollbar-width', 'none');
      await page.getByRole('button', { name: 'Next creature' }).tap();
      await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
      await page.getByRole('button', { name: 'Previous creature' }).tap();
      await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBe(0);
      await page.locator('.creature-card').first().focus();
      await page.keyboard.press('End');
      await expect(page.locator('.creature-card').last()).toBeFocused();
      await expect(page.getByRole('button', { name: 'Next creature' })).toBeDisabled();
      await page.keyboard.press('Home');
      await expect(page.locator('.creature-card').first()).toBeFocused();
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('.creature-card').nth(1)).toBeFocused();
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      const bounds = (await dialog.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(8);
      expect(bounds.y).toBeGreaterThanOrEqual(8);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width - 8);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height - 8);
      await page.screenshot({ path: test.info().outputPath('creature-popup.png') });
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'Close creature details' })).toBeFocused();
      await page.keyboard.press('Escape');
      await page.locator('[data-creature="scout"]').click();
      await expect(page.locator('.creature-stats')).toContainText('45–68');
      await expect(page.locator('.creature-stats')).toContainText('0.72–0.95');
      await page.keyboard.press('Escape');
      await track.hover();
      await page.mouse.wheel(500, 0);
      await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
      await page.screenshot({ path: test.info().outputPath('creature-carousel.png') });
      await page.locator('[data-page="bestiary"] [data-home]').click();
      await page.locator('[data-open="bestiary"]').click();
      await expect(page.locator('.creature-dialog')).toHaveCount(1);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
