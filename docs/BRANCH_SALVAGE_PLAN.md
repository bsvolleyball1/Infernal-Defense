# Plan to preserve the upgrade branch features in DevD

Preserve all feature ideas from `bsvolleyball1-upgrade-buttons-above-tower` through separate, tested implementation phases based on `DevD`. Adapt the source ideas to the current architecture. Keep each phase reviewable and promote the completed work to `main` only after the release checks pass.

Implementation status on October 20, 2026: phases 0 through 7 have been implemented locally from DevD. The separate release to main remains pending. [Implementation and verification](UPGRADE_FEATURES.md) records the delivered behavior and test evidence.

## Scope and baseline

The user selected **all feature ideas, implemented in separate phases** on October 20, 2026.

| Reference | Revision | Role |
| --- | --- | --- |
| `DevD` | `d8a9eae` | Implementation baseline; local and remote heads match |
| Source branch | `87842f5` | Feature reference, updated October 20 |
| Remote `main` | `00a9b6e` | Current release ancestry; two merge commits ahead of DevD, with the same tracked tree |

The source branch is five commits ahead of DevD. Its net diff changes 39 files with 1,075 additions and 142 deletions. Use the pinned source revision when reviewing the ideas; recheck remote heads before implementation.

The earlier comparison in this chat verified 374 passing unit tests and a passing TypeScript check on DevD. The source branch had two TypeScript errors, 10 failing tests out of 400, and a browser startup exception caused by missing `#upgradeChoices` markup. These results are comparison evidence, not a substitute for the implementation baseline in phase 0.

Preserve Vite and TypeScript, the current module boundaries, existing SVG scenery and retained rendering, full offline play, both orientations, exact battle resume, and GitHub Pages deployment. Retain the existing actionable update retry behavior.

## Features to carry forward

| Feature group | Intended result | Phase |
| --- | --- | --- |
| Placement | A visible 50-by-50 map-unit grid, one tower per valid cell, blocked route cells, snapped previews and placement | 2 |
| Bonus cells | Damage, range, mana, food, and gold bonuses aligned with valid grid cells | 2 |
| Evolution | Red, Blue, and Yellow base dragons; unordered color combinations; 22 named forms across three tiers; alternate form choices | 3 and 4 |
| Combat | Beams, charged attacks, rapid shots, cones, explosions, acid, focus, nullification, tar, earthquake, radius attacks, sniper, and map-wide beams | 4 |
| Controls and art | Upgrade color and form selection, selected-tower actions, a slim toolbar below the map, yellow dragon portraits | 5 |
| Challenges | Blightless, Frostless, and Emberless Fork after the existing three challenges | 6 |
| Balance documentation | Accurate tower and monster balance sheets and updated architecture and verification records | 7 |

## Compatibility and gameplay defaults

The defaults below were adopted during implementation. Existing battles keep their historical rules; new battles use the new profile. Challenge restrictions include upgrade colors, and historical max-level ranks retain their passive bonuses.

