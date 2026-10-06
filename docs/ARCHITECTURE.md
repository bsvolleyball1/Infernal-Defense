# Architecture

Infernal Defense uses Vite and TypeScript. `src/main.ts` imports local Fontsource CSS and the UI styles, then calls `startApplication()` from `src/app/application.ts`. Application orchestration mounts the template, creates the engine, renderer, save repository, and shared audio service, connects controls and engine events, and initializes the runtime and PWA. Presentation lives in `src/ui/`, simulation in `src/game/`, and content definitions in `src/content/catalog.ts`. PWA and audio adapters do not add gameplay rules or write save data themselves.

## CLEAN code boundaries

The behavior-preserving CLEAN refactor keeps the engine as a small coordinator and splits domain responsibilities:

- `src/game/commands.ts`: command guards, placement, upgrading, and selling.
- `src/game/combat.ts`: targeting, cooldowns, projectiles, and effect application.
- `src/game/eggs.ts`: egg relationships and enemy path movement.
- `src/game/geometry.ts`: route interpolation and shared-trail checks; no presentation dependencies.
- `src/game/waves.ts`: spawn schedules, admission limits, and wave completion.
- `src/game/rewards.ts`: discovery, kill rewards, terminal state, and one-time payouts.
- `src/game/state.ts`: state creation and independent snapshot copies.
- `src/game/journey.ts`: player progress, conservative legacy import, and idempotent cleared-level recording. The simulation engine still owns only one battle, not menu navigation or persistence.
- `src/game/rules.ts`: named original balance values and shared economy/combat formulas. Rendering uses the same range and upgrade-cost helpers as commands/combat.

These modules only operate on engine-owned plain state and events. None import DOM, storage, audio, app, or framework services. Runtime depends on the `SimulationEngine` interface, not the concrete `GameEngine`. The public `createInitialState` export from `engine.ts` remains available for existing callers.

`src/ui/mount.ts` owns shell mounting; `menus.ts` owns typed menu routes, save cards, bestiary and settings views; `controls.ts` translates touch/keyboard input into commands. Control binding returns a disposer for its event listeners and resize observer. Application orchestration owns navigation/save decisions and service wiring, not enemy movement or SVG control construction.

Storage accepts a minimal `KeyValueStorage` interface. Write failures have stable codes (`conflict`, `quota`, `blocked`, `failure`) alongside user-facing messages; navigation does not infer error meaning by parsing message text. Save schema version and key namespace remain unchanged; optional expanded fields extend the snapshot while retaining exact-v2 versus checkpoint-v1 semantics.

`tests/architecture.test.ts` guards domain dependency boundaries, browser-global isolation, deterministic randomness, absence of runtime import cycles, and runtime's interface dependency. `tests/refactor-regression.test.ts` compares complete states/events against pre-refactor traces over 4,000 steps at each speed using the original five-roost geometry as an isolated fixture. The traces protect existing combat balance, ordering, IDs, event sequence, pause, upgrades, and restoration; targeted simulation/storage tests remain the readable behavioral specification. The gorge layout is covered separately in `tests/battlefield.test.ts`.

## Battlefield geometry and artwork

Three distinct battlefields are selectable: Emberfall Gorge (eight roosts), Willow Bend (five roosts, one simple meadow trail), and Obsidian Fork (ten roosts, two branching fortress trails). The tutorial remains on the gorge. `src/content/maps.ts` owns typed geometry, names, themes, and descriptions; `catalog.ts` exposes the active map lookup and shared content. Every route retains 16 logical segments; tactical coverage differs by level. Legacy battles retain five eggs and original combat; expanded levels use three to six eggs and the ported roster/attacks.

`src/ui/battlefield.ts` and `themed-battlefield.ts` generate vector scenery directly from these definitions. `battlefield-layers.ts` shares roost, nest, and retained entity layers. `SvgRenderer` rebuilds terrain only when the active level changes, clears its old entity-node caches, and otherwise reuses nodes. Delegated controls work after map changes without rebinding. Transparent touch targets remain at least 44 CSS pixels; overlapping targets select the nearest roost center.

