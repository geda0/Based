# 0004 — §6 contract seam: literal spoiler-safety + ts semantics

## Status
Accepted (prototype phase). Extends ADR 0003; refines the §6 seam in
`frontend/src/contracts/index.ts`. Append-only.

## Context
M0b completes the §6 seam by adding the remaining two of four shared types,
`RankedFeed` and `HostDirective`, alongside the existing `PerceptionEvent` and
`Vantage`. Two choices are non-obvious and worth recording:

1. **Spoiler-safety as a type, not a runtime flag.** ADR 0003 names spoiler-safety
   the top prototype invariant: every `HostDirective` is `spoilerSafe: true`. The
   brief annotates it "always true." A `boolean` field documents the intent but
   lets a directive ship `spoilerSafe: false` and compile.
2. **`ts` semantics diverge from the brief's literal comment.** The brief §6 block
   comments `ts` as "event wall-clock ms," but the §11 sample graph and the feed
   (`createSourceGraphFeed`, scheduled via `ts` offsets) both treat `ts` as a
   millisecond offset from feed start. The existing tests assert the offset reading
   (`event-graph.test.ts`, `source-graph-feed.test.ts`).

## Decision
- Type `HostDirective.spoilerSafe` as the **literal `true`**, not `boolean`. The
  compiler then rejects any directive that is not spoiler-safe at the seam — the
  structural guard for the invariant, so the host loop cannot emit an unsafe
  directive even by mistake.
- Keep `PerceptionEvent.ts` documented as **"ms offset from feed start,"** matching
  the §11 sample and the feed's actual usage. We do not revert to the brief's stale
  "wall-clock" wording. The contract follows real usage, not the prose annotation.
- `RankedFeed` and `HostDirective` mirror the brief §6 block field-for-field
  (incl. `staging?.fireAtMs` for predictive cut timing); no speculative fields.

## Consequences
- The spoiler-safety invariant is enforced at compile time at the seam, in addition
  to whatever runtime tests the host loop adds. Producing an unsafe `HostDirective`
  is a type error.
- `ts` is unambiguous for M1–M4 consumers (feed scheduling, predictive staging):
  offset-from-start, never wall-clock. Real perception backends must emit the same.
- The seam is complete: all four §6 types exist, the UI consumes only
  `HostDirective` + channel state, and mock perception can be swapped for real
  without touching the UI (ADR 0003 contracts-as-seam holds).

## Alternatives considered
- **`spoilerSafe: boolean`**: documents intent but permits an unsafe directive to
  compile; pushes the invariant entirely to runtime. Rejected — the seam should make
  the violation unrepresentable.
- **Honor the brief's "wall-clock" comment for `ts`**: would contradict the sample
  graph, the feed implementation, and the green tests. Rejected as stale prose.
