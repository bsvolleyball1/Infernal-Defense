import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

test('a real waiting service worker defers updates, blocks failed saves, and restores after activation', async ({ browser }) => {
  let release = 1;
  const root = resolve('dist');
  const server = createServer(async (request, response) => {
    try {
      let name = new URL(request.url!, 'http://localhost').pathname;
      if (!name.startsWith('/Infernal-Defense/')) { response.writeHead(404).end(); return; }
      name = decodeURIComponent(name.slice('/Infernal-Defense/'.length)) || 'index.html';
      const target = resolve(root, name);
      if (!target.startsWith(root + '/') && !target.startsWith(root + '\\')) { response.writeHead(403).end(); return; }
      let body: string | Buffer = await readFile(target);
      if (name === 'index.html') body = body.toString().replace('<html lang="en">', `<html lang="en" data-release="${release}">`);
      if (name === 'sw.js') body = body.toString().replace(/(revision:|"revision":)"([^"]+)"/g, (_match, key, revision) => `${key}"release-${release}-${revision}"`) + `\n// test-release-${release}\n`;
      const types: Record<string, string> = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff' };
      response.writeHead(200, { 'Content-Type': types[extname(name)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(body);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Missing test server address');
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const url = `http://127.0.0.1:${address.port}/Infernal-Defense/`;
    await page.goto(url);
    await expect(page.locator('#pwaPanel')).toContainText(/offline ready|ready to play offline/i);
    // First reload makes the installed worker control this page.
    await page.reload(); await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.locator('[data-open="levels"]').click(); await page.locator('[data-level="level1"]').click(); await page.locator('[data-new="0"]').click();
    await page.locator('#start').click(); await page.locator('#pause').click();
    release = 2;
    await page.evaluate(async () => { const registration = await navigator.serviceWorker.getRegistration(); await registration!.update(); });
    await expect(page.getByRole('button', { name: 'Update now', exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-release', '1');
    await page.getByRole('button', { name: 'Later', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-release', '1');
    await page.getByRole('button', { name: 'Update available', exact: true }).click();
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      (window as unknown as { restoreStorage: () => void }).restoreStorage = () => { Storage.prototype.setItem = original; };
      Storage.prototype.setItem = () => { throw new DOMException('Device storage is full.', 'QuotaExceededError'); };
    });
    await page.getByRole('button', { name: 'Update now', exact: true }).click();
    await expect(page.locator('#pwaPanel')).toContainText('could not be saved');
    await expect(page.locator('html')).toHaveAttribute('data-release', '1');
    await page.evaluate(() => (window as unknown as { restoreStorage: () => void }).restoreStorage());
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('infernalDefense.save.0')!).state);
    await page.getByRole('button', { name: 'Update now', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-release', '2');
    await page.locator('[data-open="saves"]').click(); await page.locator('[data-load="0"]').click();
    await expect(page.locator('#pauseOverlay')).toBeVisible();
    await page.locator('#saveProgress').click();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('infernalDefense.save.0')!).state)).toEqual(before);
  } finally { await context.close(); await new Promise<void>((done, fail) => server.close(error => error ? fail(error) : done())); }
});