1. **Version the battle rules.** Preserve the original legacy rules and current `defense-1` behavior. Add a named new expanded profile, provisionally `defense-2`, for evolution and grid placement. Store the profile in each battle and validate it explicitly. Keep save-envelope schema versioning separate from gameplay rules. Extend the existing tagged model without replacing the application architecture.
2. **Preserve interrupted battles exactly.** Existing towers keep their levels, positions, cooldowns, bonus layout, projectiles, effects, and RNG state. Never snap or recolor an old tower during load. Preserve level-four through level-six expanded towers and higher original legacy towers under their existing rules. The new three-tier cap applies only to the new profile.
3. **Move to new rules at a battle boundary.** When an old battle finishes, the next newly started level may use the new profile, retaining journey progress, permanent ranks, and campaign gold. An existing ready/countdown battle is still an existing battle. Do not reinterpret it when the app updates. Define this transition in the journey controller and state factory, with fixtures.
4. **Keep all phases usable for review.** Implement and test the new profile explicitly while the default state factory continues to create `defense-1` battles. Enable the new default after phases 1 through 6 are complete. A temporary development preview may create the new profile; saved profiles remain authoritative across builds.
5. **Separate base identity from evolved ability.** Keep stable `fire`/`ice`/`poison` identifiers for old saves. A new tower has a base element, colors, a legal form, and ability-specific state. Color order determines the same available forms. As in the source, the starting element initially determines base range, ordinary rank bonuses, and damage resistance classification. Describe that explicitly; equal color combinations can have different starting-element modifiers.
6. **Retain progression value deliberately.** Current expanded battles start with a level cap of three, raised to six by permanent max-level ranks. In the new three-tier profile, disable further max-level purchases, retain historical ranks and their passive rank-total bonuses, and update the copy. Apply the existing extra-charge upgrade to charged forms. Do not silently refund gold, remove ranks, or leave purchases that promise an unreachable tier. A different economy is a separate balance decision.
7. **Define challenge restrictions for evolution.** Recommended: an only-element trial permits only that color, including upgrades; an exclusion trial forbids that color in placement and upgrade contributions. This prevents evolving into the forbidden color. The source mostly restricts the starting type, so this recommendation needs explicit documentation and tests. Preserve existing rules for existing saved challenges.
8. **Use source balance as an initial reference.** Carry the 22 forms and ability ideas forward, with source numbers as starting values. Correct implementation errors and preserve existing upgrade effects. Document any intentional balance changes separately from the port.

## Phase 0 Establish the integration baseline

**Deliverable:** a repeatable green baseline and CI checks for DevD.

- Recheck `git status`, branch heads, remote ancestry, and applicable repository instructions. Preserve the existing local `package-lock.json` modification separately from this work; determine whether it is intentional before dependency installation or staging.
- Work from a `codex/` integration branch based on current DevD. Use focused commits and phase PRs targeting DevD. Preserve the pinned source revision as a reference; carry changes by feature instead of merging its complete tree or cherry-picking its broad commits.
- Run the existing format, lint, TypeScript, unit, browser, and production-build checks. Resolve or document any baseline browser failures before claiming a new regression. The existing `fix/browser-tests` worktree is separate work; inspect its relevance before including any of its changes.
- Update `.github/workflows/ci.yml` so push and pull-request verification includes `DevD` and `main`. Review whether the obsolete `Dev---Davin` trigger is still needed. Keep Pages deployment limited to `main`.

**Acceptance:** baseline results are recorded with the tested SHA; DevD PRs run the intended verification workflow; unrelated lockfile or local-tool changes are excluded from feature commits.

## Phase 1 Add the new profile and save contracts

**Deliverable:** a compatible data model and validation path before new gameplay is enabled.

Primary areas: `src/domain/model.ts`, `src/game/types.ts`, `src/game/ruleset.ts`, `src/game/defense-state.ts`, `src/services/save-schema.ts`, `src/services/defense-validation.ts`, `src/services/migrations/`, and `src/app/journey-controller.ts`.

- Add the new profile identifier and a central lookup for profile-specific caps, placement, combat, and map/bonus variants. Keep `content/` independent of `game/`; put shared vocabulary in `domain/`.
- Give evolved towers a typed representation that supports ability state independently of the base element. Current `FireTower`, `IceTower`, and `PoisonTower` types tie beam and charge fields to the starting type; a hybrid ability must not require unsafe casts or contradictory fields.
- Define validation for color count, legal combinations, selected alternate form, tier consistency, base-color contribution, and profile-appropriate tower fields. Define projectile payloads and temporary enemy-effect timers as serializable data.
- Make map/bonus resolution profile-aware wherever combat, rendering, placement, and validation use it. Keep historical bonus coordinates for old snapshots. Renderer terrain caches must include the profile/map variant, not only `activeLevel`, so loading two profiles on the same level redraws the right terrain.
- Keep old v1/v2 imports and the existing three save slots working. Normalize only genuine historical omissions. Unknown profiles or malformed new evolution data must be reported without overwriting the source save.
- Define battle-boundary transition behavior, keeping journey history, ranks, rewards, campaign gold, and stale-tab protection intact.
- If a user has playable saves from the stale branch, support their untagged evolution shape through a narrowly recognized import path with fixtures. Do not guess a profile for ambiguous snapshots or rewrite their positions.