Obsidian Fork has two complete routes with shared entry and exit segments. Spawn schedules alternate route IDs deterministically across groups. Enemies keep their route when reversing with an egg. Dropped eggs retain their route and can be picked up only on that branch or a physically shared portion. Combat, projectiles, enemies, and eggs all resolve positions through the same route-aware geometry. Version 2 saves include `routeId` on forked enemies, carried/dropped eggs, and future spawns. Single-route saves omit this optional field for compatibility; forked saves require valid route IDs and consistent carrier routes. Tower counts and selected bounds derive from the saved level. Willow Bend's five-roost saves are not expanded by legacy gorge migration.

Version 1 five-tower checkpoints and older version 2 five-tower battles expand to eight towers by appending three empty slots. Existing first-five tower data, counters, cooldowns, relationships, and rewards are preserved. Reads do not rewrite storage; loading attempts the normalized save through the usual successful-write guard. Old enemies' logical path progress is interpreted on the new trail; their previous physical locations and tactical coverage are not preserved across the map redesign. Newly saved eight-roost battles restore exactly. Validation and selected-perch bounds derive from the catalog rather than a hard-coded five.

TypeScript also rejects unused locals and parameters. Favor descriptive names, focused functions, explicit typed results, and shared rules over duplicated formulas. Keep dependencies pointing toward domain contracts; introduce an abstraction only when it serves a real responsibility or a concrete extension, not a speculative future framework.

The October 6 port adds all five approved gameplay groups from `main` at `b01e5b5`. `UPSTREAM_PORT.md` records source balance, timing corrections, and compatibility; `todo.md` preserves the earlier historical review. New content uses `enemies.ts`, `dragon-attacks.ts`, `upgrades.ts`, and `defense-rules.ts`. New domain responsibilities are split across `defense-state.ts`, `defense-simulation.ts`, `defense-combat.ts`, `damage.ts`, `enemy-factory.ts`, `enemy-abilities.ts`, and `spells.ts`. Controls/effects and extended save validation remain separate adapters. Battles without `state.defense` execute the original rules; new journeys/levels use `defense-1`, including three to six eggs instead of five.

## Runtime and lifecycle

`src/app/runtime.ts` owns `requestAnimationFrame`, the fixed `1000 / 60` millisecond step, autosave scheduling, and browser lifecycle listeners. The runtime accumulates foreground elapsed time only while battlefield/document are visible and gameplay is unpaused. Expanded ready phases also step mana regeneration and wave countdowns. Each frame admits at most 250 milliseconds of elapsed time; it calls `engine.step(step)` for each complete step and retains the remainder. The engine applies the selected 1×/1.5×/2× speed to simulation time. Rendering runs when the battlefield and document are visible, including paused/result states. Menus still receive idle animation callbacks, but do not simulate; stopping idle callbacks is a possible mobile energy optimization, not an exact-save requirement.

Hidden or inactive frames clear accumulated time. `visibilitychange` to hidden and `pagehide` pause the engine, attempt a save, suspend audio through the application callback, and reset the clock. Returning to visibility resets the clock and renders; `pageshow` also resets it. Neither path advances missed time or automatically resumes a battle. An explicit player action resumes gameplay/audio. `startRuntime()` returns a disposer that cancels its animation frame and removes its lifecycle listeners.

## Persistence and save semantics

`src/services/storage.ts` exposes `SaveRepository` over injected synchronous `getItem`/`setItem` storage. The application injects `localStorage`. Three zero-based slots use `infernalDefense.save.0` through `.2`; settings and discovered monsters use separate `infernalDefense.settings` and `infernalDefense.bestiary` keys.

The stored schema is `SaveDataV2`:

```ts
interface SaveDataV2 {
  version: 2;
  savedAt: number; // Date.now() at the successful write attempt
  state: GameState; // engine.snapshot()
  journey?: JourneyProgress; // optional only for older battle-only saves
}
```

`JourneyProgress` stores `activeBattle: boolean` and unique `completedLevels: Level[]`. A new player is saved before level selection with `activeBattle: false`; its engine snapshot is a dormant ready-state placeholder, not a launched level. Banked gold and discovered kinds remain in the snapshot and carry into each next level; battle gold, towers, eggs, and waves initialize according to the existing balance. There is one snapshot per player, never a snapshot dictionary per level. Settings and the device bestiary remain independent keys; each player's known-monster list is retained across its battles.

