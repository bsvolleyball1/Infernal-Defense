# INFERNAL DEFENSE — PROJECT REFERENCE

This file combines the Game Blueprint and Build Roadmap.

---

# Infernal Defense — Game Blueprint
Version 0.1

## 1. Game Concept

Infernal Defense is a browser-based tower defense game inspired by classic lane/path tower-defense games such as Lair Defense, but with an original setting and mechanics.

Instead of humans attacking dragons, hellish monsters invade a dragon nest to steal dragon eggs.

The central gameplay twist is the egg-carrying system:

1. An enemy enters the map.
2. It travels toward the dragon nest.
3. It immediately takes an egg.
4. It reverses direction and attempts to escape.
5. If the enemy carrying the egg is killed, the egg drops where the enemy died.
6. Another enemy can pick up the dropped egg.
7. If an enemy carrying an egg reaches the escape point, the player permanently loses one egg.

The player builds and upgrades dragons to stop the invasion.

---

# 2. Platform and Technology

## Target

Browser-based HTML game.

The game should run in modern desktop and mobile browsers.

## Core technology

- HTML
- CSS
- JavaScript
- HTML Canvas for the battlefield
- JSON/data objects for enemies, dragons, waves, maps, and upgrades
- GitHub for source control
- GitHub Pages can eventually host the playable game

No game engine is required for the initial version.

## Design principle

Keep gameplay data separate from game logic whenever practical.

Adding a new enemy or dragon should primarily involve adding data rather than rewriting the game engine.

---

# 3. Core Game Loop

Each battle follows this general loop:

1. Load map.
2. Give player starting Food and Mana.
3. Display dragon nest and eggs.
4. Begin wave.
5. Enemies enter the map.
6. Enemies travel toward the nest.
7. Player places dragons on legal terrain.
8. Dragons automatically attack enemies.
9. Player may cast spells.
10. Enemy reaches nest and takes an egg.
11. Egg carrier reverses direction.
12. Player kills enemies.
13. Dead egg carrier drops the egg.
14. Another enemy may retrieve it.
15. Enemy either escapes with the egg or is killed.
16. Wave ends.
17. Player receives rewards.
18. Player spends permanent upgrade currency.
19. Next stage begins.

---

# 4. Victory and Loss

## Victory

The player completes all required waves without losing the required number of eggs.

## Egg loss

An egg is lost when an enemy carrying it reaches the map's escape point.

The egg is NOT permanently lost when the carrier is killed.

Instead:

Enemy carrying egg
→ enemy dies
→ egg drops
→ another enemy can retrieve it

This creates an important strategic mechanic: killing an egg carrier farther from the nest/escape route can change where the next carrier starts.

## Future consideration

Define exact loss conditions per stage later:

- Maximum eggs lost
- Whether all eggs can be lost
- Whether a stage can be won with zero eggs
- Whether egg preservation affects score/rewards

---

# 5. Game Modes / Difficulty

There are three difficulties:

1. Beginner
2. Hard
3. Hell

Each difficulty contains:

- 6 maps
- 6 stages per map

Total planned stages:

108 stages

Difficulty × Maps × Stages:
3 × 6 × 6 = 108

The exact wave count per stage is TBD.

---

# 6. Speed Controls

The player should have:

- Normal speed
- 2× speed

Possible future addition:

- 3× speed

Speed should affect the simulation without breaking cooldowns, movement, targeting, or animations.

---

# 7. Resources

There are three primary currencies/resources.

## Food

Used for:

- Building dragons/towers
- Dragon upgrades
- Potentially other battle actions

Enemies killed provide Food.

Food is primarily a battle resource.

## Mana

Used for:

- Fireball
- Freeze

Mana regenerates during battle.

Mana can also be purchased with Money.

## Money

Used for:

- Permanent upgrades
- Post-battle progression

Money is persistent between battles.

---

# 8. Terrain

Maps contain different types of placement locations.

## Mana-producing areas

A dragon placed here increases mana regeneration by 1%.

## High ground

A dragon placed here receives:

- +1 range

## Roosts

A dragon placed here produces Food.

Tradeoff:

- -1 range

Terrain should be represented as map data rather than hard-coded into individual maps.

---

