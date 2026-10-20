import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: [
    '**/browser/**/*.spec.ts',
    '**/e2e/**/*.spec.ts',
    '**/playwright/**/*.spec.ts',
    '**/*.browser.spec.ts',
    '**/*.e2e.spec.ts',
    '**/browser.spec.ts',
  ],
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // Keep local verification aligned with CI and avoid saturating animated battle pages.
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173/Infernal-Defense/',
    // Recording a trace for every test is costly here: battle pages render every frame, so each trace
    // carries a screencast and large DOM snapshots. Under parallel workers that made heavy tests time out.
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    serviceWorkers: 'allow',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173',
    url: 'http://127.0.0.1:4173/Infernal-Defense/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
