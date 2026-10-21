import { expect, test, type Page } from '@playwright/test';
import { getMap } from '../../src/content/catalog';
import { createDefenseState } from '../../src/game/defense-state';
import { createEnemy } from '../../src/game/enemy-factory';
import type { GameState, Point } from '../../src/game/types';
import { clickMapAt } from './map';

async function screenPoint(page: Page, point: Point): Promise<Point> {
  return page.locator('#map').evaluate((map: SVGSVGElement, point) => {
    const result = new DOMPoint(point.x, point.y).matrixTransform(map.getScreenCTM()!);
    return { x: result.x, y: result.y };
  }, point);
}

async function savedState(page: Page): Promise<GameState> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('infernalDefense.save.0')!).state);
}

async function beginDrag(page: Page, selector: string, target: Point, touch = false): Promise<() => Promise<void>> {
  const bounds = (await page.locator(selector).boundingBox())!;
  const start = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  if (touch) {
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...start, id: 1 }] });
    for (let step = 1; step <= 8; step++) {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          { x: start.x + ((target.x - start.x) * step) / 8, y: start.y + ((target.y - start.y) * step) / 8, id: 1 },
        ],
      });
    }
    return async () => {
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await session.detach();
    };
  }
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 8 });
  return () => page.mouse.up();
}

test.use({ hasTouch: true, viewport: { width: 844, height: 390 } });

for (const touch of [false, true]) {
  test(`${touch ? 'touch' : 'mouse'} drags place dragons accurately after resizing and retain tap placement`, async ({
    page,
  }) => {
    await page.goto('./');
    await page.locator('[data-open="saves"]').click();
    await page.locator('[data-new="0"]').click();
    await page.locator('[data-level="level1"]').click();
    await page.evaluate(() => {
      const save = JSON.parse(localStorage.getItem('infernalDefense.save.0')!);
      save.state.gold = 1000;
      save.state.defense.countdown = null;
      localStorage.setItem('infernalDefense.save.0', JSON.stringify(save));
    });
    await page.reload();
    await page.locator('#continueJourney').click();
    await page.locator('#journeyResume').click();
    if (await page.locator('#pauseOverlay').isVisible()) await page.locator('#resumeBattle').click();
    const state = await savedState(page);
    const map = getMap(state.activeLevel, state.defense?.ruleset, state.defense?.mobileLayout);
    const point = map.perches[0];
    const end = await beginDrag(page, '[data-type="fire"]', await screenPoint(page, point), touch);
    await expect(page.locator('.placement-preview')).toHaveAttribute('visibility', 'visible');
    await expect(page.locator('.placement-preview')).toHaveAttribute('transform', `translate(${point.x} ${point.y})`);
    if (touch) await page.screenshot({ path: test.info().outputPath('touch-dragon-drag.png') });
    await end();
    await expect(page.locator('#towers .tower-marker')).toHaveCount(1);
    expect((await savedState(page)).towers.filter(Boolean)[0]?.position).toEqual(point);
    await expect(page.locator('.battlefield-drag-ghost')).toHaveCount(0);

    // An occupied cell and a HUD drop must not buy a dragon or trigger a HUD button.
    for (const target of [await screenPoint(page, point), { x: 30, y: 30 }]) {
      const cancel = await beginDrag(page, '[data-type="ice"]', target, touch);
      await cancel();
      await expect(page.locator('#towers .tower-marker')).toHaveCount(1);
      await expect(page.locator('#pauseOverlay')).not.toBeVisible();
    }
    await page.setViewportSize({ width: 1024, height: 600 });
    const second = map.perches[2];
    const release = await beginDrag(page, '[data-type="poison"]', await screenPoint(page, second), touch);
    await release();
    await expect(page.locator('#towers .tower-marker')).toHaveCount(2);
    expect((await savedState(page)).towers.filter(Boolean)[1]?.position).toEqual(second);
    await page.locator('[data-type="ice"]').click();
    await clickMapAt(page, map.perches[4].x, map.perches[4].y);
    await expect(page.locator('#towers .tower-marker')).toHaveCount(3);
  });
}

for (const spell of ['fire', 'poison', 'ice'] as const) {
  test(`dragging ${spell} casts once on release and cancels over controls`, async ({ page }) => {
    const state = createDefenseState();
    state.phase = 'battle';
    state.wave = 1;
    state.defense.mana = 200;
    state.enemies = [createEnemy(state, 'demon', 1000, 0.1, 1)];
    state.enemiesSummoned = 1;
    await page.goto('./');
    await page.evaluate(
      (state) =>
        localStorage.setItem(
          'infernalDefense.save.0',
          JSON.stringify({
            version: 2,
            savedAt: 1,
            state,
            journey: { activeBattle: true, completedLevels: [] },
          }),
        ),
      state,
    );
    await page.reload();
    await page.locator('#continueJourney').click();
    await page.locator('#journeyResume').click();
    await page.locator('#resumeBattle').click();
    const cancel = await beginDrag(page, `[data-spell="${spell}"]`, { x: 30, y: 30 }, true);
    await cancel();
    await expect(page.locator(`[data-spell="${spell}"]`)).toBeEnabled();
    const point = { x: 350, y: 215 };
    const end = await beginDrag(page, `[data-spell="${spell}"]`, await screenPoint(page, point), true);
    await expect(page.locator('.battlefield-drag-ghost')).toHaveCount(1);
    await end();
    await expect(page.locator(`[data-spell="${spell}"]`)).toBeDisabled();
    await expect(page.locator('.battlefield-drag-ghost')).toHaveCount(0);
    const after = await savedState(page);
    expect(after.defense?.spellCooldowns[spell]).toBeGreaterThan(0);
    expect(after.defense?.targeting).toBeNull();
    if (spell === 'ice') expect(after.enemies[0].frozen).toBeGreaterThan(0);
    else {
      expect(after.defense?.visuals).toHaveLength(1);
      expect(after.defense?.visuals[0].x).toBeCloseTo(point.x);
      expect(after.defense?.visuals[0].y).toBeCloseTo(point.y);
    }
  });
}

test('Escape and pointer cancellation clear the drag without placement or pausing', async ({ page }) => {
  await page.goto('./');
  await page.locator('#startTestMode').click();
  const release = await beginDrag(page, '[data-type="fire"]', { x: 420, y: 190 });
  await page.keyboard.press('Escape');
  await release();
  await expect(page.locator('.battlefield-drag-ghost')).toHaveCount(0);
  await expect(page.locator('#towers .tower-marker')).toHaveCount(0);
  await expect(page.locator('#pauseOverlay')).not.toBeVisible();
  await beginDrag(page, '[data-type="ice"]', { x: 420, y: 190 });
  await page.locator('[data-type="ice"]').evaluate((source) => {
    source.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, bubbles: true }));
  });
  await page.mouse.up();
  await expect(page.locator('.battlefield-drag-ghost')).toHaveCount(0);
  await expect(page.locator('#towers .tower-marker')).toHaveCount(0);
});