# 9. Dragons / Towers

Initial dragon types:

- Red — Fire
- Blue — Ice
- Green — Poison

Future dragons:

- White — Ice
- Black — Acid
- Gold — Fire or weakening
- Silver — Cold or paralyzing
- Bronze — Lightning or repulsive gas
- Copper — Acid or slowing
- Brass — Sleeping

Future dragon abilities are intentionally not finalized yet.

---

# 10. Red Fire Dragon

## Level 1

Direct beam of fire.

Damage:
- 6 HP/sec

## Level 2

Damage:
- 15 HP/sec

## Level 3

Beam becomes:
- 2 separate beams

## Level 4

Beam becomes:
- 3 separate beams

## Level 5

Attack changes to:
- Waves of fire
- Attacks all monsters in radius

## Level 6

Damage:
- 20 HP/sec

---

# 11. Blue Ice Dragon

## Level 1

- Fires 1 charge at an enemy
- 15 damage
- Charge regenerates every 1 second

## Level 2

- Maximum 2 charges

## Level 3

- Maximum 3 charges

## Level 4

- 20% chance to freeze target for 1 second

## Level 5

- Damage increases to 25

## Level 6

- 30% chance to freeze target for 1 second

---

# 12. Green Poison Dragon

## Level 1

- 4 attacks/sec
- 2 damage per attack

## Level 2

- 4 damage per attack

## Level 3

- Poison effect
- Target takes 1% damage/sec for 5 seconds after the last attack

## Level 4

- Target speed reduced 50% for 1 second

## Level 5

- 5 damage per attack

## Level 6

- 6 damage per attack

---

# 13. Enemy System

Enemy data should contain at minimum:

- Name
- Speed
- Health
- Special ability
- Food reward
- Visual/animation data
- Targeting rules
- Egg-carrying behavior

Speed scale:

- 1 = slowest
- 10 = fastest

Health scale:

- 10 = lowest
- 100 = highest

Some enemies intentionally exceed the normal health scale.

---

# 14. Enemy Roster

| Enemy | Speed | Health | Ability |
|---|---:|---:|---|
| Imp | 5 | 10 | None |
| Sea Serpent | 9 | 10 | None |
| Demon | 1 | 100 | None |
| Hellhound | 5 | 50 | Takes 75% reduced damage from Fire |
| Fury | 9 | 50 | Takes 75% reduced damage from Green |
| Devil | 1 | 100 | Takes 75% reduced damage from Ice |
| Ghost | 9 | 10 | Becomes untargetable for 3 sec after first attack |
| Gargoyle | 4 | 60 | 2 sec invulnerability after death; remains targetable while dying |
| Witch | 3 | 80 | Immune to magic: Fireball and Freeze |
| Hag | 2 | 90 | Heals nearby enemies 3% HP/sec |
| Troll | 3 | 100 | If not taking damage for 1 sec, heals 4% HP/sec |
| Necromancer | 1 | 100 | Every 3 sec summons a random previously explored enemy |
| Zombie Train | 1 | 200 | On death summons 5–10 random Imps, Demons, and Sea Serpents |
| Lich | 4 | 90 | After taking egg: speed 7, health 100 |
| Skeleton | 5 | 10 | 50% reduction from all 3 initial dragon types |
| Wight | TBD | TBD | TBD |
| Werewolf | TBD | TBD | TBD |
| Phantom | 2 | 80 | Invulnerable for first 3 sec after summoning |
| Shade | 3 | 100 | Ignores map terrain/pathing and moves straight through |
| Specter | TBD | TBD | TBD |
| Ogre | TBD | TBD | TBD |
| Minotaur | 5 | 100 | Pushes Demons in front of it |
| Manticore | TBD | TBD | TBD |
| Goblin | 10 | 20 | None |
| Giant | TBD | TBD | TBD |
| Cyclops | TBD | TBD | TBD |
| Basilisk | TBD | TBD | Can destroy towers |
| Siege Engine | TBD | TBD | TBD |
| Aircraft | TBD | TBD | Strong |

---

# 15. Enemy Special-System Requirements

The engine should support reusable status/effect systems.

Examples:

- Damage resistance
- Invulnerability
- Untargetable
- Healing
- Summoning
- Movement-speed changes
- Terrain/pathing overrides
- Tower destruction
- Pushing other enemies
- Egg-carrier stat changes

Avoid creating a completely separate piece of game logic for every enemy.

---

# 16. Spells

## Fireball

Cost:
- 150 Mana

Effect:
- 25 damage
- Player chooses target area

Cooldown:
- 5 seconds

## Freeze

Cost:
- 150 Mana

Effect:
- Freezes all monsters
- 2 seconds

Cooldown:
- 5 seconds

## Mana purchase

Player can purchase:

- 200 Mana

Cost is based on:
- Current level
- Difficulty

Exact pricing formula is TBD.

---

# 17. Permanent Upgrade System

The permanent upgrade screen appears after every battle.

There are three upgrade categories.

## Fire — Damage

Every Fire upgrade improves damage somewhat.

1. Total Mana
2. Max Level
3. Increase Mana when placing Dragon
4. Increase Fire Rain Damage
5. Egg Return After a Time
6. Attack Power

## Green — Rate

Every Green upgrade improves fire/attack rate somewhat.

1. Starting Mana
2. Max Level
3. More Eggs
4. Prolong Ice Spell
5. More Food From Kills
6. Attack Power

## Blue — Range

Every Blue upgrade improves attack range somewhat.

1. Starting Food
2. Max Level
3. More Charges
4. Increase Mana Regen Rate
5. Increase HP Loss While Having Egg
6. Attack Power

IMPORTANT DESIGN NOTE:
Some upgrades affect systems outside their apparent color category. Do not automatically change this. It may be intentional.

Exact values, costs, stacking rules, and unlock requirements are TBD.

---

# 18. Post-Battle Rewards

At the end of each stage, award Money based on:

- Enemies killed
- Eggs saved

Potential modifiers:

- Reduced reward if magic was used
- Reduced reward if an easier difficulty was used

Exact formulas are TBD.

---

# 19. Early Wave Start

After some amount of time, the player may start the next wave early.

Reward:

- Extra Mana OR
- Extra Food

Exact timing and reward formula are TBD.

This should reward skilled/aggressive play.

---

# 20. Tower Selling

Players can sell dragons.

Selling provides a partial refund.

Each dragon should have:

- Purchase cost
- Upgrade costs
- Sell value

Exact refund percentages are TBD.

---

# 21. Egg System — Critical Feature

The egg should be treated as a real game object/state rather than merely a counter.

Suggested states:

- AtNest
- CarriedByEnemy
- Dropped
- SuccessfullyStolen

Core state transition:

At Nest
→ Enemy reaches nest
→ Enemy picks up egg
→ Egg becomes attached to enemy
→ Enemy reverses direction
→ Enemy is killed
→ Egg drops at death location
→ Another enemy can pick it up

Or:

Enemy carrying egg
→ reaches escape point
→ egg is permanently stolen
→ player's egg count decreases

This system should be implemented early because it is one of the game's defining mechanics.

---

# 22. Map / Pathing Requirements

Maps need to support:

- Enemy entrance
- Enemy route to nest
- Egg pickup location
- Reverse route for egg carriers
- Escape point
- Dragon placement locations
- Terrain modifiers
- Potentially multiple paths
- Shade/other path-ignoring enemies
- Flying enemies

Do not hard-code path behavior around one map.

---

# 23. First Playable Prototype

The first prototype should be extremely small.

## Map

- 1 map

## Egg

- 1 egg

## Enemy

- Imp only
- Speed 5
- Health 10

## Dragon

- Red Fire Dragon
- Level 1
- 6 damage/sec

## Resource

- Food only

## Objective

Stop the Imp from stealing the egg.

The prototype must demonstrate:

1. Enemy enters.
2. Enemy travels toward nest.
3. Enemy reaches egg.
4. Enemy takes egg.
5. Enemy reverses direction.
6. Fire Dragon targets enemy.
7. Enemy takes damage.
8. Enemy dies.
9. Egg drops.
10. Another enemy can eventually retrieve it.
11. Enemy can escape with egg.
12. Player can win or lose.

Only after this works should additional systems be layered in.

---

# 24. Development Principles