**Acceptance:** old fixtures retain identical simulation traces; new-profile fixtures round-trip with ability state intact; invalid combinations are rejected; unsupported saves remain recoverable. Ordinary old `{ type: 'upgrade' }` commands still work under old rules.

## Phase 2 Implement grid placement and bonus cells

**Deliverable:** consistent grid behavior in input, simulation, rendering, and persistence.

Primary areas: `src/content/maps.ts`, `src/game/geometry.ts`, `src/game/commands.ts`, `src/game/tower-bonuses.ts`, `src/ui/battlefield-layers.ts`, `src/ui/battlefield-input.ts`, `src/ui/sprite-view-model.ts`, and save validation.

- Adapt the source cell helpers for 50-unit cells. Reject non-finite and out-of-bounds coordinates; make the policy for route-boundary intersections explicit. Block cells touched by any defined route; direct-to-nest monsters do not introduce additional blocked cells.
- Snap pointer and keyboard placement previews and purchases to the same center. Permit one tower per complete, open cell; partial bottom-row cells can be drawn but cannot accept a tower. Keep preview and placement decisions consistent.
- Use one shared pure grid-position policy for purchases and save validation. Check occupied cells in saved tower arrays as well as during purchase. Avoid the source bug where placement succeeds but saving rejects it under old road-clearance rules.
- Keep the legacy free-placement checks and historical perches for old profiles. Ensure compatibility commands cannot bypass grid rules in the new profile.
- Align all five bonus cells to valid grid positions and apply bonuses by cell identity. Verify each map has reachable bonus cells. Preserve historical bonus layouts for old battles.
- Add understated visible grid styling and grid-specific blocked/occupied feedback. Keep summon controls, tower selection, and placement clicks from triggering one another.

**Acceptance:** allowed placement always saves and reloads at the exact center; blocked/occupied cells never spend currency; bonus effects match visible cells; old maps and saved positions are unchanged. Test every selectable map and both fork routes.

## Phase 3 Implement evolution data and commands

**Deliverable:** legal, transactional evolution across all 22 forms.

Primary areas: a new `src/content/dragon-forms.ts`, domain and tower types, `src/game/commands.ts`, progression rules, and permanent upgrades.

- Port the six tier-two combinations and ten tier-three color combinations, including alternate forms. Test all permutations, not only the original and reversed order.
- Use a separate typed evolution command carrying the chosen color and resulting form. Preserve the original upgrade command for original and `defense-1` battles. Reject the wrong command for a profile without charging currency.
- Validate selection, tier cap, challenge rules, affordability, and legal form before mutating anything. Commit colors, form, tier, cost, and ability-state transition together.
- Define upgrade transitions: retain already-fired projectile payloads, clear obsolete beam targets, and initialize new charge/cooldown state according to a documented rule. Avoid accidental unlimited immediate attacks from repeated upgrades.
- Apply the new cap and progression policy from the defaults above. Keep source purchase prices and upgrade/refund formulas initially, unless balance testing identifies a specific change.

**Acceptance:** every legal path produces the intended form; invalid/stale choices leave state and money unchanged; sandbox spends no money; old upgrade commands remain covered; tiers, forms, and ranks restore exactly.

## Phase 4 Implement and verify evolved combat

**Deliverable:** complete form abilities with deterministic timing and accurate upgrades.

Primary areas: new focused combat modules under `src/game/`, `src/game/defense-combat.ts`, `src/game/enemy-abilities.ts`, `src/game/damage.ts`, projectile payloads, and combat view-models. Keep orchestration in the existing simulation and use small ability handlers rather than expanding one large switch indefinitely.

