import { test, expect } from '@playwright/test';
import { waitForServiceWorkerActivation, waitForServiceWorkerControl } from './service-worker';

test('activation wait retries missing and activating registrations', async ({ page }) => {
  await page.evaluate(() => {
    let reads = 0;
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: {
      getRegistration: async () => {
        reads++;
        if (reads === 1) return undefined;
        return { active: { state: reads < 4 ? 'activating' : 'activated' } };
      },
    } });
  });
  await waitForServiceWorkerActivation(page);
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.state)).toBe('activated');
});

test('control wait retries uncontrolled and activating pages', async ({ page }) => {
  await page.evaluate(() => {
    let reads = 0;
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: {
      get controller() {
        reads++;
        if (reads === 1) return null;
        return { state: reads < 4 ? 'activating' : 'activated' };
      },
    } });
  });
  await waitForServiceWorkerControl(page);
  expect(await page.evaluate(() => navigator.serviceWorker.controller?.state)).toBe('activated');
});
