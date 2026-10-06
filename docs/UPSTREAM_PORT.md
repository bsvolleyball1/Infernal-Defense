# Main gameplay port

Reviewed source: GitHub `main` at `b01e5b554a046fdce353bfe59ee6a136ea54ea89`, October 6, 2026. All five approved feature groups have been ported into focused TypeScript modules. Its monolithic HTML, global wrappers, clocks, random IDs, browser-dependent combat, checkpoint-only saving, and external fonts were not copied. Existing maps, player journeys, offline support, native installation, and guarded automatic updates remain.

## Implemented groups

| Group | Local responsibilities |
| --- | --- |
| Dragon attacks | `content/dragon-attacks.ts` defines six-level profiles; `game/defense-combat.ts` handles beams, pulses, ice charges/retargeting, and rapid poison; `ui/defense-effects.ts` retains SVG nodes. |
| Food, mana, spells, early summoning | `content/defense-rules.ts`, `game/spells.ts`, `waves.ts`, and `defense-simulation.ts`; accessible touch/keyboard targeting in `ui/defense-controls.ts`. |
| Permanent upgrades | All 18 nodes in `content/upgrades.ts`; typed engine purchases; application successfully saves the candidate purchase before committing ranks and banked gold. |
| Enemies and waves | All 17 currently playable source enemies and revised tutorial/campaign waves in `content/enemies.ts`; focused factories, damage, abilities, geometry, movement, and rewards modules. |
| Test Mode and tutorial artwork | Isolated unsaved sandbox, manual monster selection and waves, unlimited-resource policy, retained labels and tutorial tree SVG. |

Paths above are relative to `src/`. Future monsters are labeled Coming soon, not given invented stats or abilities. Four original enemies remain recognized for old saves/bestiary. New campaign waves work on all three existing maps; the tutorial has separate waves. No additional maps are included.

## Rules and compatibility

- New journeys/levels use `state.defense.ruleset = 'defense-1'`. Existing v2 snapshots without that substate keep original combat, five eggs, and any purchased levels above six until their next level. Original trace regressions remain passing.
- Expanded levels start with **3 eggs**, increasing to **6** through More Eggs. Effective dragon levels start capped at three and can unlock to six. Ranks beyond these effective caps still contribute their source passive bonus. Validation caps stored ranks at 1,000 per node as a safety bound; unreasonable saves are preserved with an error, not clamped.
- The first five ranks of each tree each add 1% fire damage, poison rate, or ice range. Attack Power separately adds 5% damage per rank. Placement grants **5 mana per Fire Placement Mana rank**. Base regeneration is 5 mana per simulation second with the Blue bonus. Starting food is 120 plus 25 per Blue Starting Food rank; starting mana is 10 per Green Starting Mana rank, bounded by capacity. Food uses the existing battle `gold` field; banked reward gold is separate.
- Spells cost 150 mana with individual five-second cooldowns. Poison Gas covers radius 200, slows 50% for three seconds, and ticks three times at 5% maximum HP. Ice Freeze lasts two seconds plus Green duration ranks. Fire Rain hits radius 100 after 500 ms for 25 damage plus its upgrade. Witches ignore all spell damage/effects.
- Selected levels and non-final cleared waves start a five-second countdown. **Manual early summoning intentionally grants 10 mana per remaining rounded-up second**, capped by capacity. Timer-expiry automatic summoning earns no early bonus. All timers and regeneration use the same speed-scaled simulation clock; loading/backgrounding does not grant elapsed time.
- Ice spends its stored charges on the nearest enemy, restores one per active battle second, and retains projectile payloads when retargeting. Upgrades increase capacity without free charges; between-wave/background time does not refill them.
- Repeated poison hits reset its tick clock, deferring damage-over-time until the last hit. The five-second duration includes five endpoint ticks. Fire L5 pulses for 15 damage each second, L6 for 20; lower levels use continuous beams. Upgrading into area attacks starts a full pulse interval.
- Source trail ratings convert with `rating / 16`, matching main's effective `.125 × .5` movement. Shade uses its distance-scaled direct route with plain numeric progress, not a serialized `valueOf` method. Forked-route relationships remain explicit.
- Necromancers travel five seconds, pause one second, and summon a seeded random discovered playable enemy. Zombie Trains release 5–10 seeded children. Recursive summons are bounded at 500 total live/pending entities. Gargoyles delay death/egg drops/rewards two seconds. Phantoms start invulnerable for three seconds. Lich's first egg grants 100 HP and speed rating seven. Ghost, Troll, Hag and elemental resistances have explicit damage/ability rules.
- Expanded dropped eggs return after 30 seconds minus five seconds per Fire Egg Return rank, minimum five seconds. Recovery cancels that timer. All timers pause with the battle.
- Test Mode uses no player slot, no banked rewards/discoveries, and no egg theft. It permits manual waves beyond five. Unlimited food/mana is a policy over finite data, avoiding `Infinity` becoming JSON `null`.

## Exact saves and CLEAN boundaries

Schema remains version 2, extended with optional expanded state: ranks, mana, PRNG, countdown, spell cooldowns/preview, delayed impacts, visual timers, charges/regeneration, beam IDs, enemy abilities/effects, direct egg routes and return timers. Shots capture their payload when fired. Mutable collections are copied independently; terminal results clear dangling beam references and preserve reward-applied flags.

`services/defense-validation.ts` checks the extension after base references. Expanded source v1 checkpoints import ranks, attack upgrades, mana, discoveries, towers and checkpoint eggs. Older source egg arrays/lives are retained (3–8); new levels use 3–6. Old absolute egg-return times become fresh checkpoint timers. V1 cannot recover projectiles, carrier entities, ability clocks or random outcomes it never stored. Original v1 checkpoints and settings remain compatible.

Content, simulation, controls/rendering, validation, and application persistence are separate. The engine owns plain state and emits events; it has no DOM, browser clocks, storage, audio, framework dependencies or nondeterministic randomness. Purchases/journey transitions are save-before-commit. No upstream function monkey-patching or direct HTML merge was introduced.

## Verification and release

`VERIFICATION.md` records automated results; `RELEASE.md` covers physical devices. Expanded tests cover attacks, abilities, spells, upgrades, migration, corrupt saves, reward idempotence, countdowns and early mana at all speeds, and exact continuation with carrier/drop/projectile/effect/cooldown/future spawn/spell impact/PRNG state. Production browser tests exercise upgrade trees and failed purchases, portrait/landscape sandbox isolation, keyboard spells, restored countdowns and expanded offline cold launch. Existing installation and multi-version automatic-update tests remain mandatory.

Real Android Chrome/iPhone Safari installation, standalone launch, audio, orientation, backgrounding and offline checks remain pending. Development-branch publication is separately authorized; merging to main, changing repository Pages settings, and production publication remain separate release actions.
