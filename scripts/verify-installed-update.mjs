import { chromium, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
if (!process.argv[2]) throw Error('Usage: npm run verify:upgrade -- <baseline project folder containing dist>');
const roots = [
  resolve(process.argv[2], 'dist'),
  fileURLToPath(new URL('../dist/', import.meta.url)).replace(/[\\/]$/, ''),
];
let release = 0;
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, 'http://localhost').pathname;
    if (!path.startsWith('/Infernal-Defense/')) return response.writeHead(404).end();
    const name = decodeURIComponent(path.slice('/Infernal-Defense/'.length)) || 'index.html';
    const target = resolve(roots[release], name);
    if (!target.startsWith(roots[release] + sep)) return response.writeHead(403).end();
    let body = await readFile(target);
    if (name === 'index.html')
      body = body.toString().replace('<html lang="en">', `<html lang="en" data-proof-release="${release}">`);
    const types = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.webmanifest': 'application/manifest+json',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
    };
    response
      .writeHead(200, {
        'Content-Type': types[extname(name)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      })
      .end(body);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const errors = [];
try {
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  const url = `http://127.0.0.1:${server.address().port}/Infernal-Defense/`;
  await page.goto(url);
  await expect
    .poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.state), {
      timeout: 15000,
    })
    .toBe('activated');
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller?.state), { timeout: 15000 })
    .toBe('activated');
  await page.locator('[data-open="saves"]').click();
  await page.locator('[data-new="0"]').click();
  await page.locator('[data-level="level1"]').click();
  await page.locator('[data-type="fire"]').click();
  const point = await page
    .locator('#map')
    .evaluate((svg) => new DOMPoint(90, 202).matrixTransform(svg.getScreenCTM()).toJSON());
  await page.mouse.click(point.x, point.y);
  await page.locator('#pause').click();
  const before = await page.evaluate(() => {
    const raw = localStorage.getItem('infernalDefense.save.0');
    localStorage.setItem('infernalDefense.save.1', raw);
    return JSON.parse(raw).state;
  });
  if (before.defense.ruleset !== 'defense-1' || Math.abs(before.towers[0].position.x - 90) > 1)
    throw Error('Old-build fixture not created');
  release = 1;
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
  await page.waitForFunction(() => document.documentElement.dataset.proofRelease === '1', { timeout: 30000 });
  await page.locator('[data-open="saves"]').click();
  await page.locator('[data-load="0"]').click();
  await page.locator('#journeyResume').click();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('infernalDefense.save.0')).state);
  if (JSON.stringify(after) !== JSON.stringify(before))
    throw Error('Historical battle changed across installed-build update');
  if ((await page.locator('#towerGrid rect').count()) !== 0) throw Error('Old battle was converted to grid');
  await page.locator('#resumeBattle').click();
  await page.locator('#upgrade').click();
  const upgraded = await page.evaluate(() => JSON.parse(localStorage.getItem('infernalDefense.save.0')).state);
  if (upgraded.towers[0].level !== 2 || upgraded.towers[0].evolution) throw Error('Historical upgrade behavior lost');
  await page.locator('#returnMenu').click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#abandonBattle').click();
  await page.locator('[data-level="level1"]').click();
  await page.locator('[data-type="poison"]').click();
  const gridPoint = await page
    .locator('#map')
    .evaluate((svg) => new DOMPoint(75, 225).matrixTransform(svg.getScreenCTM()).toJSON());
  await page.mouse.click(gridPoint.x, gridPoint.y);
  const current = await page.evaluate(() => JSON.parse(localStorage.getItem('infernalDefense.save.0')).state);
  if (current.defense.ruleset !== 'defense-2' || current.towers[0].evolution.form !== 'yellow')
    throw Error('New battle did not use new rules');
  await context.setOffline(true);
  const offline = await context.newPage();
  offline.on('pageerror', (error) => errors.push(error.message));
  await offline.goto(url);
  await offline.locator('[data-open="saves"]').click();
  await offline.locator('[data-load="0"]').click();
  await offline.locator('#journeyResume').click();
  if (!(await offline.locator('#towers .tower-icon').getAttribute('href')).includes('yellow-1'))
    throw Error('New yellow portrait missing offline');
  const backup = await offline.evaluate(() => JSON.parse(localStorage.getItem('infernalDefense.save.1')).state);
  if (JSON.stringify(backup) !== JSON.stringify(before)) throw Error('Unselected slot changed');
  if (errors.length) throw Error(errors.join('\n'));
  console.log(
    JSON.stringify(
      {
        baseline: process.argv[2],
        installedUpdate: true,
        historicalStateExact: true,
        oldUpgradePreserved: true,
        newBattleProfile: current.defense.ruleset,
        offlineColdLaunch: true,
        untouchedSecondSlot: true,
        pageErrors: errors,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.log(
    JSON.stringify({
      errors,
      pages: await Promise.all(
        context.pages().map(async (page) => ({
          url: page.url(),
          worker: await page
            .evaluate(async () => ({
              controller: navigator.serviceWorker.controller?.state,
              active: (await navigator.serviceWorker.getRegistration())?.active?.state,
            }))
            .catch(() => null),
        })),
      ),
    }),
  );
  throw error;
} finally {
  await context.close();
  await browser.close();
  await new Promise((done) => server.close(done));
}
