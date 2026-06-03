# 0001 — Record architecture decisions

## Status
Accepted.

## Context
Agents rotate in and out with fresh context. Decisions need a durable home so a
new agent understands *why* the code is the way it is and doesn't relitigate
settled choices.

## Decision
We keep Architecture Decision Records (ADRs) in `docs/decisions/`, numbered and
append-only. Each records context, the decision, and consequences. ADRs are
never deleted; superseded ones are marked and linked to their replacement.

## Consequences
Any agent can reconstruct the rationale of the system from the ADR log.
