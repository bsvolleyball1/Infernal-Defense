# PWA refactor verification

Verified locally on October 5, 2026, on `Dev---Davin`, using Node.js 24 and the locked npm dependencies.

## Automated results

- Strict TypeScript checking passed, including application code, tests, and configurations.
- 198 unit tests passed: 37 simulation tests, 150 storage tests, 3 pre-refactor trace regressions, and 8 architecture/control checks.
- 13 Chromium browser tests passed against the production build at `/Infernal-Defense/`.
- Production build passed and emitted the manifest, generated service worker, local fonts, artwork, and normal/maskable/Apple PNG icons.
- Browser requests stayed on the application origin; offline font loading and offline cold launch were verified.
- Git whitespace checking passed.

Simulation checks cover egg carrying, dropping, recovery and escape; combat and effects; original resource formulas; speed-scaled timers; pause behavior; and snapshot continuation matching uninterrupted simulation. Storage checks cover version 1 migration, version 2 validation and references, independent slots, settings and bestiary, completed rewards, malformed data, and quota/security failures.

The CLEAN refactor additionally compares every command event, simulation event, and full snapshot across 4,000 steps at each supported speed against digests captured before extracting the domain modules. Architecture checks guard pure-domain imports, browser/audio/storage isolation, deterministic randomness, runtime import cycles, and the runtime's engine interface. Storage failure codes replace message parsing without changing saved JSON or player-facing error text. See `ARCHITECTURE.md` for the module responsibilities. The reviewed `dev-1.0` gameplay updates remain unported.

Browser checks cover placement, upgrading and selling; keyboard input and persistent SVG nodes; real touch input in emulated phone contexts at 320×640, 375×812 and 844×390; exact battle restore; background pause without catch-up; completed rewards without duplicate payouts; preserved corrupt saves; honest save failures; stale background tabs retaining newer progress; Result Continue staying open after failed persistence; manifest/icon URLs; offline cold launch and subsequent play; and a real waiting-worker update. The update test serves two asset revisions, verifies Later keeps the first version open, prevents activation when saving fails, then verifies restoration after an accepted update.

Portrait and landscape screenshots were visually reviewed. Landscape uses a visible battlefield with independently scrolling side controls. Pause covers the battlefield while leaving Save, Menu and speed controls available.

## Remaining release checks

No physical phone was available for this implementation run. Real Android Chrome and iPhone Safari installation, standalone launch, orientation changes, audio, backgrounding, and offline operation remain pending. Follow `RELEASE.md` on physical devices after HTTPS deployment.

GitHub Actions and Pages deployment files are included in the project. Development-branch pushes run verification only; production deployment remains a separate release action. No merge to `main`, Pages deployment, or repository Pages settings change was performed during this implementation.

Saves are device/browser/origin-local. A killed browser process can miss its last lifecycle save and lose recent progress since the latest successful autosave; denied or full storage prevents persistence. Slot revision checks reject stale writes, but there is no cloud synchronization, automatic multi-tab merging, or atomic cross-tab lock in this milestone.
