# ADR 0001: Keep the legacy ruleset

## Status

Accepted. Isolation waits for the ruleset seam in phase 4.

## Context

New journeys already start on `defense-1`. The original ruleset remains so an interrupted pre-defense battle can resume. Phase 4 items 11 and 12, the `Ruleset` interface and the tagged `GameState` union, are the place to move that code into `game/legacy/`.

## Decision

Keep the legacy ruleset. Do not convert old battles into defense checkpoints, and do not delete the regression traces. After phase 4, move the legacy pipeline behind `Ruleset` as a sealed module.

## Consequences

Save validation still accepts both rulesets. Persistence migrations in `src/services/migrations/` do not choose a ruleset; they only bring older documents forward.
