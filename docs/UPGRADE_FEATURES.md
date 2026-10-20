# Upgrade branch feature integration

Implemented October 20, 2026 from DevD `d8a9eae`, using `87842f5` from `bsvolleyball1-upgrade-buttons-above-tower` as the feature reference. The implementation follows [the phased plan](BRANCH_SALVAGE_PLAN.md) and is intended for DevD before a separate main release.

## Delivered behavior

| Feature | Implementation |
| --- | --- |
| Placement | A visible 50-unit grid, snapped preview and keyboard placement, one tower per complete open cell, all routes blocked, consistent save validation |
| Bonuses | Damage, range, mana, food, and gold cells on each map; historical battles keep their previous bonus locations |
| Evolution | Red, Blue, Yellow, six tier-two forms, and thirteen tier-three forms, for 22 total; unordered color combinations and explicit alternate choices |
| Combat | Continuous and map-wide beams, charged and rapid attacks, cones, explosions, acid, focus, nullification, tar, earthquakes, radius attacks, and sniper projectiles |
| Presentation | Color/form choices, cancel and focus behavior, form names and effect colors, yellow portraits, and controls below the map |
| Challenges | Blightless, Frostless, and Emberless Fork after the existing three trials; placement, evolution, spells, UI, and saves share restrictions |
| Data and CI | Generated tower/monster balance CSVs, DevD verification triggers, consistent LF checkout policy, and two browser workers locally and in CI |

The original UI, SVG scenery, offline architecture, storage namespace, and main-only Pages deployment remain in use. Hybrid forms use the existing base portrait family and a distinct name and aura/effect color.

## Saved games and progression

- Existing original battles and `defense-1` battles retain their rules, positions, levels, bonus locations, and upgrade commands. Loading a saved ready/countdown checkpoint does not convert it.
- New player creation, sandbox, and the next newly started level use `defense-2`. A battle boundary carries campaign gold, permanent ranks, and journey completion forward.
- New towers have three tiers. Historical max-level ranks remain saved and retain their passive rank-total benefits; the new profile disables further purchases of that node. Extra-charge ranks still increase charged-form capacity.
- The starting element determines ordinary rank/range modifiers and resistance classification. Color order does not affect available forms. Challenge restrictions also apply to every color added during evolution.
- Evolution validates everything before spending food. Previously fired projectiles retain their launch damage, poison payload, and retarget origin/range. Evolution waits the new attack interval; a newly evolved charged form starts empty and recharges once per second during battle. Freshly placed charged forms start full.
- Pink removes damage resistance for four seconds. It does not bypass other invulnerability or immunity traits. Acid retains the existing poison timing: repeated hits refresh the timer, then poison ticks after the last hit.
- Complete source-branch top-level color/form snapshots have a narrow migration into the new profile. Incomplete, ambiguous, invalid, or challenge-forbidden shapes are rejected while preserving the original raw slot.
- The envelope remains save version 2. Older application binaries do not understand `defense-2`; preserve newer raw slots when recovering from a downgrade and use a compatible forward fix. Read errors never delete saved data.

## Corrected source branch failures

The new panel is present in the template before binding. The new TypeScript imports are used. Grid placement and save validation share the same geometry. All challenge checks use the only/exclude policy. Nullification counts down in simulation time. Old upgrade commands remain available under old profiles. Charged forms retain unused charges, honor extra-charge ranks, and clamp floating-point recharge residue so valid terminal states remain saveable. Snapshots independently copy nested evolution and projectile state.

The pre-existing journey-results browser test now waits for the result dialog to become visible before checking saved completion metadata. Its previous title assertion could pass against the hidden dialog's default text. Existing Windows formatting warnings were caused by line endings; `.gitattributes` now matches the formatter's LF convention.

## Verification

| Check | Result |
| --- | --- |
| TypeScript | Passed |
| Unit tests | 482 passed in 21 files, including the original regression traces |
| Chromium browser tests | 52 passed against the production build at `/Infernal-Defense/` |
| Formatting | Passed |
| ESLint | No errors; advisory complexity/size/non-null warnings remain |
| Production build | Passed, including PWA precaching |
| Balance export | Generated 22 tower forms and 17 monsters from typed definitions |
| Installed old-to-new build update | Passed using the actual original DevD build and the new production build |

Unit checks cover all color permutations, legal and illegal evolution, every valid cell on all ten levels, all bonus cells, exact save/resume for all 22 forms, projectile snapshot isolation, charges, temporary status expiration, protected enemies, fork-aware area effects, one-time rewards, challenge validation, source migration, and preservation of unreadable slots.

`evolution-journey.test.ts` runs a deterministic player strategy with normal starting food and no permanent ranks through all five waves of all ten selectable levels. It purchases towers/upgrades with earned resources and uses allowed spells. Every run wins and saves a valid completed journey. This is a functional playability check; it does not establish optimal difficulty or replace human balance feedback.

Browser checks create every form through player controls, exercise alternate choices and cancellation in portrait/landscape, enforce all three exclusion trials, verify keyboard placement, check that narrow-screen controls stay within the viewport, restore old and new profiles on the same map without reloading, and fetch all three yellow portraits offline. Existing storage-failure, stale-tab, original-save, result/reward, installation, and automatic-update checks continue to pass. Portrait and landscape screenshots were reviewed; an initial cramped landscape map, clipped narrow toolbar, and a tower-action popover covering the summon entrance were corrected.

The installed-build check serves two separate compiled applications. It installs DevD `d8a9eae`, creates and pauses an old battle, updates the actual service worker to the new application, and verifies exact historical state, old upgrade behavior, transition into the new profile, offline cold launch, an untouched second slot, and no page errors. The reusable check is:

```powershell
npm run verify:upgrade -- <baseline-project-folder-containing-dist>
```

Build that baseline in a separate directory and build the current project first. The script serves only loopback HTTP and uses isolated Chromium storage. It does not use a personal browser profile or modify the real deployed site.

Regenerate balance sheets with:

```powershell
npm run balance
```

These checks used the existing installed Node 24 dependencies. The pre-existing local `package-lock.json` was retained byte-for-byte and excluded from implementation commits. No dependency changes were required. Physical Android/iPhone testing and human difficulty feedback remain separate release checks.

## Main release preparation

Suggested PR title: **Add grid placement and dragon evolution with saved battle compatibility**.

The release description should cover the new grid/bonus cells, 22 forms, three exclusion challenges, compact toolbar, yellow portraits, and explicit old-save compatibility. Include the final DevD SHA and the actual validation results above. Recheck main/DevD ancestry before creating the release PR. Merging it triggers the existing Pages workflow; after an authorized merge, check the deployed URL, offline launch, and original-save resume.

No main merge, remote push, or deployment is part of this local implementation. A forward fix is preferable to publishing an older binary that cannot read new-profile slots.
