import { defineConfig, defaultExclude } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

const productionBase = '/Infernal-Defense/';

export default defineConfig(({ command, mode, isPreview }) => ({
  base: command === 'build' || isPreview ? productionBase : '/',
  plugins: mode === 'test' ? [] : [VitePWA({
    strategies: 'generateSW',
    // The app automatically activates at saved, safe checkpoints. Plugin-level
    // autoUpdate would bypass the running-wave and storage-failure guards.
    registerType: 'prompt',
    injectRegister: false,
    includeAssets: ['icons/*.png', 'icons/*.svg', 'licenses/*.txt'],
    manifest: {
      id: productionBase,
      name: 'Infernal Defense',
      short_name: 'Infernal Defense',
      description: 'Defend the dragon nest in Infernal Defense.',
      start_url: productionBase,
      scope: productionBase,
      display: 'standalone',
      orientation: 'any',
      background_color: '#111711',
      theme_color: '#111711',
      icons: [
        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: 'icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
        { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{html,js,css,svg,png,woff,woff2}'],
      cleanupOutdatedCaches: true,
      skipWaiting: false,
      clientsClaim: false,
      navigateFallback: `${productionBase}index.html`,
      navigateFallbackAllowlist: [/^\/Infernal-Defense\//],
      runtimeCaching: [],
    },
    devOptions: { enabled: false },
  })],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: { target: 'es2022', assetsInlineLimit: 0 },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts', 'tests/**/*.{test,spec}.ts'],
    exclude: [...defaultExclude, '**/browser/**', '**/e2e/**', '**/playwright/**', '**/*.browser.*', '**/*.e2e.*', '**/browser.spec.ts'],
  },
}));
