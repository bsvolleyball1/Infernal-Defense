# Dev 1.0 review and integration TODO

## October 6 integration status

The review below is historical: it describes `6053e80`, not current remote heads. All five approved groups from later GitHub `main` revision `b01e5b5` are now implemented in the modular architecture. [Main gameplay port](UPSTREAM_PORT.md) is the current integration record; [Verification](VERIFICATION.md) records acceptance checks and remaining physical-device work.

The unchecked historical items are superseded by explicit speed conversion, simulation timers/PRNG, legacy-rules compatibility, expanded checkpoint import, level-six fire damage, inclusive poison ticks, retained SVG effects, and shared attack profiles. They are not a second pending implementation list.

## Historical review

Reviewed 2026-10-05. This is an assessment, not an implemented merge.

Follow-up: the current branch has now received a behavior-preserving CLEAN refactor. Commands, combat, egg movement, waves, rewards, state copying, UI controls, and menu views have focused modules, shared rules are named, and architecture/trace regression tests enforce the boundaries. The upstream content and balance changes below remain pending. Use these new boundaries for the eventual port; do not reintroduce a monolithic engine or browser-dependent combat.

## Scope and branch identity

The remote has two different branches whose names differ only by case:

- `Dev-1.0`: `7fbf0e6a73d1039c5531aafd0d8f11a42c5970b2`, unchanged from our starting point.
- `dev-1.0`: `6053e80797a18d2eb24a647b1547f812c34a0288`, the new update.

Use the exact commit hash for comparisons on Windows. Do not rename or delete either remote branch as part of this work.

The update is one commit, **Add tutorial enemy and dragon stats**, changing only the original monolithic `index.html` (12 lines added, 12 removed; these are long minified lines). This review compared that commit with both the common base `7fbf0e6` and the modular PWA working tree on `Dev---Davin` at the time of review.

