# PWA refactor verification

Verified locally on October 5, 2026, on `Dev---Davin`, using Node.js 24 and the locked npm dependencies.

## Automated results

- Strict TypeScript checking passed, including application code, tests, and configurations.
- 255 unit tests passed: 37 simulation tests, 150 storage tests, 3 original-geometry trace regressions, 8 architecture/control checks, 4 gorge geometry/save-compatibility tests, 25 selectable-level/branch-route tests, 12 automatic-update policy tests, and 16 player-journey tests.
- 29 Chromium browser tests passed against the production build at `/Infernal-Defense/`, including eighth-roost placement, upgrading, selling, reload, both new levels on portrait/landscape phones, switching all three maps, offline forked-battle restoration, automatic safe-checkpoint updates, browser-native installation behavior, and six player-journey checks.
- Production build passed and emitted the manifest, generated service worker, local fonts, artwork, and normal/maskable/Apple PNG icons.
- Browser requests stayed on the application origin; offline font loading and offline cold launch were verified.
- Git whitespace checking passed.

Simulation checks cover egg carrying, dropping, recovery and escape; combat and effects; original resource formulas; speed-scaled timers; pause behavior; and snapshot continuation matching uninterrupted simulation. Storage checks cover version 1 migration, version 2 validation and references, independent slots, settings and bestiary, completed rewards, malformed data, and quota/security failures.

The CLEAN refactor additionally compares every command event, simulation event, and full snapshot across 4,000 steps at each supported speed against digests captured before extracting the domain modules. Architecture checks guard pure-domain imports, browser/audio/storage isolation, deterministic randomness, runtime import cycles, and the runtime's engine interface. Storage failure codes replace message parsing without changing saved JSON or player-facing error text. See `ARCHITECTURE.md` for the module responsibilities. The reviewed `dev-1.0` gameplay updates remain unported.

Browser checks cover placement, upgrading and selling; keyboard input and persistent SVG nodes; real touch input in emulated phone contexts at 320×640, 375×812 and 844×390; exact battle restore; background pause without catch-up; completed rewards without duplicate payouts; preserved corrupt saves; honest save failures; stale background tabs retaining newer progress; Result Continue staying open after failed persistence; manifest/icon URLs; offline cold launch and subsequent play; and real automatic waiting-worker updates. The update test serves three asset revisions, verifies a running wave is not interrupted, blocks automatic activation when pausing cannot save, retries after a successful save without an update-button click, restores the paused battle, then applies a further update automatically from the menu with exact saved-state retention. Unit policy tests additionally cover hidden/running-state deferral, reentrant save callbacks, duplicate native/Workbox events, asynchronous activation failures, state changes during activation, and independent save guards before reload following another tab's activation.

Portrait and landscape screenshots were visually reviewed. Landscape uses a visible battlefield with independently scrolling side controls. Pause covers the battlefield while leaving Save, Menu and speed controls available.

Player-journey checks verify a persisted player exists before level selection, startup Continue chooses a saved journey, and loading opens that player's level hub. One active attempt locks all other levels, including before the first wave. Browser tests complete a level, retain multiple cleared levels, banked gold and discoveries in the same slot, start another level, and restore it after reload. Explicit abandonment requires confirmation; failed creation, level selection or abandonment preserves the previous saved state. Domain tests also cover independent players, idempotent completion records, conservative legacy imports and invalid journey metadata without overwriting unreadable saves. Idle and active journey hubs were visually reviewed at desktop and portrait sizes.

Installation regression checks at 1400×950, 375×812, and 844×390 confirm no in-app Install button or custom install-help element, a cancelable `beforeinstallprompt` event is not canceled by the app, and the standalone manifest, repository start URL, and 512-pixel icon remain present. Native browser menu installation still requires physical Android/iPhone checks; these tests verify application behavior and eligibility assets, not browser chrome.

The two additional levels are Willow Bend (five placements, one simple meadow trail) and Obsidian Fork (ten placements, two routes that split and rejoin). Automated checks cover every placement slot, deterministic alternating spawns, branch-specific movement/targeting/projectiles, egg pickup and carrier reversal, dropping and same-branch recovery, recovery on shared segments, escape, invalid route preservation, five-roost save compatibility, and exact forked-battle continuation at all speeds. Desktop, portrait, and landscape screenshots of both new environments were visually reviewed. The original wave and dragon balance remains unchanged.

## Remaining release checks

No physical phone was available for this implementation run. Real Android Chrome and iPhone Safari installation, standalone launch, orientation changes, audio, backgrounding, and offline operation remain pending. Follow `RELEASE.md` on physical devices after HTTPS deployment.

GitHub Actions and Pages deployment files are included in the project. Development-branch pushes run verification only; production deployment remains a separate release action. No merge to `main`, Pages deployment, or repository Pages settings change was performed during this implementation.

Saves are device/browser/origin-local. A killed browser process can miss its last lifecycle save and lose recent progress since the latest successful autosave; denied or full storage prevents persistence. Slot revision checks reject stale writes, but there is no cloud synchronization, automatic multi-tab merging, or atomic cross-tab lock in this milestone.
