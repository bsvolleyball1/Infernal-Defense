import { test, expect, type Page } from '@playwright/test';
import { clickMapAt } from './map';

async function journey(page: Page): Promise<void> {
  await page.goto('./');
  await page.locator('[data-open="saves"]').click();
  await page.locator('[data-new="0"]').click();
  await page.locator('[data-level="level1"]').click();
}

for (const viewport of [
  { width: 568, height: 320 },
  { width: 844, height: 390 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
]) {
  test(`edge-to-edge terrain and clear touch bounds at ${viewport.width}x${viewport.height}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, hasTouch: true });
    try {
      const page = await context.newPage();
      await page.goto('./');
      await page.locator('#startTestMode').tap();
      await expect(page.locator('#map')).toBeVisible();
      await expect(page.locator('[data-type="fire"] .price')).toBeVisible();
      await expect.poll(() => page.locator('#map').getAttribute('viewBox')).not.toBe('0 0 700 430');
      for (const selector of ['#map', '#battleScenery', '.battlefield']) {
        expect(await page.locator(selector).boundingBox()).toEqual({ x: 0, y: 0, ...viewport });
      }
      // The actual terrain, not just a scenery extension, matches the device frame.
      const terrain = (await page.locator('#map > rect').first().boundingBox())!;
      expect(terrain.x).toBeCloseTo(0);
      expect(terrain.y).toBeCloseTo(0);
      expect(terrain.width).toBeCloseTo(viewport.width);
      expect(terrain.height).toBeCloseTo(viewport.height);
      const scale = await page.locator('#map').evaluate((map: SVGSVGElement) => {
        const matrix = map.getScreenCTM()!;
        return { x: matrix.a, y: matrix.d };
      });
      expect(scale.x).toBeCloseTo(scale.y);
      for (const selector of ['.tower', '[data-spell]', '#pause', '#speed', '#start']) {
        for (const control of await page.locator(selector).all()) {
          const box = await control.boundingBox();
          expect(box!.width).toBeGreaterThanOrEqual(44);
          expect(box!.height).toBeGreaterThanOrEqual(44);
          if (selector === '.tower' || selector === '[data-spell]') {
            expect(box!.y).toBeGreaterThan(viewport.height - 70);
          } else {
            expect(box!.y).toBeLessThan(30);
          }
        }
      }
      const status = (await page.locator('#battleStatus').boundingBox())!;
      const controls = (await page.locator('#battleMiddle').boundingBox())!;
      const spells = (await page.locator('#battleSpells').boundingBox())!;
      const dragons = (await page.locator('#battleDragons').boundingBox())!;
      expect(status.y).toBeLessThan(30);
      expect(status.x + status.width).toBe(viewport.width - 8);
      expect(controls.x + controls.width).toBeLessThan(status.x);
      expect(spells.x).toBe(8);
      expect(dragons.x + dragons.width).toBe(viewport.width - 8);
      expect(spells.x + spells.width).toBeLessThan(dragons.x);
      // Every open placement cell must remain visible and receive its own tap, even beside the HUD.
      const blockedCells = await page.locator('#map').evaluate((map: SVGSVGElement) => {
        const matrix = map.getScreenCTM()!;
        return Array.from(map.querySelectorAll<SVGRectElement>('.tower-grid-cell:not(.blocked)')).filter((cell) => {
          const box = cell.getBBox();
          const point = new DOMPoint(box.x + box.width / 2, box.y + box.height / 2).matrixTransform(matrix);
          return !document.elementFromPoint(point.x, point.y)?.closest('#map');
        }).length;
      });
      expect(blockedCells).toBe(0);
      await page.locator('[data-type="fire"]').tap();
      await clickMapAt(page, 75, 225);
      await expect(page.locator('#towers .tower-marker')).toHaveCount(1);
      await page.locator('#upgrade').tap();
      await page.locator('[data-upgrade-color="blue"]').tap();
      await expect(page.locator('#towers .tower-marker')).toHaveAttribute('aria-label', /Purple/);
      await page.locator('#pause').tap();
      await expect(page.locator('#pauseOverlay')).toBeVisible();
      await page.locator('[data-test-count="imp"]').fill('0');
      await page.locator('[data-test-count="witch"]').fill('2');
      await page.locator('#resumeBattle').tap();
      await page.locator('#start').tap();
      await expect(page.locator('#enemies')).toContainText('Witch');
      await page.screenshot({ path: test.info().outputPath('landscape.png') });
      expect(
        await page
          .locator('button')
          .filter({ hasText: /fullscreen|rotate|orientation/i })
          .count(),
      ).toBe(0);
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
        ),
      ).toBe(false);
    } finally {
      await context.close();
    }
  });
}

test('portrait blocks menus and shortcuts, then pauses and saves an interrupted countdown', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  try {
    const page = await context.newPage();
    await page.goto('./');
    await expect(page.locator('.orientation-gate')).toBeVisible();
    await expect(page.locator('#app')).toHaveAttribute('inert', '');
    await page.keyboard.press('Escape');
    await expect(page.locator('.orientation-card')).toBeFocused();
    await page.setViewportSize({ width: 844, height: 390 });
    await journey(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.orientation-gate')).toBeVisible();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('infernalDefense.save.0')!).state);
    expect(saved.paused).toBe(true);
    await page.waitForTimeout(600);
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.locator('#pauseOverlay')).toBeVisible();
    await page.locator('#saveProgress').click();
    const returned = await page.evaluate(() => JSON.parse(localStorage.getItem('infernalDefense.save.0')!).state);
    expect(returned.defense.countdown).toBe(saved.defense.countdown);
    expect(returned.simulationTime).toBe(saved.simulationTime);
    await page.locator('#resumeBattle').click();
    await page.locator('#start').click();
    await expect(page.locator('#waveNum')).toHaveText('1 / 5');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.orientation-gate')).toBeVisible();
    const battle = await page.evaluate(() => JSON.parse(localStorage.getItem('infernalDefense.save.0')!).state);
    expect(battle.paused).toBe(true);
    await page.waitForTimeout(300);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.locator('#saveProgress').click();
    expect(
      await page.evaluate(() => JSON.parse(localStorage.getItem('infernalDefense.save.0')!).state.simulationTime),
    ).toBe(battle.simulationTime);
  } finally {
    await context.close();
  }
});

test('installed presentation requests a fixed lock and tolerates rejection without a fullscreen action', async ({
  browser,
}) => {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
  try {
    await context.addInitScript(() => {
      const original = window.matchMedia.bind(window);
      window.matchMedia = (query) => {
        const media = original(query);
        if (query.includes('display-mode: fullscreen')) Object.defineProperty(media, 'matches', { value: true });
        return media;
      };
      Object.defineProperty(screen.orientation, 'lock', {
        value: async (mode: string) => {
          sessionStorage.setItem('requestedOrientation', mode);
          throw new DOMException('Unsupported', 'NotSupportedError');
        },
      });
      Element.prototype.requestFullscreen = () => {
        throw new Error('Fullscreen must come from app launch');
      };
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('./');
    await expect
      .poll(() => page.evaluate(() => sessionStorage.getItem('requestedOrientation')))
      .toBe('landscape-primary');
    await page.locator('#startTestMode').tap();
    await page.locator('#pause').tap();
    await expect(page.getByRole('button', { name: /fullscreen|rotation|orientation/i })).toHaveCount(0);
    expect(errors).toEqual([]);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.orientation-gate')).toBeVisible();
  } finally {
    await context.close();
  }
});

test('cutout bounds and touch coordinates remain correct after a landscape resize', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
  try {
    const page = await context.newPage();
    await page.goto('./');
    await page.locator('#startTestMode').tap();
    await page.addStyleTag({ content: ':root { --safe-left: 44px; --safe-right: 44px; --safe-bottom: 20px; }' });
    await page.setViewportSize({ width: 667, height: 375 });
    await expect.poll(async () => (await page.locator('#battleSpells').boundingBox())!.x).toBe(44);
    const dragons = await page.locator('#battleDragons').boundingBox();
    expect(dragons!.x + dragons!.width).toBeLessThanOrEqual(623);
    const position = await page.locator('#map').evaluate((map: SVGSVGElement) => {
      const point = new DOMPoint(675, 375).matrixTransform(map.getScreenCTM()!);
      return { x: point.x, y: point.y };
    });
    await page.locator('[data-type="ice"]').tap();
    await page.touchscreen.tap(position.x, position.y);
    await expect(page.locator('#towers .tower-marker')).toHaveAttribute('transform', 'translate(675 375)');
    await page.locator('#upgrade').tap();
    const popup = await page.locator('.actions').boundingBox();
    expect(popup!.x).toBeGreaterThanOrEqual(44);
    expect(popup!.x + popup!.width).toBeLessThanOrEqual(623);
    expect(popup!.y).toBeGreaterThanOrEqual(60);
    expect(popup!.y + popup!.height).toBeLessThanOrEqual(355);
    await page.locator('[data-upgrade-color="blue"]').tap();
    await page.locator('#pause').tap();
    await page.screenshot({ path: test.info().outputPath('pause-panel.png') });
  } finally {
    await context.close();
  }
});