Implement in independently tested groups:

1. Continuous beams, focus, and map-wide beams: target count, range exceptions, DPS, visibility/invulnerability rules, stable beam IDs, and one-time rewards.
2. Charged, rapid, and sniper attacks: charge capacity and recharge, rank-based rate/range bonuses, target loss, and projectile impact behavior. Specify unused-charge handling; do not discard stored charges simply because fewer enemies are available.
3. Cones, explosions, and radius attacks: route-aware positions, cone width and direction, area falloff policy if any, target eligibility, and no duplicate rewards.
4. Acid, tar, earthquake, and nullification: poison timing, slow versus stun, duration refresh/stacking, and resistance behavior. Decrement nullification with simulation time and restore resistance at expiry. Specify whether nullification bypasses only resistance or also other defenses; start with resistance-only behavior and describe it accurately.

For every group, cover damage/range bonus cells, permanent attack/rate/range ranks, extra charges, carrier damage, resistant monsters, ghosts, phantoms, witches, gargoyle death delay, egg carriers, and targets on both fork routes. Capture projectile damage and effects at launch; selling or evolving the source tower must not change the payload in flight. Use the existing seeded RNG and fixed-step clock for all randomness and timers.

**Acceptance:** uninterrupted and save/resumed runs match for every ability family, including active projectiles, partially recharged towers, overlapping effects, and rewarded deaths. Effects respect pause and 1x/1.5x/2x speed. Old combat traces stay unchanged.

## Phase 5 Connect upgrade controls and battle presentation

**Deliverable:** a complete, accessible player interaction and the source visual improvements.

Primary areas: `src/ui/template.html`, `src/ui/controls.ts`, `src/ui/tower-actions.ts`, view-models, `src/ui/defense-effects.ts`, `src/ui/dragon-art.ts`, and battlefield/mobile CSS.

- Add the choice-panel markup before any controller binds to it. Keep choices in a focused controller/view that dispatches commands and gets legal options from a view-model; keep legality in the game rules.
- Reuse DevD's selected-tower popover and viewport positioning. Offer color selection, then alternate-form selection when required, with ability descriptions and cost. Add cancel/Escape, keyboard focus, touch targets, and focus return after success or cancellation.
- Close stale choices when the selected tower changes, is sold, reaches a result, the level changes, or the player exits. Preserve the existing popover dismissal behavior. Open/close alone should not save or spend money.
- Generate displayed form names, tier limits, attack summaries, selected-tower labels, colors, charge counts, and tooltips from the same definitions and effective modifiers used by combat. Avoid mixing new Yellow terminology with old Thorn/Green labels in a new-profile battle.
- Port the three yellow portraits and apply form colors to aura/effects. Use the available base portraits with clear form labels; preserve the current SVG maps and avoid claiming unique portraits for every hybrid. Keep historical-profile labels/art consistent with their old rules.
- Move the toolbar into a slim band below the map while retaining resources, spells, dragon selection, speed, pause, save, and summon access. Verify placement previews cannot cover or activate toolbar controls.

**Acceptance:** startup raises no page errors; all evolution paths can be completed through the browser; choices remain on screen in portrait and landscape; keyboard and touch work; selected tower, effects, and HUD agree on the current form. Test loading old and new profiles on the same map.

## Phase 6 Add the three exclusion challenges

**Deliverable:** six challenges with consistent restrictions and progression.

Primary areas: `src/content/maps.ts`, `src/domain/model.ts`, `src/game/journey.ts`, commands/spells/evolution, menu and battle view-models, and save validation.

- Add Blightless Fork, Frostless Fork, and Emberless Fork after Venom Fork, using the existing two-route layout and sequential unlock behavior.
- Centralize only/exclude policies. Use the same policy for dragon buttons, chosen dragon, placement, spells, spell targeting, evolution options, and saved towers/colors. Do not leave old equality checks in the HUD or schema.
- Preserve the three existing challenges and completed-level records. Make the evolution/color restriction policy explicit in each card and in upgrade choices.
- Test allowed and forbidden dragons, spells, upgrade colors, chosen-but-unplaced dragons, imported saves, and alternate forms on all six challenges.

