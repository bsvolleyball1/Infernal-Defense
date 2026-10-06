# Architecture

Infernal Defense uses Vite and TypeScript. `src/main.ts` imports local Fontsource CSS and the UI styles, then calls `startApplication()` from `src/app/application.ts`. Application orchestration mounts the template, creates the engine, renderer, save repository, and shared audio service, connects controls and engine events, and initializes the runtime and PWA. Presentation lives in `src/ui/`, simulation in `src/game/`, and content definitions in `src/content/catalog.ts`. PWA and audio adapters do not add gameplay rules or write save data themselves.

## CLEAN code boundaries

The behavior-preserving CLEAN refactor keeps the engine as a small coordinator and splits domain responsibilities:

- `src/game/commands.ts`: command guards, placement, upgrading, and selling.
- `src/game/combat.ts`: targeting, cooldowns, projectiles, and effect application.
- `src/game/eggs.ts`: egg relationships and enemy path movement.
- `src/game/waves.ts`: spawn schedules, admission limits, and wave completion.
- `src/game/rewards.ts`: discovery, kill rewards, terminal state, and one-time payouts.
- `src/game/state.ts`: state creation and independent snapshot copies.
- `src/game/rules.ts`: named original balance values and shared economy/combat formulas. Rendering uses the same range and upgrade-cost helpers as commands/combat.

These modules only operate on engine-owned plain state and events. None import DOM, storage, audio, app, or framework services. Runtime depends on the `SimulationEngine` interface, not the concrete `GameEngine`. The public `createInitialState` export from `engine.ts` remains available for existing callers.

`src/ui/mount.ts` owns shell mounting; `menus.ts` owns typed menu routes, save cards, bestiary and settings views; `controls.ts` translates touch/keyboard input into commands. Control binding returns a disposer for its event listeners and resize observer. Application orchestration owns navigation/save decisions and service wiring, not enemy movement or SVG control construction.

Storage accepts a minimal `KeyValueStorage` interface. Write failures have stable codes (`conflict`, `quota`, `blocked`, `failure`) alongside user-facing messages; navigation does not infer error meaning by parsing message text. Save schema version, stored values, key namespace, and migration semantics remain unchanged.

`tests/architecture.test.ts` guards domain dependency boundaries, browser-global isolation, deterministic randomness, absence of runtime import cycles, and runtime's interface dependency. `tests/refactor-regression.test.ts` compares complete states/events against pre-refactor traces over 4,000 steps at each speed. The traces protect existing balance, ordering, IDs, event sequence, pause, upgrades, and restoration; targeted simulation/storage tests remain the readable behavioral specification.

TypeScript also rejects unused locals and parameters. Favor descriptive names, focused functions, explicit typed results, and shared rules over duplicated formulas. Keep dependencies pointing toward domain contracts; introduce an abstraction only when it serves a real responsibility or a concrete extension, not a speculative future framework.

This cleanup does not port the reviewed `dev-1.0` content or change its pending balance/save-policy choices. `docs/todo.md` remains the integration review. Add new combat rules behind the domain boundaries without copying upstream wall-clock timers or monolithic HTML.

## Runtime and lifecycle

`src/app/runtime.ts` owns `requestAnimationFrame`, the fixed `1000 / 60` millisecond step, autosave scheduling, and browser lifecycle listeners. The runtime accumulates foreground elapsed time only while the battlefield is visible, the document is visible, and an unpaused battle is active. Each frame admits at most 250 milliseconds of elapsed time; it calls `engine.step(step)` for each complete step and retains the remainder. The engine applies the selected 1×/1.5×/2× speed to simulation time. Rendering runs when the battlefield and document are visible, including paused/result states.

Hidden or inactive frames clear accumulated time. `visibilitychange` to hidden and `pagehide` pause the engine, attempt a save, suspend audio through the application callback, and reset the clock. Returning to visibility resets the clock and renders; `pageshow` also resets it. Neither path advances missed time or automatically resumes a battle. An explicit player action resumes gameplay/audio. `startRuntime()` returns a disposer that cancels its animation frame and removes its lifecycle listeners.

## Persistence and save semantics

`src/services/storage.ts` exposes `SaveRepository` over injected synchronous `getItem`/`setItem` storage. The application injects `localStorage`. Three zero-based slots use `infernalDefense.save.0` through `.2`; settings and discovered monsters use separate `infernalDefense.settings` and `infernalDefense.bestiary` keys.

The stored schema is `SaveDataV2`:

```ts
interface SaveDataV2 {
  version: 2;
  savedAt: number; // Date.now() at the successful write attempt
  state: GameState; // engine.snapshot()
}
```

The snapshot copies all simulation fields: phase/pause/speed/time, active level, gold and banked rewards, wave and counters, reward-applied flag, selections, tower levels/cooldowns, enemies and effects, projectiles, eggs and carrier references, queued spawns, known monsters, and the next entity id. A version 2 load restores the latest successfully saved battle point rather than reconstructing a wave from counters. The engine restores the snapshot exactly; the application deliberately pauses a loaded battle until the player resumes. Renderer animations, wall-clock time spent away, audio context, and menu/result-dialog visibility are not part of the simulation snapshot.