1. Build one system at a time.
2. Test every system before adding another.
3. Keep data separate from code.
4. Avoid giant JavaScript files.
5. Keep functions small and understandable.
6. Use descriptive names.
7. Do not hard-code enemy stats into the engine.
8. Do not hard-code individual maps into the engine.
9. Make abilities reusable.
10. Keep the game playable after every major change.

---

# 25. Originality / Inspiration Boundary

The game may use classic tower-defense concepts and may be inspired by Lair Defense's gameplay structure.

Do NOT copy:

- Original sprites
- Artwork
- Sounds
- Music
- Character designs
- Names
- Written descriptions
- Source code
- Proprietary assets

The new game's setting, enemies, dragons, artwork, UI, code, and presentation should be original.

---

# 26. Open Design Questions

These should be decided later rather than blocking development:

- Exact wave count per stage
- Exact number of starting eggs
- Exact Food costs
- Exact Mana regeneration
- Mana purchase pricing
- Money reward formulas
- Sell refund percentage
- Permanent upgrade values/costs
- Wight stats
- Werewolf stats
- Specter stats
- Ogre stats
- Manticore stats
- Giant stats
- Cyclops stats
- Siege Engine stats
- Aircraft stats
- Future dragon abilities
- Exact map layouts
- Boss enemies
- Sound/music
- Mobile UI details
- Save-game system
- Difficulty scaling

These can remain TBD while the prototype is built.


---

# Infernal Defense — Build Roadmap
Version 0.1

This document is the practical development checklist for building the browser game.

The rule for the project is:

**Do not ask Codex to build the entire game at once.**

Give Codex one small, testable task at a time.

---

# Phase 0 — Project Setup

## Step 1 — Create GitHub repository

Recommended repository name:

`infernal-defense`

Recommended visibility:

Private at first.

Add:

- README
- .gitignore appropriate for JavaScript

Do not start with a complicated framework.

## Step 2 — Create project structure

Initial files:

```text
infernal-defense/
├── index.html
├── README.md
├── css/
│   └── main.css
├── js/
│   └── main.js
├── assets/
├── data/
└── docs/
    ├── GAME_BLUEPRINT.md
    └── BUILD_ROADMAP.md
```

## Step 3 — Put the two design documents in `docs/`

These documents become the source of truth.

Codex should be instructed to read the relevant documentation before implementing systems.

---

# Phase 1 — Empty Game Shell

Goal:

Open `index.html` and see the game application.

Build:

- HTML page
- Canvas
- Basic CSS
- Game initialization
- Animation/game loop

Success criteria:

- Page loads without errors.
- Canvas appears.
- JavaScript runs.
- Browser console has no errors.

Commit:

`Create initial HTML game shell`

---

# Phase 2 — Map Prototype

Goal:

Create one simple battlefield.

Add:

- Background
- Entrance
- Path
- Dragon nest
- Egg
- Basic tower placement spots

Do not add real enemies yet.

Success criteria:

- Map renders.
- Egg renders.
- Placement locations render.
- Game loop remains stable.

Commit:

`Add first battlefield`

---

# Phase 3 — Enemy Framework

Goal:

Create the generic enemy system.

Create an Enemy object/class with:

- name
- health
- maxHealth
- speed
- position
- path progress
- alive/dead state
- egg-carrier state

Create Imp data:

```text
Name: Imp
Speed: 5
Health: 10
Ability: none
```

Success criteria:

- Imp appears.
- Imp moves along the path.
- Imp can be damaged.
- Imp dies.

Commit:

`Add enemy framework and Imp`

---

# Phase 4 — Egg System

This is one of the most important phases.

Implement:

- Egg object
- Egg at nest
- Enemy reaches nest
- Enemy picks up egg
- Enemy reverses direction
- Enemy carrying egg can die
- Egg drops at death position
- Another enemy can pick it up
- Enemy can escape with egg

Success criteria:

The complete egg loop works without dragons:

```text
Enemy
→ Nest
→ Egg
→ Reverse
→ Escape
```

and:

```text
Enemy
→ Nest
→ Egg
→ Reverse
→ Dies
→ Egg drops
→ New enemy picks it up
```

Commit:

`Implement egg carrying and recovery`

---

# Phase 5 — Red Dragon Level 1

