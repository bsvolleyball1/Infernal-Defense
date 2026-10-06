# Infernal Defense

A browser tower defense game about protecting a dragon nest. The app uses TypeScript, Vite, local fonts, synthesized Web Audio, and an automatically updating PWA for offline play.

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

Install through your browser's Install app/Add to Home screen menu. There is no in-app Install button, and browser installation prompts are not intercepted. On iPhone/iPad, use Safari → Share → Add to Home Screen. Offline play requires one successful online production visit and completed service-worker caching. Updates apply automatically after successfully saving, in menus, between waves, or while paused. Running waves and hidden tabs are not interrupted. Save failures postpone the update; the next successful save retries it automatically. There are no Update now or Retry update buttons. Update checks and safe retries run on launch, foreground return, reconnection, and every minute while visible and online. Existing installations of the older prompt-based build need one last Update now to receive the automatic-update behavior. Browser-local saves remain specific to the device, browser, and origin; they are not cloud backups.

Three save slots represent three independent players, not three levels. Startup offers Continue journey and Player saves. Create or load a player first, then choose levels inside that journey. Each save retains cleared levels, banked gold, discoveries, and one exact active battle. Return to the journey hub to continue that battle; other levels remain unavailable until it finishes or you explicitly end the attempt. Ending an attempt keeps player progress but discards its towers, wave progress, and unbanked battle gold. New players and level changes are committed only after saving succeeds.

Version 2 saves keep the battle snapshot and optional journey metadata; older saves import their current level/result without inventing prior completion history. Active foreground battles attempt autosave at a two-second threshold and save on commands, important engine events, manual Save, and background/navigation actions. Loaded battles resume paused; time spent away is not simulated. Frame delays, abrupt termination, or storage failures can prevent the latest save. Invalid slots are preserved for attention rather than silently reset. Version 1 saves retain checkpoint semantics. See Architecture for the precise triggers and limits.

The source SVG at `public/icons/sigil.svg` is the deterministic geometric icon source. Builds generate normal and maskable 192/512 PNGs and an Apple 180 PNG using Sharp. Fonts come from `@fontsource/dm-sans`, `@fontsource/dm-mono`, and `@fontsource/uncial-antiqua`, imported locally by the application. Runtime assets require no external font or media services.

Read [Architecture](docs/ARCHITECTURE.md) for service contracts and [Release](docs/RELEASE.md) for verification, Pages setup, and offline/update checks. [Game Blueprint](docs/GAME_BLUEPRINT.md) and [Build Roadmap](docs/BUILD_ROADMAP.md) are the canonical design documents. They describe future plans as well as design goals; their full roster, stage counts, and upgrade plans are not a claim of implemented gameplay. Root copies and `INFERNAL_DEFENSE_REFERENCE.md` are historical references.

CI verifies PRs and pushes targeting `main` and `Dev---Davin`. The Pages workflow deploys only `main` pushes or manual runs on `main`. Creating these workflows does not publish the current working tree.
