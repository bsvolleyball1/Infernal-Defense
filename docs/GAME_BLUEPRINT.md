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

Exact timing and reward formula is TBD.

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
