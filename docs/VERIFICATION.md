# PWA refactor verification

Verified locally on October 6, 2026, on `Dev---Davin`, using Node.js 24 and the locked npm dependencies. The current browser suite used CI's two-worker setting with retries disabled.

## Automated results

- Strict TypeScript checking passed, including application code, tests, and configurations.
- 310 unit tests passed: the previous 255 simulation/storage/architecture/geometry/update/journey checks plus 55 expanded gameplay and compatibility checks.
- 40 Chromium browser tests passed against the production build at `/Infernal-Defense/`: the previous 31 regressions plus nine expanded checks for all permanent upgrade nodes, failed-purchase preservation, restored countdown/early bonus, portrait/landscape sandbox isolation, three keyboard-operable spells, and expanded offline cold launch.
- Production build passed and emitted the manifest, generated service worker, local fonts, artwork, and normal/maskable/Apple PNG icons.
- Browser requests stayed on the application origin; offline font loading and offline cold launch were verified.
- Git whitespace checking passed.

Simulation checks cover egg carrying, dropping, recovery and escape; combat and effects; original resource formulas; speed-scaled timers; pause behavior; and snapshot continuation matching uninterrupted simulation. Storage checks cover version 1 migration, version 2 validation and references, independent slots, settings and bestiary, completed rewards, malformed data, and quota/security failures.

The CLEAN refactor additionally compares every command event, simulation event, and full snapshot across 4,000 steps at each supported speed against original-game digests. Architecture checks guard pure-domain imports, browser/audio/storage isolation, deterministic randomness, runtime import cycles, and the runtime's engine interface. Storage retains stable failure codes and user-facing errors. All five approved groups from main at `b01e5b5` are now ported behind a new optional ruleset, leaving old battles on original rules. See `ARCHITECTURE.md` and `UPSTREAM_PORT.md` for responsibilities and compatibility.

Expanded checks cover all six dragon attack levels, enemy resistances/abilities, spell cost/cooldowns, mana, upgrades, finite-data sandbox policy, source v1 checkpoints, invalid expanded fields, snapshot isolation, durable defeat/results, and exact save continuation at every speed with carrier/dropped egg/projectile/effect/tower cooldown/future spawn/delayed impact/PRNG state. Manual early summoning intentionally retains its rounded-up remaining-seconds mana bonus; automatic timer expiry cannot award an extra bonus from floating-point residue. Restored countdowns require Resume, and browser regressions now explicitly exercise that lifecycle. Test Mode screenshots were reviewed in portrait and landscape.

Browser checks cover placement, upgrading and selling; keyboard input and persistent SVG nodes; real touch input in emulated phone contexts at 320×640, 375×812 and 844×390; exact battle restore; background pause without catch-up; completed rewards without duplicate payouts; preserved corrupt saves; honest save failures; stale background tabs retaining newer progress; Result Continue staying open after failed persistence; manifest/icon URLs; offline cold launch and subsequent play; and real automatic waiting-worker updates. The update test serves three asset revisions, verifies a running wave is not interrupted, blocks automatic activation when pausing cannot save, retries after a successful save without an update-button click, restores the paused battle, then applies a further update automatically from the menu with exact saved-state retention. Unit policy tests additionally cover hidden/running-state deferral, reentrant save callbacks, duplicate native/Workbox events, asynchronous activation failures, state changes during activation, and independent save guards before reload following another tab's activation.

Portrait and landscape screenshots were visually reviewed. Landscape uses a visible battlefield with independently scrolling side controls. Pause covers the battlefield while leaving Save, Menu and speed controls available.

Player-journey checks verify a persisted player exists before level selection, startup Continue chooses a saved journey, and loading opens that player's level hub. One active attempt locks all other levels, including before the first wave. Browser tests complete a level, retain multiple cleared levels, banked gold and discoveries in the same slot, start another level, and restore it after reload. Explicit abandonment requires confirmation; failed creation, level selection or abandonment preserves the previous saved state. Domain tests also cover independent players, idempotent completion records, conservative legacy imports and invalid journey metadata without overwriting unreadable saves. Idle and active journey hubs were visually reviewed at desktop and portrait sizes.

Installation regression checks at 1400×950, 375×812, and 844×390 confirm no in-app Install button or custom install-help element, a cancelable `beforeinstallprompt` event is not canceled by the app, and the standalone manifest, repository start URL, and 512-pixel icon remain present. Native browser menu installation still requires physical Android/iPhone checks; these tests verify application behavior and eligibility assets, not browser chrome.

The two additional levels are Willow Bend (five placements, one simple meadow trail) and Obsidian Fork (ten placements, two routes that split and rejoin). Automated checks cover every placement slot, deterministic alternating spawns, route-specific combat and egg relationships, shared-segment recovery, escape, invalid routes, five-roost save compatibility, and exact continuation at all speeds. Existing battles retain original balance; new levels use the approved expanded source balance. Desktop, portrait, and landscape map/screenshots have been visually reviewed.

## Service-worker synchronization and automatic-only updates

The October 6 CI diagnosis found tests asserting `activated` immediately while the worker was still `activating`. Browser tests now share bounded 15-second polling for the actual registration state; offline and update tests also reload online and wait for an activated controller before continuing. Two regression tests simulate missing/activating registrations and uncontrolled/activating pages to verify both waits retry correctly. No fixed sleeps or weakened activation checks are used for worker readiness.

The update regression also accepts the current journey-save error wording. All update/retry buttons and toast action plumbing have been removed. The three-version browser scenario verifies failed saving defers updates, reconnection retries automatically with a fresh save guard, and paused progress survives subsequent updates without any update-button interaction. Successful saves, visible/online periodic checks and foreground/reconnection events can retry; hidden tabs and running waves remain protected. GitHub verification of this fix requires publishing the local changes and a new workflow run.

## Remaining release checks

No physical phone was available for this implementation run. Real Android Chrome and iPhone Safari installation, standalone launch, orientation changes, audio, backgrounding, and offline operation remain pending. Follow `RELEASE.md` on physical devices after HTTPS deployment.

GitHub Actions and Pages deployment files are included in the project. Development-branch pushes run verification only; production deployment remains a separate release action. No merge to `main`, Pages deployment, or repository Pages settings change was performed during this implementation.

Saves are device/browser/origin-local. A killed browser process can miss its last lifecycle save and lose recent progress since the latest successful autosave; denied or full storage prevents persistence. Slot revision checks reject stale writes, but there is no cloud synchronization, automatic multi-tab merging, or atomic cross-tab lock in this milestone.
