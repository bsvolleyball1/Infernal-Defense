import { test, expect } from '@playwright/test';

test('Dragon Roost groups the catalog by tier', async ({ page }) => {
  await page.goto('./');
  await page.locator('[data-open="towerary"]').click();

  const tiers = page.locator('#toweraryContent .towerary-tier');
  await expect(tiers).toHaveCount(3);
  for (const [tier, count] of [
    [1, 3],
    [2, 6],
    [3, 13],
  ]) {
    const tierSection = page.locator(`#toweraryContent [data-tier="${tier}"]`);
    await expect(tierSection.locator('h3')).toHaveText(`Tier ${tier} · ${count} dragons`);
    await expect(tierSection.locator('.towerary-card')).toHaveCount(count);
  }
  await expect(page.locator('#toweraryContent .towerary-card')).toHaveCount(22);
});