Source: [reviewed commit](https://github.com/bsvolleyball1/Infernal-Defense/commit/6053e80797a18d2eb24a647b1547f812c34a0288).

Do not merge/cherry-pick its HTML directly: our `index.html` is now the Vite bootstrap. Port content and behavior into the modules below while retaining the mobile UI, fixed-step simulation, offline support, and exact saves.

## What changed

### Tutorial content

| Enemy ID | Name | Health | Speed rating | Color |
| --- | --- | ---: | ---: | --- |
| `imp` | Imp | 10 | 5 | `#b75c45` |
| `seaSerpent` | Sea Serpent | 10 | 9 | `#428b91` |
| `demon` | Demon | 100 | 1 | `#693d3b` |

All three have no special ability. Five tutorial waves replace the tutorial's previous reuse of Ashen Pass waves:

1. 6 Imps.
2. 5 Imps, then 3 Sea Serpents.
3. 6 Sea Serpents.
4. 5 Imps, then 2 Demons.
5. 5 Sea Serpents, then 3 Demons.

The original Ashen Pass wave definitions are unchanged. Tutorial descriptions, bestiary entries, and enemy colors are added. Enemy drawings reuse the original SVG body shape; there is no new sprite set or map.

### Dragon combat

These are global changes in the source, **not tutorial-only changes**. Prices, base ranges, upgrade prices, sale refunds, starting gold, and rewards remain unchanged.

| Dragon | Updated behavior |
| --- | --- |
| Red Fire Dragon | L1: one continuous 6 DPS beam. L2: 15 DPS. L3: two beams. L4: three beams. L5: damage every enemy in range. L6: intended 20 DPS, but source currently still applies 15 DPS. |
| Blue Ice Dragon | L1: one stored charge, 15 damage, one charge regenerated per second. L2/L3: capacity 2/3. L4: 20% chance of a 1-second freeze. L5: 25 damage. L6: freeze chance 30%. |
| Green Poison Dragon | Four shots per second. Damage by level: 2, 4, 4, 4, 5, 6. L3: a 5-second poison effect using 1% of maximum health per tick. L4+: a 50% slow for 1 second. |

Upgrading is capped at level 6. The changes closely follow the dragon definitions already described in `docs/GAME_BLUEPRINT.md`; they are a balance/content expansion beyond the earlier architecture-only refactor.

## Prioritized findings

### P1 — Convert enemy speed ratings before using them as movement multipliers

Upstream `index.html:18` assigns tutorial speeds 5, 9, and 1 directly to `spd`. `moveEnemy` at line 29 uses `spd * dt * .0045`, where progress is measured in the 16 path segments, not physical path distance.

Running the actual upstream movement function in an isolated 60 Hz harness, without towers or effects, gives spawn-to-nest times of approximately:

- Imp: **717 ms**.
- Sea Serpent: **400 ms**.
- Demon: **3,567 ms**.

At 2x these become even shorter. The current first-wave raider uses `spd = 0.72`; the tutorial ratings are not on that existing multiplier scale. The blueprint defines ratings from 1 (slowest) to 10 (fastest), not a conversion formula.

- [ ] Keep `speedRating` separate from simulation movement speed.
- [ ] Choose and document a conversion and a target nest-travel time appropriate for a tutorial. Derive a factor from that target rather than inventing one silently.
- [ ] Leave existing Ashen Pass movement values unchanged unless explicitly approving a rebalance.
- [ ] Test the resulting tutorial at 1x, 1.5x, and 2x, including placement and egg recovery.

### P1 — Preserve exact restore when adding charges, effects, and random freeze

Upstream uses `performance.now()` for charge state, wall-clock attack timers, `setTimeout` for spawning, object references for projectiles and beam targets, and `Math.random()` for freeze rolls. Its v1 saves omit charges and combat effects (`index.html:42`). None of those mechanisms can be copied into an exact-restoring deterministic engine.

- [ ] Store ice charges and the remaining regeneration timer as plain simulation data.
- [ ] Represent slow and freeze separately; the current `slow` field implements the original complete movement stop, not the upstream 50% slow.
- [ ] Persist poison duration, remaining tick timer, and tick damage.
- [ ] Capture projectile payloads when fired: damage, freeze probability, poison payload, and slow payload. Do not look up a possibly upgraded tower when a projectile lands.
- [ ] Use a seeded PRNG owned by the engine and serialize its state so resumed freeze outcomes match uninterrupted play.
- [ ] Derive beam render targets by stable IDs or store only IDs; never serialize enemy object references or SVG nodes.
- [ ] Use the existing fixed-step, speed-scaled simulation for all new timers. Upstream ice regeneration and poison shot cadence currently use unscaled wall-clock time while movement and fire DPS use speed-scaled `dt`.

### P1 — Add an explicit compatibility policy before changing combat rules

The current validator only recognizes `scout`, `shield`, `runner`, and `chief`. A v1 slot from the updated source containing discovered tutorial monsters will currently be reported as unreadable, even though its data is legitimate. Also, existing modular saves have no charges, freeze, poison-damage, RNG, or combat-ruleset fields.

- [ ] Extend monster validation and global bestiary retention for all seven IDs before loading updated-source journeys.
- [ ] Add a combat/content ruleset identifier, independent of the save schema version.
- [ ] Recommended: keep existing v2 battles on the original ruleset and use the updated ruleset for newly started journeys. This avoids reinterpreting an interrupted original battle halfway through an app update.
- [ ] Explicitly normalize older v2 states with missing new fields; do not label them corrupt or silently overwrite them.
- [ ] Import updated-source v1 journeys using their existing checkpoint semantics. Charges, projectiles, effects, and RNG cannot be reconstructed because they were not saved.
- [ ] Cover legacy towers above level 6: the original game allowed them. Do not silently clamp already-purchased levels; retain legacy rules for those journeys.
- [ ] Retain the three-slot namespace, unreadable-save preservation, storage-error reporting, stale-tab protection, and one-time rewards.

### P2 — Fix unreachable level-6 fire damage

In upstream `updateTower` (`index.html:22`), the `level >= 5` area-damage branch always subtracts `15 * dt / 1000` and returns. The later `level >= 6 ? 20 : ...` expression cannot run at level 6.

The isolated upstream-function check confirms DPS by level is **6, 15, 15, 15, 15, 15**. The blueprint's level-6 value is 20.

- [ ] Encode per-level attack modes and DPS in typed definitions, with level 6 area damage at 20 DPS.
- [ ] Test damage and target counts at every level, including simultaneous enemy deaths and one-time rewards.

### P2 — Make effect timing and UI descriptions precise

Poison resets its tick timer on each hit. An isolated run of 5 seconds of 250 ms hits produces zero poison-only damage while hits continue. That is consistent with the blueprint's wording **after the last attack**, so it is not classified here as a confirmed gameplay bug.

However, a separate isolated 60 Hz run after the last hit produced four ticks in the 5-second duration, rather than five, due to timer-boundary behavior. Define the intended inclusive/exclusive endpoint and test it explicitly.

- [ ] Document whether poison is deliberately deferred until repeated attacks stop, and the expected tick count over its full duration.
- [ ] Use robust fixed-step tick scheduling so floating-point residue does not drop a scheduled endpoint tick.
- [ ] Define whether ice regeneration runs between waves and whether upgrading increases capacity only or grants charges immediately. Upstream updates towers only during battle but computes elapsed charge time from wall-clock timestamps.
- [ ] Generate names, roles, selected-dragon information, and level descriptions from the same catalog. Upstream selection still says “Heavy firebolt”/“Slows raiders” (`index.html:20`), despite the new beam and probabilistic-freeze behavior.

## Implementation map

| Area | Local destination | Work |
| --- | --- | --- |
| Content | `src/content/catalog.ts` | Tutorial enemy definitions, level-specific wave catalog, speed-rating conversion, per-level dragon attacks, names/descriptions, rulesets. |
| State contracts | `src/game/types.ts` | New monster IDs, ruleset ID, charges/regeneration, separate freeze/slow, poison payload/timers, projectile payloads, seeded RNG state. |
| Combat | `src/game/engine.ts` | Select waves by level/ruleset; beam and area attacks; charged ice; rapid poison; level cap for updated rules; deterministic rolls and simulation timers. |
| Rendering | `src/ui/renderer.ts` | Reused enemy-color nodes, retained beam nodes keyed by tower/target ID, retained area indicators, separate effect indicators, catalog-driven HUD. |
| Menus/controls | `src/ui/template.html`, `src/app/application.ts` | Updated dragon labels and tutorial/bestiary copy; keep native buttons, keyboard selection, 44px touch targets, pause/save behavior. |
| Saves | `src/services/storage.ts` | New-state validation, explicit old-v2 normalization, updated-source v1 import, all seven monster IDs and ruleset-aware level limits. |
| Tests | `tests/engine.test.ts`, `tests/storage.test.ts`, `tests/browser/` | New combat and tutorial cases, exact-restore equivalence, compatibility fixtures, mobile UI, offline and update regression coverage. |
| Documentation | `docs/ARCHITECTURE.md`, `docs/VERIFICATION.md` | Record timer/state contracts, approved speed mapping, ruleset compatibility, and verified behavior. |

The service worker, installation manifest, audio lifecycle, GitHub Pages base path, and deployment workflows do not need to be replaced. New bundled code/content will be precached by the existing build.

## Suggested implementation order

1. Resolve speed conversion, effect timing, and existing-save policy. Confirm that the new dragon rules should apply to both new tutorial and new Ashen Pass journeys, as they do upstream.
2. Add typed content/state, explicit compatibility normalization, and fixtures first. Keep the original engine playable while the new ruleset is introduced.
3. Implement and test the three attack strategies using simulation time. Fix level-6 fire during the port, rather than preserving the unreachable branch.
4. Add the tutorial wave selector and adapted movement values. Verify egg pickup, reversal, drop, recovery, escape, victory, defeat, and rewards with the new enemies.
5. Connect retained SVG beam/area rendering and catalog-driven controls; check portrait, landscape, and keyboard operation.
6. Run the full release checks, including offline exact resume and a two-version update carrying new charges/effects/RNG state.

## Verification performed for this review

- Fetched remote refs and confirmed both case-distinct branches with `git ls-remote --heads origin`.
- Reviewed the complete commit diff and relevant upstream functions against the current modules and canonical blueprint.
- Parsed the updated script successfully with Node's JavaScript parser.
- Executed the actual upstream fire, movement, and poison functions in an isolated Node VM harness; the results above are function-level checks, not full browser playtesting of upstream.
- Re-ran the current branch's TypeScript checks: **pass**.
- Re-ran the current branch's unit tests: **187 passed**.
- During the source-branch review, no application code was modified or merged. The subsequent CLEAN refactor is covered separately in `docs/VERIFICATION.md`; the upstream features themselves remain unported. No new browser/PWA acceptance is claimed for those features. Physical Android/iPhone checks remain pending.
