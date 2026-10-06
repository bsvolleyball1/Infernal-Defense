import { expect, type Page } from '@playwright/test';

const workerTimeout = 15_000;

export async function waitForServiceWorkerActivation(page: Page): Promise<void> {
  // An active registration can still be activating. Avoid ready's unbounded promise.
  await expect.poll(() => page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return registration?.active?.state;
  }), { timeout: workerTimeout, message: 'Service worker must finish activation' }).toBe('activated');
}

export async function waitForServiceWorkerControl(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.state), {
    timeout: workerTimeout, message: 'An activated service worker must control the page',
  }).toBe('activated');
}