Phases are `ready`, `battle`, `won`, and `lost`. Ready saves cannot contain active combat; battle saves require a started wave. Terminal saves contain no live enemies, projectiles, or queued spawns and require `rewardsApplied: true`. Won requires the fifth wave and at least one surviving egg; lost requires no surviving eggs. `rewardGold`, `bankedGold`, and the applied flag persist together in the snapshot so loading results does not award the same reward again.

Autosave uses an exact `2000` millisecond threshold on animation-frame timestamps during an active foreground battle. It attempts a save on the first eligible frame at or after that threshold and resets the timestamp, even if the write fails. This is a two-second scheduling threshold, not a hard durability guarantee: browser frame delays, process termination, blocked storage, or quota errors can prevent the latest progress from reaching storage. Paused/menu/hidden frames reset the autosave timestamp, and simulation speed does not change the threshold.

The application also attempts immediate saves after player game commands, on engine `save`/`result`/`discovery` events, when creating a journey or launching a level, on manual Save, when leaving a journey for the menu, after loading a migrated save, when continuing from results, and on background/page-hide lifecycle events. Discovery writes the separate bestiary as well. Settings changes write their own key immediately. Event saves and command saves may occur in the same action; they do not defer persistence until the periodic autosave. Before applying an app update, the application pauses, renders if visible, and passes the actual save result to the PWA guard. No active slot requires no journey write and returns success. Returning home and continuing from results are blocked when their journey save fails.

Menu navigation hides the battlefield without adding elapsed time to the simulation. Returning home pauses and saves the current journey before clearing the active slot. Continue restores the selected slot, pauses an active battle, and shows its pause overlay. Starting a replacement journey in an occupied valid slot, or replacing a battle with a new level, uses the application's confirmation flow. Result Continue saves before showing banked rewards; result-dialog dismissal itself is UI state and can be shown again after loading. The game does not run catch-up steps after two seconds in the background or any longer absence.

Reads distinguish empty slots, valid saves, and errors. Version 2 validation checks finite/ranged values, supported levels/kinds/speeds, exactly five perches and eggs, unique entity ids, consistent egg/carrier and projectile references, ordered spawns, and phase/reward invariants. Writes validate the snapshot and its serialized JSON before calling `setItem`, then return an explicit success/error result. Corrupt, incompatible, or unreadable saves remain stored and appear as attention-needed slots; the UI does not offer an overwrite button for them. A new journey in a valid occupied slot requires the existing replacement confirmation. Settings and bestiary read failures fall back to defaults/empty values without repairing the stored input automatically.

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
  beforeUpdate: () => saveCurrentJourneySuccessfully(),
  onMessage: (text) => showMessage(text),
});
```

Call once after the UI supplies `#pwaPanel`. `initPwa` returns `void`; its callbacks are required. The panel receives native accessible buttons, a polite status region, installation guidance, and update controls. A missing panel is reported through `onMessage` and initialization can be retried after mounting it. Native `beforeinstallprompt` is prevented and deferred until the install button is activated; unsupported prompt environments receive browser-menu guidance, including Safari instructions on iOS/iPadOS. Standalone installs hide install controls.

The service imports `registerSW` from `virtual:pwa-register`. Production registration uses `onNeedRefresh` to display Update now/Later and `onOfflineReady` to announce completed offline preparation. A mere online connection or registration does not claim successful caching. Registration, installation, update checks, and explicit activation failures notify the user. Development disables service-worker registration; test offline behavior in production preview.

Updates remain waiting with `registerType: 'prompt'`, `skipWaiting: false`, and `clientsClaim: false`. Update now calls the synchronous `beforeUpdate` guard; only a literal `true` permits `updateSW(true)` to activate and reload. A false result or exception leaves the current game open. The caller must actually persist the current journey before returning true, or return true if there is no active journey requiring persistence. Later collapses the prompt while retaining the Update available button for reopening it. The `onNeedReload` callback also prevents another app tab from authorizing this tab's reload; the current tab must pass its own save guard. There is no automatic update activation during a battle.

Installation guidance begins collapsed. The compact status and install/update buttons live together in a child `div` for the UI's panel styling. Error notices clear back to compact status after eight seconds. On subsequent visits, registration's activated worker confirms precache installation only after its script URL and scope match this app; initial offline preparation is still announced through `onOfflineReady`.

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

`docs/GAME_BLUEPRINT.md` and `docs/BUILD_ROADMAP.md` are the canonical design and future-work references. Preserve their intentional mechanics and distinguish planned features from implemented behavior. Root design copies and the combined project reference are historical. This tooling migration does not expand the playable roster, stage count, spells, resources, or progression systems.
