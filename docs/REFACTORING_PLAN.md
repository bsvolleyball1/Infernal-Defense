# Refactoring Plan: 21 Recommendations in 6 Phases

Baseline (2026-10-15, branch `DevD`): about 4.3k lines of TypeScript under `src/`, with 341 Vitest tests. 337 pass and 4 fail. The 4 failures are in the in-progress `GameSession` and architecture-test work. The architecture is already reasonably layered (`game/` → `content/`, adapters in `services/`, presentation in `ui/`), and `tests/architecture.test.ts` plus `tests/refactor-regression.test.ts` give a good safety net.

The main structural problem is that **two rulesets share one model**. The original rules and `defense-1` both run on one `GameState`, and the code tells them apart with `if (state.defense)` checks. There are roughly 100 such checks across 20 files. Most of the smells below come from that.

**Working rules for every phase**

- Make one named refactoring per commit, with no behavior change. The 4,000-step regression traces must stay byte-identical.
- Run `npm run typecheck && npm test` after every step, and `npm run test:browser` at the end of each phase.
- Separate pure moves (rename, extract, move file) from logic changes so diffs stay reviewable.
- Line references point to `HEAD` (`b347166`). Files that were being edited at the time of writing (`application.ts`, `commands.ts`, `renderer.ts`) are referenced by function name instead.

---

## Phase 1: Safety net and in-flight work

Goal: a green suite, consistent formatting, and architecture rules that test structure rather than text.

### 1. Fix the red tests before moving more code
**Smell:** The new `tests/session.test.ts` has two harness bugs:
- `const { saved, paused } = harness()` destructures **getters**, so it captures `0` once and never sees later increments. This is why "adopts a slot…" and "leaves the previous slot…" fail.
- The "records a cleared level" test commits a `won` state with `{ activeBattle: true, completedLevels: [] }`. `validateSave` correctly rejects that combination ("Finished battles cannot remain active", "Won level must be recorded").

**Technique:** Read the values from the harness object (`h.saved`) instead of destructuring them. Then decide the contract: either `commit` normalizes with `recordJourneyResult` first, or callers must pass a consistent journey. Keep that decision in `GameSession`, not in the test.
**Done when:** all 341 tests pass.

### 2. Add a formatter and lint gate, applied in one formatting-only commit
**Smell:** The code mixes styles. `eggs.ts:19`, `runtime.ts:22-23`, `defense-state.ts` and `renderer.ts:119-122` pack several statements onto one line, while other files are Prettier-like. There is no lint script.

**Technique:** Add Prettier and `typescript-eslint` with `no-non-null-assertion`, `complexity`, `max-lines-per-function` and `max-depth` set as **warnings**. The warnings give a map of hotspots for the later phases. Run the formatter once, in its own commit, and add that commit to `.git-blame-ignore-revs`.
**Done when:** CI runs `lint`, and blame stays useful.

### 3. Assert architecture rules on structure, not text
**Smell:** The new test `holds the composition root … by their contracts` uses `toContain('const engine: SimulationEngine')`. That is a string match, so it breaks on reformatting and passes on a comment.