Implement:

- Dragon placement
- Food cost
- Range
- Target selection
- Fire beam
- 6 damage/sec
- Enemy death

Success criteria:

Player can place a Red Dragon and it automatically attacks an Imp.

Commit:

`Add Red Dragon level 1`

---

# Phase 6 — Food

Add:

- Starting Food
- Dragon purchase cost
- Food deduction
- Food reward from enemy kills

Success criteria:

Player must manage Food to build dragons.

Commit:

`Add Food economy`

---

# Phase 7 — Waves

Create a wave manager.

Start with:

- Wave 1
- Wave 2
- Wave 3

Use Imp only.

The wave system should support future enemy definitions.

Success criteria:

- Enemies spawn at controlled intervals.
- Waves end correctly.
- Next wave starts.
- Stage ends after final wave.

Commit:

`Add wave system`

---

# Phase 8 — Battle UI

Add:

- Food display
- Mana display
- Egg display
- Wave display
- Speed button
- Dragon selection
- Sell button
- Upgrade button later

Keep the interface functional before making it beautiful.

Commit:

`Add battle interface`

---

# Phase 9 — Mana and Spells

Add:

- Mana regeneration
- Fireball
- Freeze
- Spell cooldowns
- Mana costs

Fireball:

- 150 Mana
- 25 damage
- 5 sec cooldown
- Area target

Freeze:

- 150 Mana
- Freeze all monsters
- 2 sec
- 5 sec cooldown

Success criteria:

Both spells work independently of dragon attacks.

Commit:

`Add battle spells`

---

# Phase 10 — Blue and Green Dragons

Implement Blue Dragon first.

Then Green Dragon.

Do not implement all six levels at once unless the lower-level system is already stable.

Recommended order:

1. Blue Level 1
2. Blue upgrade framework
3. Blue Levels 2–6
4. Green Level 1
5. Green upgrade framework
6. Green Levels 2–6

Commit separately.

---

# Phase 11 — Terrain

Implement:

- Mana areas
- High ground
- Roosts

Terrain effects:

Mana area:
- +1% mana regeneration

High ground:
- +1 range

Roost:
- produces Food
- -1 range

Success criteria:

Moving/placing the same dragon on different terrain produces different results.

---

# Phase 12 — Enemy Ability Framework

Before adding lots of enemies, create reusable effects.

The system should support:

- Damage resistance
- Freeze
- Invulnerability
- Untargetable
- Healing
- Summoning
- Speed modification
- Path override
- Tower destruction
- Pushing

Then add enemies using the framework.

---

# Phase 13 — Enemy Roster

Add enemies gradually.

Suggested order:

1. Imp
2. Sea Serpent
3. Demon
4. Hellhound
5. Fury
6. Devil
7. Goblin
8. Skeleton
9. Ghost
10. Gargoyle
11. Witch
12. Hag
13. Troll
14. Lich
15. Phantom
16. Shade
17. Minotaur
18. Necromancer
19. Zombie Train
20. Remaining TBD enemies

Test each enemy before adding the next.

---

# Phase 14 — Permanent Upgrades

Build the post-battle upgrade screen.

Implement the three categories:

- Fire
- Green
- Blue

Start with one working upgrade in each category.

Then add the remaining upgrades.

Do NOT finalize all numerical values before the system exists.

The system should support:

- Upgrade purchase
- Persistent save data
- Upgrade levels
- Upgrade effects
- Upgrade costs

---

# Phase 15 — Difficulty

Implement:

- Beginner
- Hard
- Hell

Difficulty should be data-driven.

Potential scaling:

- Enemy health
- Enemy speed
- Enemy quantity
- Food rewards
- Money rewards
- Mana costs

Do not hard-code separate versions of the game.

---

# Phase 16 — Maps

Create the 6-map structure.

Then:

- 6 stages per map
- 6 × 6 = 36 stages per difficulty
- 108 total planned stages

Build maps from reusable map data.

---

# Phase 17 — Rewards and Economy

Implement:

- Money from kills
- Money from eggs saved
- Magic-use modifier if desired
- Difficulty modifier if desired
- Selling dragons
- Sell refund
- Mana purchases

Balance only after the complete game loop exists.

