import { test, expect } from '@playwright/test';
import { waitForServiceWorkerActivation } from './service-worker';

for (const viewport of [{ width: 1400, height: 950 }, { width: 375, height: 812 }, { width: 844, height: 390 }]) {
  test(`browser-native installation is not intercepted at ${viewport.width}x${viewport.height}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, hasTouch: viewport.width < 1000 });
    try {
      const page = await context.newPage(); await page.goto('./');
      await waitForServiceWorkerActivation(page);
      await expect(page.locator('#pwaPanel')).toHaveCount(0);
      await expect(page.getByRole('button', { name: /install|installation/i })).toHaveCount(0);
      await expect(page.locator('#pwa-install-help')).toHaveCount(0);
      await expect(page.getByRole('button', { name: /retry update|update now/i })).toHaveCount(0);
      await expect(page.locator('#toast button')).toHaveCount(0);
      const nativeEvent = await page.evaluate(() => {
        const event = new Event('beforeinstallprompt', { cancelable: true });
        return { allowed: window.dispatchEvent(event), prevented: event.defaultPrevented };
      });
      expect(nativeEvent).toEqual({ allowed: true, prevented: false });
      const manifest = await page.evaluate(async () => {
        const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!;
        return (await fetch(link.href)).json();
      });
      expect(manifest.display).toBe('standalone');
      expect(manifest.start_url).toBe('/Infernal-Defense/');
      expect(manifest.icons.some((icon: { sizes: string }) => icon.sizes === '512x512')).toBe(true);
    } finally { await context.close(); }
  });
}