**Acceptance:** the UI displays usable options; forbidden actions cannot be dispatched or smuggled through a save; legal battles save normally; challenge completion survives reload and unlocks exactly the next challenge.

## Phase 7 Reconcile balance and release through DevD

**Deliverable:** all preserved features enabled for new battles, validated on DevD, then ready for a main release.

- Check that every permanent upgrade has its documented effect on relevant new forms. Confirm the treatment of historical max-level ranks, extra charges, effective attack rate, and mixed-form base identity.
- Reconcile the source `tower-balance.csv` and `monster-balance.csv` with the actual typed definitions and effective formulas. Fix or omit misleading DPS values, including beams and charge recharge limits. Prefer generation from definitions where duplication would otherwise drift.
- Play the tutorial, representative normal levels, and all challenge types. Tune only identified problems and record any intentional departures from source values. Check whether the relocated damage/range bonus cells provide useful path coverage.
- Enable the new profile for newly started battles only after all preceding acceptance checks pass. Retain old-profile resume support and regression fixtures.
- Update `docs/ARCHITECTURE.md`, `docs/VERIFICATION.md`, and the relevant gameplay documentation. Link this implementation track from the current planning index without rewriting historical review findings as pending work.

### Required release evidence

Run the configured format, lint, TypeScript, complete unit, browser, and production-build checks on the final revision. Run the browser suite against the production build under `/Infernal-Defense/`.

Also verify:

- Fresh install and offline cold launch, including the three new bundled portraits.
- Exact resume for legacy, `defense-1`, and the new profile, including original and new temporary effects and RNG state.
- An installed old build updating to the new build while an old battle is saved; preserve the safe-save/update-retry path and all three slots.
- Portrait and landscape, narrow touch layouts, keyboard operation, and the bottom toolbar/popover at viewport edges.
- Journey transition from an old battle into a new-profile level, carried ranks/gold, challenge unlocks, and one-time rewards.
- A profile switch on the same level that redraws terrain, bonuses, and grid correctly.

### Git and deployment sequence

1. Merge verified phase changes into DevD through focused PRs. Keep new gameplay creation on the old default until the combined feature is complete. Stage named product files; exclude unrelated local configuration, reports, and lockfile edits.
2. Validate the final DevD revision with the release evidence above. Recheck live main and DevD heads and reconcile any intervening changes through normal reviewed history.
3. Prepare a DevD-to-main release PR with feature scope, compatibility behavior, and actual verification results. The merge to main is a distinct release action because it triggers Pages deployment; this planning request does not execute it.
4. After an authorized release, confirm the Pages workflow succeeds, open the deployed production URL, and verify launch, new-battle placement/evolution, old-save resume, and offline caching.
5. Prepare rollback as a forward fix or normal revert with save compatibility considered. Once users write new-profile saves, reverting to an old binary can make those saves unreadable. Preserve newer slots and an export/recovery path; do not solve rollback by resetting history or deleting saves.

## Completion checklist

- [x] Phase 0 baseline and DevD CI complete.
- [x] Phase 1 profile, validation, migration, and exact-resume contracts complete.
- [x] Phase 2 grid placement and bonus cells complete.
- [x] Phase 3 all evolution combinations and commands complete.
- [x] Phase 4 all evolved combat families complete.
- [x] Phase 5 upgrade UI, toolbar, and yellow artwork complete.
- [x] Phase 6 exclusion challenges and shared restrictions complete.
- [x] Phase 7 balance, documentation, default activation, and final DevD verification complete.
- [ ] Separate main release completed and deployed behavior verified.

All local feature phases are implemented. Main publication is the remaining release action; no remote branch was changed as part of local implementation.
