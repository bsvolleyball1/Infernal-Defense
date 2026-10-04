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