---

# Phase 18 — Early Wave Start

Add:

- Early wave button
- Timer/eligibility
- Bonus Food or Mana

This should reward players who intentionally start waves early.

---

# Phase 19 — Save System

Add browser save data.

Possible implementation:

`localStorage`

Save:

- Permanent upgrades
- Unlocked stages
- Money
- Difficulty progress
- Settings

Do not put temporary battle state into permanent save data unless needed.

---

# Phase 20 — Mobile UI

Once gameplay works on desktop:

Test on phone.

Adjust:

- Buttons
- Touch controls
- Dragon placement
- Spell targeting
- Text size
- Canvas scaling
- Portrait/landscape decision

Do not optimize mobile controls too early.

---

# Phase 21 — Art and Audio

Only after gameplay works.

Replace placeholders with original:

- Dragon art
- Enemy art
- Eggs
- Map artwork
- Projectiles
- Spell effects
- UI graphics
- Sound effects
- Music

Keep all assets original or properly licensed.

---

# Phase 22 — Balancing

Test:

- Food economy
- Mana economy
- Dragon costs
- Dragon damage
- Enemy health
- Enemy speed
- Egg difficulty
- Upgrade costs
- Money rewards
- Difficulty scaling

Use actual gameplay data rather than guessing.

---

# Phase 23 — Polish

Add:

- Animations
- Hit effects
- Death animations
- Egg pickup effects
- Damage numbers if desired
- Better menus
- Settings
- Sound controls
- Tutorial
- Skip tutorial option
- Better transitions

---

# Phase 24 — GitHub Pages

When the game is stable:

1. Enable GitHub Pages.
2. Publish the site.
3. Test the public URL.
4. Test desktop.
5. Test mobile.
6. Fix any asset/path problems.

Final goal:

A shareable browser URL where people can play the game.

---

# Codex Workflow

For every feature, use this pattern:

1. Tell Codex to read the relevant docs.
2. Give it ONE task.
3. Tell it what files it may change.
4. Tell it what success looks like.
5. Have it inspect for errors.
6. Run the game yourself.
7. Fix problems.
8. Commit.
9. Move to the next task.

Example:

> Read `docs/GAME_BLUEPRINT.md` and implement only the generic Enemy class and Imp enemy described in the blueprint. Do not implement dragons, spells, waves, or the egg system yet. Keep the code modular and explain which files you changed.

Then test it.

---

# Git Workflow

Main branch:

`main`

Feature branches:

```text
feature/game-shell
feature/map
feature/enemy-system
feature/egg-system
feature/red-dragon
feature/food
feature/waves
feature/spells
```

General workflow:

```text
main
  ↓
create feature branch
  ↓
Codex changes code
  ↓
test
  ↓
commit
  ↓
push
  ↓
Pull Request
  ↓
review
  ↓
merge into main
```

Never let a large pile of untested changes accumulate.

---

# Definition of "Done"

A feature is not done merely because the code exists.

A feature is done when:

- It works in the browser.
- It does not introduce console errors.
- It works with existing systems.
- It is reasonably modular.
- It follows the blueprint.
- It has been tested manually.
- The change is committed to Git.

---

# First Milestone

The first major milestone is NOT the full game.

It is:

**One complete playable battle.**

Requirements:

- One map
- One egg
- One Imp
- One Red Dragon
- Food
- Enemy movement
- Dragon targeting
- Damage
- Egg pickup
- Egg reversal
- Egg dropping
- Egg recovery
- Egg escape
- Win/lose state

Once that works, the project has a real foundation.

---

# Second Milestone

A complete basic tower-defense battle:

- Multiple waves
- Red Dragon levels
- Blue Dragon
- Green Dragon
- Food
- Mana
- Fireball
- Freeze
- Terrain
- Selling

---

# Third Milestone

Progression:

- Money
- Permanent upgrades
- Multiple maps
- Difficulty
- Stage progression
- Save system

---

# Fourth Milestone

Content:

- Full enemy roster
- Full dragon roster
- 108 stages
- Balancing

---

# Fifth Milestone

Release quality:

- Original art
- Audio
- Mobile controls
- Tutorial
- Menus
- Settings
- GitHub Pages deployment
- Testing

