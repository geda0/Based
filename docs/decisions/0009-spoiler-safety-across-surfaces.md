# 0009 — Spoiler-safety binds every viewer-facing surface (rail labels)

## Status
Accepted (prototype phase). Extends the spoiler-safety invariant (ADR 0003 #1)
beyond `HostDirective` to the channel rail. Resolves the §13 "spoiler-safety
across surfaces" decision (navigator-greenlit, 2026-06-02). Append-only.

## Context
ADR 0003 #1 makes spoiler-safety the top prototype invariant, and ADR 0004 enforces
it structurally on `HostDirective` (`spoilerSafe: literal true`). But that guard
binds only the **host's** directives. The channel rail
(`frontend/src/components/channel-rail.tsx`) renders each event's `narrative`
verbatim as the button label, and the §11 mock narratives **name outcomes**
("…clutch **to win the round**…", "…**for a world record**…"). qa confirmed this as a
**live, visible on-screen leak** on staging: the host's ear is spoiler-safe, but the
page is not. `narrative` is the perception layer's outcome-bearing description — it
exists to *time the cut*, not to be shown (brief §5, §14).

This is the structural gap behind the leak: spoiler-safety was treated as a property
of one type rather than of the **viewer-facing surface**. The §13 call asked whether
no-spoiler binds the whole UI or only the host's voice. Answer: **the whole UI.**

## Decision
- **Spoiler-safety binds every viewer-facing surface, not just `HostDirective`.**
  No surface a viewer can read may render `PerceptionEvent.narrative` (or any
  outcome token), because `narrative` is outcome-bearing by design.
- **The rail label is built from SAFE fields only** — `event.type` and the top
  vantage's `streamer`. `type` is a closed enum naming the *kind* of moment
  (`clutch | reveal | drama | launch | irl | other`), never its result; `streamer`
  names who to watch. Neither can carry an outcome.
- **Exact label the implementer builds** (anticipation register, "where to look"):
  - **`streamer` present:** `` `${event.type} · ${streamer}` `` — e.g.
    `clutch · Co-streamer A`, `reveal · Original runner`.
  - **`streamer` absent** (optional on `Vantage` — e.g. the Just-Chatting mock
    vantage has none): fall back to the type alone — e.g. `drama`. Graceful, never
    blank, never the `narrative`.
  - "Top vantage" is the existing max-`lensScore` vantage (the same selection
    `topVantage` already drives the cut to) — reuse that helper, do not re-derive.
- **The rail stays a control.** Each channel remains a clickable `<button>` whose
  **accessible name is the new label**; `onSelect(eventId)` is unchanged. The label
  swap is cosmetic to the surf mechanic — only the queryable text changes.

## Consequences
- The on-screen leak closes: the rail describes where to look without revealing the
  outcome, consistent with the host's voice across every surface.
- **A test must prove** (on the §11 mock): every rendered rail label (a) renders no
  banned outcome token (e.g. "to win the round", "world record"), (b) does not render
  the raw `narrative`, (c) each channel is still a clickable control with the label as
  its accessible name so the surf flow holds.
- **Cascading test update (flag for the test-writer).** Existing M1 tests query
  channels **by `narrative`** — `channel-rail.test.tsx`, `channel-surf-shell.test.tsx`,
  and `App.test.tsx` find/click a channel by its narrative text. The new label breaks
  those queries; they must be updated to query by the new `type · streamer` label
  (or by role/name). This is expected churn from re-opening the M1 label choice, not a
  regression — but the click/surf behavior under test is unchanged. Sequence with the
  POLISH `aria-valuenow` nit on the same file so they do not collide.
- Spoiler-safety is now enforced at **two** layers: compile-time on `HostDirective`
  (ADR 0004) and test-proven on the rail surface (here). Future viewer-facing surfaces
  inherit the same rule: derive from SAFE fields, never render `narrative`.

## Alternatives considered
- **Scope no-spoiler to the host's voice only** (literal M2 DoD #5) — leaves the
  visible rail leak; contradicts the pro-creator / anti-spoiler moat (brief §5, §14).
  Rejected.
- **Sanitize/strip outcome tokens from `narrative` at render** — a runtime denylist is
  fragile (misses paraphrases) and keeps an outcome-bearing string on the surface.
  Deriving the label from SAFE fields makes the leak unrepresentable instead. Rejected.
- **A new spoiler-safe field on `PerceptionEvent`** (e.g. `safeLabel`) — speculative
  contract growth; `type` + `streamer` already carry enough for the label. Rejected
  (resist speculative fields — the seam stays minimal).
