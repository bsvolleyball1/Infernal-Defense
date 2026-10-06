# Release and verification

Use Node.js 24. Install the exact lockfile with `npm ci`. For a local release check:

```sh
npm exec playwright install chromium
npm run typecheck
npm test
npm run test:browser
npm run build
npm run preview
```

Playwright builds and starts its own production preview at `http://127.0.0.1:4173/Infernal-Defense/`. Stop an existing preview on that port before running it. Vitest and Playwright fail if their expected test suites are absent; do not suppress that failure for a release. Typechecking includes tests. Browser tests live in `tests/browser/`, `tests/e2e/`, or `tests/playwright/` with `.spec.ts` names, or use `.browser.spec.ts`/`.e2e.spec.ts` names. Unit `.test.ts`/`.spec.ts` files run through Vitest outside those browser locations.

Inspect `dist/manifest.webmanifest` and `dist/sw.js`: manifest id, start URL, and scope must be `/Infernal-Defense/`; icons must exist at the declared URLs; worker precache must contain the emitted local fonts and application assets. There must be no remote font/media requests. The generated icons are deterministic within the locked Sharp toolchain; run the generator twice and compare hashes if changing the SVG or generator.

Production preview must use the same base as the build. Request an emitted `/Infernal-Defense/assets/*.js` URL and confirm a JavaScript content type and actual JavaScript body; a 200 response containing the HTML shell is a failed asset check. Check CSS and font asset responses as well before interpreting browser or offline failures.

## Offline, installation, and update checks

1. Open production preview online in a clean Chromium profile and wait for the actual offline-ready message. Check for a registered worker, successful caches, and no console errors.
2. Switch browser networking offline and reload `/Infernal-Defense/`. Exercise the menu and a saved journey, including local fonts. Confirm status reports offline. A first-ever offline visit is unsupported.
3. Restore connectivity. Confirm there is no in-app Install button and the app does not cancel the browser's installation event. On Android, install through the browser's Install app/Add to Home screen menu. On iPhone/iPad, use Safari Share → Add to Home Screen. Confirm standalone launch, any orientation, and the Apple touch icon on physical devices; emulated browser tests do not verify native browser menu installation.
4. For update testing, keep the first build open during a running wave, change an owned application asset, and build/serve the second version. Trigger a browser worker update check or return to the foreground. Confirm the running wave continues with an automatic-update waiting notice. Native waiting-worker detection supports rapid consecutive builds without relying on Workbox's heuristic.
5. Pause the battle with storage writes blocked: the update must report save failure without activating or reloading. Restore storage, successfully save, and confirm automatic activation/reload without an update-button click. Load the saved journey and verify exact state retention. Release a third version while in the menu and confirm it applies automatically. Separately verify that activation in another tab cannot reload a running or unsaved current tab. Hidden tabs must wait until foreground return and a successful save.
6. Verify blocked storage, unsupported audio, muted settings, and tab hide/return do not crash gameplay. Audio must unlock from a real user gesture and use one context for music/effects.

The worker lifecycle retains controlled activation, but the app automatically authorizes updates at saved, safe checkpoints. Worker checks run at launch, focus/foreground return, reconnection, and once per minute while visible and online. Existing installed copies running the old prompt-based client need one last Update now to receive this new behavior. Browser update timing and installation availability vary by platform; validate the finished production app and save callbacks rather than assuming configuration alone proves these interactions.

## Runtime and persistence checks

For the expanded ruleset, check initial three eggs and five-second level countdown; manual early summoning must grant 10 mana per remaining rounded-up second, while timer-expiry summoning grants none. Exercise all three spells with touch and keyboard targeting, all upgrade trees using banked gold, and a restored paused countdown. Block writes during a permanent purchase and confirm both ranks and banked gold remain unchanged. Test Mode must never change any campaign slot, award banked rewards/discoveries, or steal eggs. Existing v2 battles retain original rules until their next level. Repeat the expanded offline/physical-phone checks with charges, effects, spell impacts and the PRNG state in the save.

On a fresh launch, verify levels cannot be played before creating/loading a player. Create Save Slot 1 and inspect an inactive journey checkpoint before choosing any level. Play a level, return to its hub, and confirm all level cards are locked with Continue battle available. Reload and use Continue journey; verify banked gold, cleared markers, and the exact current attempt remain. Finish one level and start a different level in the same slot, confirming no additional level-specific storage keys and no duplicate rewards. Explicitly end an attempt only after confirmation. Block writes during player creation, level selection, and abandonment: the previous save and selected journey must remain intact. Check another player slot retains independent progress.

The style-importing entry point is `src/main.ts`; application wiring is `src/app/application.ts`; the fixed 60-step runtime, autosave, and lifecycle handling are in `src/app/runtime.ts`. Check that a backgrounded or restored battle remains paused, visible return resets the clock, and no hidden time is simulated. Foreground gaps admit at most 250 milliseconds per frame; the runtime does not replay the entire time away.

During a foreground battle, observe a periodic save on the first eligible animation frame after the `2000` millisecond threshold. It is independent of simulation speed. Confirm command/event/manual saves occur before that threshold where applicable. Reload a version 2 battle containing live enemies, projectiles, effects, cooldowns, queued spawns, and carried/dropped eggs; compare the restored state, allowing the intentional paused flag. Reopen finished results and confirm rewards are not added twice.

Read malformed and unsupported-version slots without overwriting them. Load a valid version 1 checkpoint, confirm its checkpoint semantics, and verify the application's version 2 write after loading. Force quota/security write failures and confirm honest errors, retained prior data, blocked return-home and Result Continue when saving fails, and no update activation on a failed guard. Load the same slot in two tabs, advance it in the newer tab, then background the older tab; its stale save must be rejected and newer progress retained. Settings and bestiary have independent keys; verify their failures do not claim successful persistence. Browser-local storage has no automatic multi-tab merging or cloud backup, and a two-second scheduling threshold does not guarantee a write before abrupt termination. These are release limits, not reasons to clear player data.

## GitHub Actions and Pages

`Verify` runs on pull requests and pushes for `main` and `Dev---Davin`: clean install, typecheck, Vitest, Chromium installation, Playwright, and build. Failed jobs retain browser reports for seven days. Make the verification check required in branch protection if appropriate.

`Deploy GitHub Pages` runs on pushes to `main` and manual dispatch. Its build job rejects any ref other than `refs/heads/main`, repeats the checks, then uploads `dist/`. Only the deployment job has Pages-write and OIDC permissions. Deployments are serialized. Development-branch pushes and PRs do not deploy.

When publication is separately authorized, select **GitHub Actions** as the repository's Settings → Pages build source and allow the `github-pages` environment to deploy `main`. The expected project URL is `https://bsvolleyball1.github.io/Infernal-Defense/`. Review the Pages deployment result and repeat the production smoke/offline checks there. Adding the workflow locally does not publish; pushing `main` can trigger publication once Pages is configured.

Rollback by reverting the release commit on `main`, checking it, and letting the same workflow deploy the replacement. An installed app may retain the prior cached version until its next online worker check and safe checkpoint; running waves and failed saves defer updates. Old prompt-based clients still require explicit acceptance of their transition update. Do not delete browser storage or unregister workers as a normal release step; saves are local and clearing site data removes them.

The canonical blueprint and roadmap under `docs/` include future work. Release notes must describe verified current behavior and must not promise the full planned roster, stage count, upgrades, or new gameplay features merely because they appear in those documents.
