# ADR 0001: Keep the legacy ruleset

## Status

Accepted. The original ruleset is a sealed module in `src/game/legacy/`.

## Context

New journeys already start on `defense-1`. The original ruleset remains so an interrupted pre-defense battle can resume. Its step, combat, and bonus-gold payout now live behind `legacyRuleset` and are not imported by the defense simulation.

## Decision

Keep the legacy ruleset. Do not convert old battles into defense checkpoints, and do not delete the regression traces.

## Consequences

Save validation still accepts both rulesets. Persistence migrations in `src/services/migrations/` do not choose a ruleset; they only bring older documents forward. `game/legacy/` does not import defense modules.
