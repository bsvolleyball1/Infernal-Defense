import { test, expect } from '@playwright/test';
import { openPause } from './pause';

test('three authored mobile maps fill the phone and retain their saved frame after reload', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
  try {
    const page = await context.newPage();
    await page.goto('./');
    for (const [slot, level] of [
      [0, 'level1'],
      [1, 'meadow'],
      [2, 'volcanic'],
    ] as const) {
      await page.locator('[data-open="saves"]').tap();
      await page.locator(`[data-new="${slot}"]`).tap();
      await page.locator(`[data-level="${level}"]`).tap();
      await expect(page.locator('#map > rect').first()).toBeVisible();
      const path = (await page.locator('#battle-route').boundingBox())!;
      expect(path.width).toBeGreaterThan(844 * 0.8);
      await openPause(page);
      await page.locator('#saveProgress').tap();
      const before = await page.evaluate(
        (slot) => JSON.parse(localStorage.getItem(`infernalDefense.save.${slot}`)!).state.defense.mobileLayout,
        slot,
      );
      expect(before.width / before.height).toBeCloseTo(844 / 390);
      await page.locator('#resumeBattle').tap();
      await page.screenshot({
        path: test.info().outputPath(`${level}-mobile.png`),
        style: '.toast { visibility: hidden; }',
      });
      await page.reload();
      await page.locator('[data-open="saves"]').tap();
      await page.locator(`[data-load="${slot}"]`).tap();
      await page.locator('#journeyResume').tap();
      const after = await page.evaluate(
        (slot) => JSON.parse(localStorage.getItem(`infernalDefense.save.${slot}`)!).state.defense.mobileLayout,
        slot,
      );
      expect(after).toEqual(before);
      await openPause(page);
      await page.locator('#returnMenu').tap();
      await page.locator('#journeyExit').tap();
    }
  } finally {
    await context.close();
  }
});
