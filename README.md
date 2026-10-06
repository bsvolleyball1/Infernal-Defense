# Infernal Defense

A browser tower defense game about protecting a dragon nest. The app uses TypeScript, Vite, local fonts, synthesized Web Audio, and a prompt-to-update PWA for offline play.

Use Node.js 24 and npm. From the repository root:

```sh
npm ci
npm run dev
```

Development runs at `http://127.0.0.1:5173/`. Production builds and previews use `/Infernal-Defense/` for GitHub Pages.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run typecheck` | Strictly check application, tests, and configuration |
| `npm test` | Run Vitest unit tests |
| `npm run test:browser` | Build and run Chromium Playwright tests against production preview |
| `npm run build` | Generate icons, check TypeScript, then produce `dist/` and its service worker |
| `npm run preview` | Serve an existing production build at `http://127.0.0.1:4173/Infernal-Defense/` |

Before the first browser test run, install Chromium with `npm exec playwright install chromium`. CI installs the Linux browser dependencies as well.

Install through the app's install controls or your browser menu. On iPhone/iPad, use Safari → Share → Add to Home Screen. Offline play requires one successful online production visit and completed service-worker caching. Updates offer **Update now** and **Later**; applying an update requires a successful save. Browser-local saves remain specific to the device, browser, and origin; they are not cloud backups.

Three save slots store version 2 simulation snapshots. Active foreground battles attempt autosave at a two-second threshold and save on commands, important engine events, manual Save, and background/navigation actions. Loaded battles resume paused; time spent away is not simulated. Frame delays, abrupt termination, or storage failures can prevent the latest save. Invalid slots are preserved for attention rather than silently reset. Legacy saves migrate as restartable checkpoints. See Architecture for the precise triggers and limits.

The source SVG at `public/icons/sigil.svg` is the deterministic geometric icon source. Builds generate normal and maskable 192/512 PNGs and an Apple 180 PNG using Sharp. Fonts come from `@fontsource/dm-sans`, `@fontsource/dm-mono`, and `@fontsource/uncial-antiqua`, imported locally by the application. Runtime assets require no external font or media services.

Read [Architecture](docs/ARCHITECTURE.md) for service contracts and [Release](docs/RELEASE.md) for verification, Pages setup, and offline/update checks. [Game Blueprint](docs/GAME_BLUEPRINT.md) and [Build Roadmap](docs/BUILD_ROADMAP.md) are the canonical design documents. They describe future plans as well as design goals; their full roster, stage counts, and upgrade plans are not a claim of implemented gameplay. Root copies and `INFERNAL_DEFENSE_REFERENCE.md` are historical references.

CI verifies PRs and pushes targeting `main` and `Dev---Davin`. The Pages workflow deploys only `main` pushes or manual runs on `main`. Creating these workflows does not publish the current working tree.
