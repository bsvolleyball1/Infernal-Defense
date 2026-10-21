import { expect, test } from '@playwright/test';

test('corner gear opens a compact, keyboard-accessible options popup and retains settings', async ({ page }) => {
  await page.goto('./');
  const gear = page.getByRole('button', { name: 'Options', exact: true });
  const popup = page.getByRole('dialog', { name: 'Options', exact: true });
  await expect(gear).toBeVisible();
  await expect(page.locator('.menu-grid [data-open="options"]')).toHaveCount(0);
  const corner = (await gear.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(viewport.width - corner.x - corner.width).toBeCloseTo(8, 0);
  expect(viewport.height - corner.y - corner.height).toBeCloseTo(8, 0);
  expect(corner.width).toBeGreaterThanOrEqual(44);

  await gear.click();
  await expect(popup).toBeVisible();
  await expect(page.locator('[data-page="home"]')).toHaveClass(/active/);
  expect(await popup.evaluate((dialog) => dialog.matches(':modal'))).toBe(true);
  const bounds = (await popup.boundingBox())!;
  expect(bounds.width).toBeLessThan(500);
  expect(bounds.height).toBeLessThan(viewport.height - 24);
  await expect(popup.getByRole('button', { name: 'Close options' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(popup.getByRole('slider', { name: 'Sound effects loudness' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(popup.getByRole('button', { name: 'Close options' })).toBeFocused();
  await popup.getByRole('slider', { name: 'Music loudness' }).fill('37');
  await expect(popup.locator('#musicValue')).toHaveText('37%');
  await page.keyboard.press('Escape');
  await expect(popup).not.toBeVisible();
  await expect(gear).toBeFocused();

  await page.reload();
  await gear.click();
  await expect(popup.getByRole('slider', { name: 'Music loudness' })).toHaveValue('37');
  await popup.getByRole('button', { name: 'Close options' }).click();
  await expect(popup).not.toBeVisible();
  await gear.click();
  await page.mouse.click(5, 5);
  await expect(popup).not.toBeVisible();
  await page.locator('[data-open="bestiary"]').click();
  await expect(gear).toBeVisible();
});

test('gear persists across menu screens without changing the underlying page', async ({ page }) => {
  await page.goto('./');
  const gear = page.getByRole('button', { name: 'Options', exact: true });
  const popup = page.getByRole('dialog', { name: 'Options', exact: true });
  async function checkPopup(menu: string): Promise<void> {
    await expect(gear).toBeVisible();
    const before = await gear.boundingBox();
    await gear.click();
    await expect(popup).toBeVisible();
    await expect(page.locator(`.menu-page[data-page="${menu}"]`)).toHaveClass(/active/);
    await page.keyboard.press('Escape');
    await expect(popup).not.toBeVisible();
    await expect(gear).toBeFocused();
    await expect(page.locator(`.menu-page[data-page="${menu}"]`)).toHaveClass(/active/);
    expect(await gear.boundingBox()).toEqual(before);
  }
  await checkPopup('home');
  await page.locator('[data-open="bestiary"]').click();
  await checkPopup('bestiary');
  await page.locator('[data-page="bestiary"] [data-home]').click();
  await page.locator('[data-open="saves"]').click();
  await checkPopup('saves');
  await page.locator('[data-new="0"]').click();
  await checkPopup('levels');
  await page.locator('#openPermanent').click();
  await checkPopup('upgrades');
  await page.locator('#upgradeToLevels').click();
  await page.locator('[data-level="level1"]').click();
  await expect(page.locator('#map')).toBeVisible();
  await expect(gear).not.toBeVisible();
});

test.describe('mobile options', () => {
  test.use({ hasTouch: true, viewport: { width: 568, height: 320 } });

  test('popup fits a small landscape phone and yields to the portrait fallback', async ({ page }, testInfo) => {
    await page.goto('./');
    const gear = page.getByRole('button', { name: 'Options', exact: true });
    const popup = page.getByRole('dialog', { name: 'Options', exact: true });
    await gear.tap();
    const bounds = (await popup.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(8);
    expect(bounds.y).toBeGreaterThanOrEqual(8);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(560);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(312);
    await expect(popup.getByRole('slider', { name: 'Sound effects loudness' })).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath('options-popup.png') });
    await page.setViewportSize({ width: 320, height: 568 });
    await expect(popup).not.toBeVisible();
    await expect(page.locator('.orientation-gate')).toBeVisible();
    await page.setViewportSize({ width: 568, height: 320 });
    await expect(page.locator('.orientation-gate')).not.toBeVisible();
    await gear.tap();
    await expect(popup).toBeVisible();
    await popup.getByRole('button', { name: 'Close options' }).tap();
    await expect(popup).not.toBeVisible();
  });
});