Startup shows Continue journey for the most recently saved valid player and Player saves for explicit selection. Creating/loading a slot opens its journey hub with banked gold, completion markers, and a Continue battle/View last result action. Level cards are disabled while an attempt is active, even before its first wave. Returning from the battlefield pauses and saves before opening that same hub; it does not unload the player or require another slot. Home explicitly leaves the selected journey after saving. End current attempt requires confirmation and successfully writes an inactive checkpoint before dropping current battle resources. Starting levels and replacing players also persist their candidate state before changing the active engine, so failed writes leave the previous player/battle intact.

Results clear `activeBattle`; victories add a cleared-level marker through set union without touching the engine's already-applied rewards. Reloading a result cannot duplicate either payout or completion. Older snapshots without journey metadata import ready/battle states as active attempts, and won/lost states as finished attempts; only the saved winning level is recoverable as cleared. Earlier unrecorded victories cannot be reconstructed. Metadata is included on the next successful application save. Compatibility callers that save only a battle retain existing journey metadata.

The snapshot copies all simulation fields: phase/pause/speed/time, active level, gold and banked rewards, wave and counters, reward-applied flag, selections, tower levels/cooldowns, enemies and effects, projectiles, eggs and carrier references, queued spawns, known monsters, and the next entity id. A version 2 load restores the latest successfully saved battle point rather than reconstructing a wave from counters. The engine restores the snapshot exactly; the application deliberately pauses a loaded battle until the player resumes. Renderer animations, wall-clock time spent away, audio context, and menu/result-dialog visibility are not part of the simulation snapshot.

Phases are `ready`, `battle`, `won`, and `lost`. Ready saves cannot contain active combat; battle saves require a started wave. Terminal saves contain no live enemies, projectiles, or queued spawns and require `rewardsApplied: true`. Won requires the fifth wave and at least one surviving egg; lost requires no surviving eggs. `rewardGold`, `bankedGold`, and the applied flag persist together in the snapshot so loading results does not award the same reward again.

Autosave uses an exact `2000` millisecond threshold on animation-frame timestamps during an active foreground battle. It attempts a save on the first eligible frame at or after that threshold and resets the timestamp, even if the write fails. This is a two-second scheduling threshold, not a hard durability guarantee: browser frame delays, process termination, blocked storage, or quota errors can prevent the latest progress from reaching storage. Paused/menu/hidden frames reset the autosave timestamp, and simulation speed does not change the threshold.

The application also attempts immediate saves after player game commands, on engine `save`/`result`/`discovery` events, when creating a journey or launching a level, on manual Save, when leaving a journey for the menu, after loading a migrated save, when continuing from results, and on background/page-hide lifecycle events. Discovery writes the separate bestiary as well. Settings changes write their own key immediately. Event saves and command saves may occur in the same action; they do not defer persistence until the periodic autosave. Before applying an app update, the application pauses, renders if visible, and passes the actual save result to the PWA guard. No active slot requires no journey write and returns success. Returning home and continuing from results are blocked when their journey save fails.

Menu navigation hides the battlefield without adding elapsed time to the simulation. Battlefield Menu opens the selected player's hub after pausing and saving. Loading restores that player's hub, not an independent per-level save; Continue battle then shows the paused battlefield. A new level cannot replace an active attempt. New journey in an occupied slot and End current attempt require explicit confirmation. Result Continue saves before showing banked rewards; the last finished result can be viewed again from the hub. The game does not run catch-up steps after any time away.

Reads distinguish empty slots, valid saves, and errors. Version 2 validation checks finite/ranged values, supported levels/kinds/speeds, level-specific perch counts, ruleset-compatible egg counts, unique IDs, consistent egg/carrier/projectile references, ordered spawns, and phase/reward invariants. Expanded fields additionally validate ranks, charges, beam IDs, effects, spell impacts, countdown and PRNG state. Journey metadata checks supported unique completed levels, recorded victories, inactive terminal states, and no unfinished inactive checkpoint. Writes validate both snapshot and serialized JSON before `setItem` and return explicit results. Unreadable slots stay stored, with no overwrite button. Replacing a valid occupied journey requires confirmation. Settings/bestiary read failures fall back without automatically repairing stored input.