**Technique:** Reuse the existing AST helper (`dependencies()`/`parse()`) to check declared types. Add the rules that later phases need:
- `content/` must not import from `game/` (see #15).
- `ui/` may import from `game/` only through selectors and view-models (see #17).
- `services/` must not import `ui/`.

**Done when:** the boundary rules are executable and survive the formatter.

---

## Phase 2: Composition root (`src/app/`)

Goal: `startApplication` only wires objects together, and each application policy has one owner.

### 4. Break up `startApplication` into session, navigation and settings controllers
**Smell:** This is a 385-line function with 9 mutable closure variables (`slot`, `journey`, `continueSlot`, `gameVisible`, `showResults`, `saveFailure`, `settings`, `bestiary`, `pwa`) and about 20 inline DOM listeners. Navigation, persistence, the bestiary, settings, test mode and PWA policy all live in the same scope.

**Technique:** *Extract Class* / *Replace Function with Command*. Finish the `GameSession` move already in progress (slot + journey + commit/save). Add:
- `NavigationController`: `navigateToMenu`, `returnHome`, `launchLevel`, `abandonBattle`.
- `BestiaryStore`: merging and persisting the bestiary, which is currently duplicated in `handleEngineEvents` and `loadJourney`.

`startApplication` then becomes a composition root of about 60 lines.
**Done when:** each controller can be unit-tested without the DOM.

### 5. Make one persistence decision per action
**Smell:** `dispatchGameCommand` calls `handleEngineEvents`, which saves on any `save` or `result` event, and then saves again unconditionally. Most commands therefore cause **two** full validate → serialize → validate → `setItem` passes.

**Technique:** *Consolidate Duplicate Conditional Fragments*. Route both ticks and commands through the new `shouldPersist(command, eventsRequestSave)` so that each command or frame triggers at most one write.
**Done when:** a test counts exactly one `setItem` per command.

### 6. Remove the duplicated settings and error-reporting code
**Smell:**
- The sound-toggle label and title logic appears twice, in the click handler and at startup.
- The `const r = repository.writeX(); if (!r.ok) showMessage(r.message)` pattern appears four or more times.
- The same intro sentence is passed to `setText('#saveIntro', …)` in more than one place.

**Technique:** *Extract Function*. Add `renderSoundToggle(settings)` and `reportWrite(result)`, and move the menu copy into constants. Place these in a `SettingsController` next to the controllers from #4.
**Done when:** each of these strings and branches exists once.

---

## Phase 3: Content and rules as data (low risk, mechanical)

Goal: no unexplained numbers in the simulation, and new monsters or upgrades only need content edits. These steps come before the deeper domain work because the regression traces fully cover them.

### 7. Name upgrade-tree nodes instead of indexing them by position
**Smell:** Calls like `rank(state, 'fire', 2)` (placement mana), `rank(state, 'poison', 3)` (ice duration) and `rank(state, 'ice', 4)` (carrier damage) depend silently on the array order in `content/upgrades.ts`. Some cross trees: a poison node controls ice-spell duration. Reordering the content would quietly change balance, and `rankTotal`'s `slice(0, 5)` encodes "the last node is attack power" as an index.

**Technique:** *Replace Magic Literal* / *Introduce Parameter Object*. Give each node an `id` (`'placementMana'`, `'eggReturn'`, `'attackPower'`…) and add `rankOf(state, 'eggReturn')`. Keep the stored rank arrays as they are and map ids to indices in one table, so the save format does not change.
**Done when:** no numeric node index remains outside that mapping table.

### 8. Move inline balance values into `defenseRules`
**Smell:**
- `spells.ts`: radii 100/200, durations 1150/3000/2000, fire damage 25, poison 0.05.
- `defense-combat.ts`: cooldown 1000, interval 250, 0.01 per rank, visual 350.
- `enemy-abilities.ts`: troll regen 0.04, hag heal 0.03, aura 50, summon 5000.
- `defense-state.ts:19-20`: mana 200, 25, 10.
- `towerSummary` uses `4 * (…)` to re-derive the 250 ms interval.
- The battlefield size **700×430** is hardcoded in `commands.ts`, `spells.ts:26-28` and `defense-controls.ts:167,219,223`, even though `Battlefield` already has `width` and `height`.

**Technique:** *Replace Magic Literal* plus *Extract Function*. Add `clampToBattlefield(point, geometry)` and `isInsideBattlefield`, and derive displayed rates from the same rule values.
**Done when:** a grep for numeric literals in `game/*.ts` finds only 0, 1 and documented epsilons.

### 9. Make enemy behavior data-driven
**Smell:**
- `damage.ts:25-34` hardcodes resistances (skeleton, hellhound, fury, devil).
- Witch spell immunity is checked in three places: `damage.ts:25`, `spells.ts:39` and `spells.ts:58`.
- `enemy-abilities.ts` and `eggs.ts` branch on `troll`, `hag`, `necromancer`, `gargoyle`, `ghost`, `lich`, `shade`, `phantom` and `zombieTrain`.

Every new monster means editing several systems, which violates the Open/Closed principle.

**Technique:** *Replace Conditional with Polymorphism*, using data. Give each `enemyRoster` entry a `traits` object (for example `resist: { fire: 0.25 }`, `spellImmune`, `regen`, `healAura`, `summoner`, `deathDelay`, `direct`). Add small ability handlers keyed by trait, run by a single `tickAbilities` loop.
**Done when:** adding a monster with existing traits needs no change under `game/`.

### 10. Fix the content → game dependency direction and split `catalog.ts`
**Smell:**
- `content/*` imports `DragonType`, `MonsterKind` and `Level` from `game/types`, while `game/*` imports content. The two layers depend on each other, and only type-only imports keep this from being a runtime cycle.
- `catalog.ts` mixes five concerns: map lookup, route geometry (`positionAt`), dragon stats, legacy waves and monster names.
- `catalog.ts:24` exports `map = gorge` as a "compatibility default", and `storage.ts` validates against it as an implicit global.

**Technique:** *Move Function* / *Split Module*. Move the vocabulary types into `src/domain/model.ts` (or into `content/`) so dependencies point one way. Move `positionAt` into `game/geometry.ts`, split the dragon, legacy-wave and monster catalogs, and replace the `map` default with explicit geometry parameters.
**Done when:** the architecture test from #3 enforces the new direction.

---

## Phase 4: Domain model and the two rulesets

Goal: the type system knows which ruleset a battle uses, so a battle cannot silently run with the wrong rules.

### 11. Represent each ruleset as an object
**Smell:**
- `GameEngine.step` has two separate pipelines (`engine.ts:36-37`).
- `waves.ts`, `eggs.ts`, `rewards.ts`, `tower-bonuses.ts`, `enemy-factory.ts`, `commands.ts` and `geometry.ts` each branch on `state.defense`.
- `produceTowerBonusResources` has a three-way `journey` / legacy / sandbox switch (`tower-bonuses.ts:49-59`).

**Technique:** *Replace Type Code with Strategy*. Define a `Ruleset` interface with `step`, `createEnemy`, `onEnemyDefeated`, `movementModifier`, `canStartWave`, `currency` and `levelCap`. Implement it as `legacyRuleset` and `defenseRuleset`, and have the engine pick one once, from the state. Shared steps (spawn, move, finish wave) become shared functions that each ruleset calls.
**Done when:** `game/` no longer uses `state.defense` as a type switch.

### 12. Make `GameState` a tagged union
**Smell:** `defense?: DefenseState` is optional, so code inside the defense path still needs non-null assertions:
- `defense-simulation.ts:13`
- `spells.ts:80`
- `defense-state.ts:52` (`randomValue`)
- `application.ts`: `state.defense!.countdown`

**Technique:** *Replace Type Code with Subclasses*, using a TypeScript discriminated union: `type GameState = LegacyBattle | DefenseBattle`, tagged by `ruleset`. Use narrowing helpers such as `isDefense(state): state is DefenseBattle`. Keep the save format the same by mapping at the storage boundary.
**Done when:** `no-non-null-assertion` (#2) has no violations in `game/`.

### 13. Separate entity state by ruleset and dragon type
**Smell:**
- `Enemy` has 14 optional fields (`frozen`, `untargetable`, `summonClock`, `empowered`…) that only exist under `defense-1`.
- `Tower` carries `charges`, `chargeTimer` and `beamIds`, which only some dragon types use.
- `Projectile` has `freezeChance`, `poisonDuration` and `slowDuration`, which are mutually exclusive.

**Technique:** *Extract Class* / *Introduce Special Case*. Split them as follows:
- `Enemy` = core fields + `status: DefenseStatus` (required inside `DefenseBattle`).
- `Tower` = a union discriminated by `type`.
- `Projectile.effect` = `{ kind: 'freeze', chance } | { kind: 'poison', … }`.

**Done when:** no `?? 0` defaults remain on enemy timers in `enemy-abilities.ts` and `damage.ts`.

**Status (branch `refactor/phase-4`):** `Tower` is now `FireTower | IceTower | PoisonTower`. The enemy and projectile parts are **handed off to Phase 6 (#20)**. `defense-validation.ts` accepts `defense-1` saves in which every enemy status field is missing, so the simulation can't treat those fields as required until loading fills them in. To finish this item:
1. Add a pure `normalizeDefenseEntities(state)` to the storage read path that fills each missing enemy status field with the value `createEnemy` uses, and turns a projectile's flat `freezeChance` / `poisonDuration` / `slowDuration` into a single `effect`.
2. Record that change as a schema migration, because it changes the stored shape.
3. Make `DefenseStatus` and `Projectile.effect` required in `game/types.ts`, then remove the `?? 0` defaults.

### 14. Deduplicate the combat pipelines
**Smell:**
- Projectile travel and hit logic exists twice: `combat.ts:77-99` and `defense-combat.ts:123-174`.
- The nearest-target comparator is written twice in `defense-combat.ts` (`84-88` and `132-138`).
- `towerDamageMultiplier(state, index)` is called three times while building one projectile (`combat.ts:65-70`, `defense-combat.ts:111-114`), and each call re-runs a bonus-area scan of every earlier tower. That is O(n²) per shot.

**Technique:** *Extract Function* (`advanceProjectile`, `byDistanceFrom(point)`) and *Split Phase*. Compute a per-tick `TowerContext { position, range, damageMultiplier, bonus }` once for each tower, then attack.
**Done when:** each formula exists once, and the regression traces still match exactly.

### 15. Combine the duplicated placement logic and currency wording
**Smell:**
- `selectPerch` and `placeTower` in `commands.ts` repeat the same steps: challenge check, cost check, gold deduction, ice-charge setup, placement mana and selection reset.
- `state.defense ? 'food' : 'gold'` (and `'🥩' : '✦'`) appears at least 6 times across `commands.ts` and `renderer.ts`.

**Technique:** *Consolidate Duplicate Conditional Fragments* / *Extract Function*. Add `purchaseTower(state, type, position?)` and `currency(state) → { name, icon }`, which the `Ruleset` from #11 provides.
**Done when:** placement behavior and currency wording each have one owner.

---

## Phase 5: Presentation layer (`src/ui/`)

Goal: rendering is a pure function of a view-model, and input is handled in one place.

### 16. Break up `SvgRenderer`
**Smell:** `renderer.ts` is a 452-line class with more than 10 responsibilities: HUD text, tower-action popover positioning, focus management, terrain, the tutorial tree, towers, placement preview, summon control, enemies, projectiles, eggs, range and results. Its constructor also changes the DOM (creates `#actionCost`, rewrites button `innerHTML`) and adds `window` listeners that are never removed.

**Technique:** *Extract Class*. Create `HudView`, `TowerActionsPopover`, `ResultsView`, `TerrainLayer` and a generic `KeyedLayer<T>` that handles the create/update/`prune` cycle now copied for enemies, eggs, shots and towers. Move DOM setup into `mount.ts`, and return a disposer as `bindBattleControls` already does.
**Done when:** `SvgRenderer` composes layers, and no file in `ui/` is over about 200 lines.

### 17. Add a view-model step between the game state and the renderer
**Smell:**
- `renderHud` builds UI text with four-level nested ternaries over `phase`/`paused`/`activeLevel` (`renderer.ts:144-147`).
- `'Sell dragon · 50% refund'` and `${state.wave} / 5` hardcode values that come from rules (`saleFraction`, the wave count).
- The renderer calls domain functions directly (`towerBonus`, `defenseRange`, `levelCap`).

**Technique:** *Split Phase*. Add pure `presentBattle(state): BattleViewModel` and `presentTower(state, i)` functions that unit tests can check without a DOM. The views then only bind the view-model to the DOM.
**Done when:** HUD and label text has unit tests, and `ui/*View.ts` files import no `game/` code except types.

### 18. Put the markup in the template instead of patching it in at runtime
**Smell:**
- There are 20 `innerHTML` assignments in `ui/`.
- `mountDefenseControls` inserts the stats, spells, test roster, the Test Mode card and the upgrade host into `template.html` after it loads.
- The spell cost is hardcoded as `150` in the markup instead of reading `defenseRules.spellCost`.
- The tutorial tree SVG is inlined in the renderer (`renderer.ts:122`).

**Technique:** *Move Statements into Template*. Write the static structure in `template.html` or in small typed `h()`/`svg()` factory functions. Generate only the data-driven parts (the roster and costs) from content.
**Done when:** the structure is static, and only the data-driven parts are generated from content.

### 19. Handle all battlefield input in one place
**Smell:** Listeners on `#map` (click, keydown, pointermove) are registered in three places: `controls.ts:33-85`, `defense-controls.ts:184-232` and the renderer's capture-phase handlers. They interact implicitly through event order and `dismissedPerch`. `bindDefenseControls` also returns no disposer, unlike `bindBattleControls`.

**Technique:** *Combine Functions into Class*. Create one `BattlefieldInput` that maps pointer and keyboard events to `GameCommand`s plus UI intents (such as dismissing the popover), with one `AbortController` for cleanup.
**Done when:** the renderer registers no input listeners.

---

## Phase 6: Persistence and the legacy ruleset

### 20. Split `storage.ts` and turn migrations into an ordered pipeline
**Smell:**
- `storage.ts` is 486 lines covering validation primitives, a 120-line `validateState`, v1 migration, settings, bestiary, error mapping and the repository.
- `readSlot` changes the parsed object in place to expand 5-tower saves (`storage.ts:405-413`).
- `migrate` re-implements the terminal reward formula (`enemiesKilled + remaining * 10`, line 345), which duplicates `rewards.ts:48`, and the maximum-mana formula (line 302), which duplicates `defense-state.ts:20`.

**Technique:** *Split Module* / *Replace Inline Code with Function Call*. Create:
- `validation/primitives.ts`
- `save-schema.ts`, with one validator per entity
- `migrations/` as an ordered `[(raw) => raw]` list: `v1 → v2`, then `v2/5-tower → v2/8-tower`
- a thin `SaveRepository`

Migrations should call the domain formulas instead of copying them.
**Done when:** each migration is a pure function with its own tests.

### 21. Isolate the legacy ruleset, then decide whether to retire it
**Smell:** About half of the domain's branching and validation exists only so that interrupted pre-`defense-1` battles can keep running. `docs/ARCHITECTURE.md` notes that new journeys always use `defense-1`.

**Technique:** After #11 and #12, move the legacy code into `game/legacy/` behind the `Ruleset` interface, keeping the existing regression traces as its specification. Then make a product decision:
- **Keep it** as a sealed module, or
- **Sunset it**: on load, convert legacy saves to a ready `defense-1` checkpoint, the same way v1 checkpoints are migrated now. Then delete the module, its traces and the legacy branches in validation.

**Done when:** that decision is recorded as an ADR in `docs/`.

---

## Sequencing summary

| Phase | Items | Risk | Main safety net |
|---|---|---|---|
| 1. Safety net | 1–3 | Low | Existing suite |
| 2. Composition root | 4–6 | Low–medium | `session`/`persist-policy` tests, browser specs |
| 3. Content as data | 7–10 | Low | Byte-identical regression traces |
| 4. Domain model | 11–15 | Medium–high | Regression traces + `defense.test.ts` |
| 5. Presentation | 16–19 | Medium | Playwright specs + new view-model tests |
| 6. Persistence/legacy | 20–21 | Medium | `storage.test.ts`, migration fixtures |

Phases 2 and 3 do not touch the same files, so they can run in parallel. Phase 4 should not start until #7–#10 are done, because the `Ruleset` interface is much smaller once rules are data. Phase 5 can start any time after Phase 2.
