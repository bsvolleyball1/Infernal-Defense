import { expect, type Page } from '@playwright/test';

/** Save, Sound and Menu are available inside the pause panel. */
export async function openPause(page: Page): Promise<void> {
  if (!(await page.locator('#pauseOverlay').isVisible())) await page.locator('#pause').click();
  await expect(page.locator('#pauseOverlay')).toBeVisible();
}