Version 1 migration reads a restartable checkpoint, not an exact battle snapshot. It retains supported checkpoint data, converts carried eggs to dropped eggs without live carriers, resets tower cooldowns, and resumes in ready/won/lost as appropriate. Terminal rewards are not added again. Reading a legacy slot does not rewrite it; application loading attempts a validated version 2 save after restoration. Unsupported versions and invalid legacy fields report errors rather than inventing a compatible battle.

Slot writes compare the current serialized save against the revision this repository last read or wrote. A differing revision rejects a stale tab's save, preserving newer progress, and the application pauses a conflicting battle. Slot previews do not refresh an existing revision baseline. Explicit loading or confirmed replacement uses `readSlot(index, true)` to adopt the freshly read revision. Reload the app and load the newer journey to recover from a conflict. This is optimistic stale-write detection, not an atomic cross-tab lock or automatic progress merging.

Limits: storage is scoped to the device/browser/origin; localhost development, preview on another port, and GitHub Pages have separate saves. Different paths on the same origin use the same storage keys. There is no cloud sync, import/export, history, automatic multi-tab merging, or transaction spanning slot/settings/bestiary keys. Successful writes mean `setItem` completed, not that a cloud backup exists. Abrupt termination may skip lifecycle callbacks; clearing site data, private-session expiry, browser eviction, and storage policy failures can remove or prevent persistence. A failed save leaves the game available but must not be presented as saved or authorize an update reload.

## Build and assets

`npm run build` runs `scripts/generate-icons.mjs`, strict TypeScript checking, then Vite. `tsconfig.json` includes `src`, `tests`, and the Vite/Playwright configuration; tests are typechecked too. Vitest runs unit tests and excludes browser/e2e suites. Playwright runs Chromium against a fresh production build, with service workers enabled and a base URL ending in `/Infernal-Defense/`. Browser tests should use relative navigation, such as `page.goto('./')`, to preserve the production prefix.

Vite serves development at `/`; both production builds and production preview use `/Infernal-Defense/`. Preview must retain the production base so prefixed asset requests return their actual JS/CSS/font files instead of an HTML fallback. Use `import.meta.env.BASE_URL` for application-generated asset URLs and `%BASE_URL%` in HTML. VitePWA injects the generated manifest link; explicit application registration owns the worker lifecycle. The manifest id, start URL, and scope are all `/Infernal-Defense/`, with standalone display and any orientation.

`public/icons/sigil.svg` is an opaque, font-free geometric sigil. Sharp deterministically generates `icon-192.png`, `icon-512.png`, `maskable-192.png`, `maskable-512.png`, and `apple-touch-icon.png`. Maskable artwork stays inside the central safe area. Generated PNGs are retained under `public/` and refreshed during every build.

The application imports Fontsource CSS locally, for example:

```ts
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/dm-mono/400.css';
import '@fontsource/uncial-antiqua/400.css';
```

Font files are emitted rather than inlined so the worker can precache them. The precache includes HTML, JS, CSS, SVG, PNG, WOFF, and WOFF2; there are no remote runtime asset caches. A production build's navigation fallback applies only inside `/Infernal-Defense/`.

## PWA contract

```ts
import { initPwa } from '../services/pwa';
initPwa({
  canAutoUpdate: () => document.visibilityState === 'visible' && !runningWave(),
  beforeUpdate: () => saveCurrentJourneySuccessfully(),
  onMessage: (text) => showMessage(text),
});
```

Call once after mounting the UI. All callbacks are required. `initPwa` returns a `PwaController` with `onJourneySaved` and `checkPendingUpdate`; the application notifies successful saves and checks pending updates when state changes/rendering occurs. Offline/update notices use the shared polite, text-only toast. There is no PWA panel or install/update/retry button. Installation uses the browser's native menu/UI. The app does not intercept or cancel `beforeinstallprompt`; the manifest, service worker, and installation icons remain intact. Safari users install through Share → Add to Home Screen.

The service imports `registerSW` from `virtual:pwa-register`. Production registration uses native waiting-worker detection and `onNeedRefresh` to queue automatic updates, and `onOfflineReady` to announce completed offline preparation. A mere online connection or registration does not claim successful caching. Worker update checks occur on registration, focus/foreground return, reconnection, and every 60 seconds while visible and online. Registration, installation, update checks, and activation failures notify the user. Development disables service-worker registration; test offline behavior in production preview.

The app now owns automatic update policy through the browser-independent `AppUpdates` coordinator in `src/services/app-updates.ts`. `registerType: 'prompt'`, `skipWaiting: false`, and `clientsClaim: false` remain intentionally configured so plugin-level automatic activation cannot bypass game safety. There is no update confirmation or retry button. A waiting update activates automatically only when `canAutoUpdate` permits it (visible menus, between waves, or paused battles) and `beforeUpdate` returns literal `true` after a successful save. Running waves and hidden tabs wait. A failed/throwing guard blocks activation and reload, without repeated per-frame save attempts; a successful later journey save unblocks it. Scheduled online/visible checks, reconnection and foreground return also retry, always rechecking safety and successfully saving before activation or reload.

Activation and reload are separate guarded steps. Before the actual reload, the coordinator rechecks safety and persistence, including when another tab activates the worker or a new wave begins during asynchronous activation. Reentrant successful-save notifications cannot recurse or duplicate activation. Existing cached prompt-based installations need one final Update now to install this new client-side policy; subsequent versions use automatic safe-checkpoint updates.

Offline/update notices use the application's text-only toast and do not require user action. There is no custom install button, installation modal, or user-agent-specific prompt replacement. Save errors also remain on the save screen and cannot be overwritten by background PWA notices. On subsequent visits, registration's activated worker confirms precache installation only after its script URL and scope match this app; initial offline preparation is still announced through `onOfflineReady`.

Native `registration.waiting` and worker state changes also offer updates, so rapid consecutive builds do not rely on Workbox's time heuristic. A guarded `controllerchange` handler handles activation even when Workbox does not emit its normal refresh callback. Every reload remains contingent on the current tab's successful save guard.

## Audio contract

```ts
import { AudioService } from '../services/audio';
const audio = new AudioService();
audio.setSettings({ music: 24, sound: 55, quiet: false });
// Call directly during a user gesture:
void audio.unlock();
audio.play('fire'); // also 'ice' and 'poison'
void audio.suspend();
void audio.resume();
```

Create one shared instance. `unlock`, `suspend`, and `resume` return `Promise<void>`; settings and play return `void`. One lazily created AudioContext serves music and attack effects. Music retains sine oscillators at 110/164.81/220 Hz with gains .11/.06/.025 and master gain `music / 100 * .12`. Effects retain fire/ice/poison frequencies 480/780/300 Hz, triangle/sine/triangle waveforms, starting gain `.035 * sound / 100`, decay to .001 over .08 seconds, and stop at .09 seconds. Effect nodes disconnect when done.

Volumes are percentages clamped to 0–100. Quiet mutes effects only; music remains controlled independently by the music percentage. Playing does not create a context or bypass autoplay restrictions. Visibility and lifecycle handling belong to the caller, which suspends audio when the app is hidden and resumes through explicit visible user gestures. `unlock()` clears the suspension flag when invoked while visible, allowing menu/start actions to restore audio after returning to the app. Neither unlock nor resume creates or resumes audio while hidden. Audio policy failures do not interrupt game logic. No music files or remote audio requests are used.

## Design authority

`docs/GAME_BLUEPRINT.md` and `docs/BUILD_ROADMAP.md` are the canonical design and future-work references. Preserve their intentional mechanics and distinguish planned features from implemented behavior. Root design copies and the combined project reference are historical. The original tooling migration did not expand gameplay. Battlefield work added two stages and branching routes; the October 6 main port adds approved combat, roster, spells, resources, progression, and sandbox features. `UPSTREAM_PORT.md` describes implemented behavior; remaining blueprint/roadmap features are future work.
