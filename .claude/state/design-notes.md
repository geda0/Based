# Design notes — Based prototype · M4 · Two-level ranking + "while you were gone" digest — KICKOFF

> **STATUS: M4 KICKOFF — ready for the inner TDD loop.** This is the **LAST unmet brief Definition-of-Done
> item.** M0–M3, LV1, WDC, and WDC-D2 are all shipped/accepted (the navigator accepted the deployed WDC cut
> 2026-06-03: _"staging looks ok, the pause is shorter"_). M4 = brief **§12 DoD #1** ("App loads → 'while you
> were gone' digest plays in the host's voice") **+** the brief's signature **two-level ranking** (§4.3 — the
> REAL `eventScore` that has been an **M1/M2 placeholder** since the shell landed). It is **pure-FE, additive on
> the existing §6 contracts, no new external dep, no architect DESIGN needed** (verdict below). This file turns
> the M4 intent into layer-tagged, observable acceptance bullets, a first RED, and the TDD plan the orchestrator
> picks behaviors from.
>
> _(The WDC + WDC-D2 KICKOFFs that built/enlivened the watchable cut are SHIPPED + ACCEPTED — their design is
> condensed to a historical pointer at the bottom; see `backlog.md` for the accept records.)_

---

## M4 — WHY THIS FEATURE (the brief's last unmet DoD)

The whole prototype thesis is **the character earning its interruptions (silent ↔ active)** — and the brief's
§4.3 two-level ranking is *"why the host sounds natural"*: it speaks in exactly two beats — **what** is happening
(event rank) and **where** to look (vantage rank). Today:
- **Event rank is FAKE.** `App.tsx:16` builds the feed with `eventScore = e.heatDelta` (a placeholder since M1),
  and `App.tsx:50` re-applies `eventScore: event.heatDelta` per surfacing event. There is **no real ranker** — the
  `RankedFeed.events` "sorted desc by `eventScore`" contract (`contracts/index.ts:25`) is honored only because the
  mock happens to be authored heat-desc. The brief's §4.2/§4.4 signals (novelty, legibility, confidence tier) are
  **ignored** in ranking.
- **The "while you were gone" digest is ABSENT from the UI.** The §11 mock exports a `digest` string
  (`mocks/event-graph.ts:3`) — but `App.tsx:3` imports only `{ events }`. **The digest is never imported, never
  narrated, never shown.** So DoD #1 ("App loads → digest plays in the host's voice"; "the channel is never empty
  even at 4am") is **unmet** — the host opens cold, with no catch-up.

M4 closes both gaps with the smallest real implementation: a **pure, unit-testable ranker** (so `eventScore` is
genuinely computed from the signals, provably not a `heatDelta` no-op) and a **one-time spoiler-safe digest** the
host delivers on Start-watching, before the live feed surfaces anything. Vantage rank (the *where*) is **already
done** via `topVantage` / `lib/top-vantage.ts` — M4 adds the **event-level** rank (the *what*) and the digest.

## M4 — DONE vs WHAT THIS FEATURE ADDS

**DONE + shipped:** the §6 contracts (incl. the `RankedFeed.eventScore` field and the `HostDirective.action:
'digest'` member — both already in `contracts/index.ts`, just unused/placeholdered), the host loop (silent↔active,
spoiler-safe + silence-budget + cost-gated, `host-loop.ts` / `narrating-host-loop.ts`), the live Gemini voice +
`/narrate` path, the channel-surf shell + rail (consume feed order), within-event **vantage** rank (`topVantage`),
the watchable cut + the Start-watching gesture (WDC) + the lively cadence (WDC-D2). **The MISS:** the **event-level
`eventScore` is a `heatDelta` placeholder** and the **digest is unused in the UI**. **M4 adds exactly two things:**

1. **A REAL two-level ranking** — a pure `ranker` that computes `eventScore` from the event signals and sorts the
   feed desc; the App + rail consume the ranker's order.
2. **The "while you were gone" digest on load** — on Start-watching, the host delivers a one-time spoiler-safe
   catch-up (the `digest` + a tease of the top missed moments) before the live feed surfaces.

## M4 — FEATURE

Make the brief's **two-level ranking real** and deliver the **"while you were gone" digest** on load, both pure-FE
and additive on the existing contracts. The host loop's surfacing/cost-gating/spoiler logic, the live-voice/
`/narrate` transport, and the §6 contract shapes are **UNCHANGED** — M4 (a) replaces the placeholder `eventScore`
with a computed one (feeding the *same* `RankedFeed` the shell already consumes and the *same* `eventScore` the
host loop already reads), and (b) emits one new **digest** narration (reusing the *same* `HostDirective.action:
'digest'` the contract already declares and the *same* voice/speak path surfacing events use). Nothing downstream
of the contracts reshapes.

## M4 — ACCEPTANCE CRITERIA (layer-tagged, observable; each → one or more red→green cycles)

_Tags: **[TDD]** = a hermetic unit/component cycle drives it; **[qa/visual]** = qa-verifier / navigator confirms on
the running app (the hermetic suite can't judge "the digest sounds like a catch-up on load"). Suggested FIRST step =
the **ranker ordering proof** (#1) — pure, deterministic, highest-value, kills the "is this a no-op?" risk._

### 1 — The ranker is REAL: `eventScore` is computed from signals AND it provably reorders (the ordering proof, first RED)  — `[frontend]` **[TDD]**
- **[ ] [frontend] A pure ranker computes `eventScore` from the event signals and sorts the feed desc — and it
  REORDERS events differently from raw `heatDelta` in at least one case (NOT a no-op).** Given a new pure module
  `frontend/src/lib/ranker.ts` (e.g. `rankFeed(events): RankedFeed` and/or `scoreEvent(event): number`), when it
  ranks a set of events **whose `eventScore` order differs from their raw `heatDelta` order** (e.g. event B has a
  lower `heatDelta` than event A but higher `novelty`/`legibility`/a stronger `confidenceTier`, enough to outrank A),
  then `rankFeed(...).events` comes back sorted **desc by the computed `eventScore`** in the **ranker's** order — and
  a direct assertion shows that order is **NOT** the same as `[...events].sort(byHeatDelta)`. _(TDD: this is the
  load-bearing **ORDERING PROOF** — the brief §4.2/§4.4 say `eventScore` blends heat + novelty + legibility +
  confidence tier; the test must force a case where the blend reorders vs raw heat, so the ranker is provably more
  than `eventScore = heatDelta`. The exact weighting formula is the implementer's to choose to satisfy the test —
  keep it pure, deterministic, in `[0..1]`-ish, and documented; the brief gives the signals, not exact weights.
  **This is the recommended FIRST RED.**)_

### 2 — `eventScore` is a sensible blend of the signals (score-from-signals)  — `[frontend]` **[TDD]**
- **[ ] [frontend] `eventScore` rises with the positive signals and respects confidence tier — a higher-heat,
  higher-novelty, higher-legibility, higher-tier event scores at least as high as a strictly-weaker one.** Given the
  ranker, when it scores two events where one **dominates** the other on the signals (≥ on heat/novelty/legibility,
  better or equal confidence tier, strictly greater on at least one), then the dominant event's `eventScore` is
  **strictly greater**. _(TDD: a monotonicity/dominance property pins that the formula actually uses the signals
  meaningfully — not just heat with noise. Keep it a property over a couple of hand-built events, not a brittle exact
  number. Together with #1 this proves the ranker is real AND sensible.)_

### 3 — The App + rail consume the ranker's order (integration onto the seam)  — `[frontend]` **[TDD]**
- **[ ] [frontend] The App ranks the mock graph through the ranker (not the placeholder) and the rail/shell render
  in the ranker's `eventScore`-desc order.** Given `<App/>` over a fixture whose ranker order differs from heat order,
  when it mounts, then the feed it hands `ChannelSurfShell`/`ChannelRail` is the **ranker's** `RankedFeed` (events
  ordered by computed `eventScore` desc; the top channel + default vantage are the ranker's #1), and the host loop
  surfaces events scored by the ranker — i.e. `App.tsx:16` and `App.tsx:50` no longer use `eventScore = heatDelta`.
  _(TDD: extend the existing `App.test.tsx` (already decoupled from the demo mock via `vi.mock`, line 14 — WDC-D2) so
  its fixture has a ranker-vs-heat reorder, and assert the rendered top channel / first-surfaced event is the
  ranker's pick, not heat's. Keep the existing gesture-gating / surface→speak / cost-gating coverage intact — only
  the SCORE source changes from the placeholder to the ranker.)_

### 4 — The host emits ONE spoiler-safe digest directive on load, BEFORE any timeline event (the digest contract)  — `[frontend]` **[TDD]**
- **[ ] [frontend] On Start-watching, the host produces exactly one `digest` HostDirective FIRST — spoiler-safe,
  with no outcome token — before any `speak`/`cutTo` from the timeline.** Given the App/host-wiring with the digest
  on, when the user clicks "Start watching", then a single `HostDirective` with `action: 'digest'`, `spoilerSafe:
  true`, and a non-empty `utterance` (the catch-up line) is emitted **before** the first timeline-surfaced
  `speak`/`cutTo`, and the digest `utterance` contains **no banned outcome token** (anticipation-only, ADR 0006/0009
  — like the host's surfacing utterances). _(TDD: a unit/component test on whatever produces the digest (a small
  `lib/digest.ts` building the digest directive from `digest` + the top-ranked events, OR an App-level "on
  start, emit digest first" wiring). Assert: action='digest', spoilerSafe===true, ordered first, and a
  no-outcome-token check mirroring the host-loop/rail spoiler tests. If the digest is COMPOSED from event data,
  derive only from **safe fields** (type/streamer/the mock's anticipation-framed `digest` string) — **never** raw
  `event.narrative`.)_

### 5 — The digest is cost-gated: exactly one on load, not a storm  — `[frontend]` **[TDD]**
- **[ ] [frontend] The digest narrates exactly once on load — zero before Start-watching, one after, never
  one-per-event.** Given the App, when nothing is clicked, then no digest narration has fired; when Start-watching is
  clicked, then the digest narration fires **exactly once** (not per timeline event, not repeatedly), and the
  per-surface `/narrate`/live-voice gating on the timeline events is **unchanged** (still zero on idle / one per
  surface). _(TDD: a call-count assertion on the digest's narration path — extend the App cost-gating coverage. The
  digest is a single catch-up, not a new firehose; this is the digest's cost-gating invariant proof. If the digest
  `utterance` is canned-from-the-mock-`digest`-string (no LLM call), assert it's voiced once via the speak path; if
  it's LLM-narrated, assert exactly one narrate call for it.)_

### 6 — The digest plays in the host's voice on load (DoD #1 experience)  — `[frontend]` **[qa/visual]**
- **[ ] [qa/visual] On opening + Start-watching, the host delivers the spoiler-safe catch-up digest in its voice,
  THEN live moments surface ranked.** _(qa-only / navigator: open staging, click "▶ Start watching" — confirm the
  host first speaks a "here's what you missed" catch-up (audible, spoiler-safe, no outcome named), the channel is
  never empty, then the ranked live events surface as before. This is the DoD #1 experience the hermetic suite can't
  judge — "feels like a catch-up on load." Pairs with the navigator's watch-through.)_

### (watch-out) 7 — IF M4 touches predictive-staging timing: the `fireAtMs`(ms) ← `offsetSec`(sec) conversion is correct  — `[frontend]` **[TDD]** (conditional)
- **[ ] [frontend] (only if a `staging.fireAtMs` is produced) `HostDirective.staging.fireAtMs` (ms) is derived from
  `Vantage.offsetSec` (sec) with an explicit ×1000, proven by a test.** _(TDD: the off-by-1000 trap, carried from
  `progress.md`. M4's core (event ranking + digest) does NOT require predictive staging — the brief's predictive
  cut is a separate magic-trick (§5). **Only add this cycle if the digest/ranking work emits a `staging` field**;
  otherwise this is a documented landmine to avoid, not a required cycle. If you do touch it, convert ms←sec
  explicitly and test it.)_

## M4 — TDD-vs-QA SPLIT (so the team executes consistently)
- **[TDD] (the inner loop — RED→GREEN):** **#1 ranker ordering proof** (FIRST — pure, deterministic) · **#2
  score-from-signals** (dominance/monotonicity) · **#3 App/rail consume the ranker** (integration onto the seam) ·
  **#4 the digest directive** (produced-first, spoiler-safe, no outcome token) · **#5 digest cost-gating** (exactly
  one on load) · **#7 conditional** (ms←sec only if a `staging` field appears). **~5 core cycles + 1 conditional.**
- **[qa/visual] (ACCEPT):** **#6** the DoD #1 experience on the running app (the host opens with the spoiler-safe
  catch-up in its voice, then ranked live moments) — navigator / qa watch-through.

## M4 — SUGGESTED CYCLE ORDER (orchestrator — purest/highest-value first; ranker unit → integration → digest)
1. **[frontend] [TDD] Ranker ORDERING PROOF** (`ranker.test.ts` → `lib/ranker.ts`): events whose computed
   `eventScore` order ≠ raw `heatDelta` order → `rankFeed` returns the ranker's order, asserted **≠** the heatDelta
   sort. *(The cleanest first RED — pure logic, no React/timers; kills the no-op risk; gives the seam its real
   producer.)*
2. **[frontend] [TDD] Ranker score-from-signals** — dominance/monotonicity property (a strictly-stronger event
   scores strictly higher), pinning the formula uses heat + novelty + legibility + confidence tier meaningfully.
3. **[frontend] [TDD] App/rail consume the ranker** — extend the `vi.mock`'d `App.test.tsx` fixture with a
   ranker-vs-heat reorder; assert the rendered top channel + first-surfaced event are the ranker's pick (App.tsx:16
   + :50 stop using the placeholder). *(Cross-layer step: the contract producer (ranker) → the UI consuming it.)*
4. **[frontend] [TDD] Digest directive** — on Start-watching, emit exactly one `action:'digest'`, `spoilerSafe:true`,
   no-outcome-token `utterance`, ORDERED FIRST (before any timeline speak/cutTo). *(`lib/digest.ts` or App-level
   wiring; assert order + spoiler-safety.)*
5. **[frontend] [TDD] Digest cost-gating** — zero before the gesture, exactly one after; per-surface gating
   unchanged. *(Call-count tripwire.)*
6. **(conditional) [frontend] [TDD] `fireAtMs`←`offsetSec` ×1000** — only if a `staging` field is produced.
7. **CRITIC** (tdd-critic) after the ~5 cycles; feed items back.
8. **ACCEPT** — qa-verifier / navigator drive staging for #6 (the DoD #1 experience: catch-up digest on load in the
   host's voice, then ranked live moments); then PO sign-off vs this acceptance + the brief (DoD #1 met; two-level
   ranking real).

## M4 — DEFINITION OF DONE
1. **`pnpm verify` = 0** — the ranker unit tests (incl. the **ordering proof** + the score-from-signals property);
   the App/rail integration onto the ranker; the digest cycles (produced-first, spoiler-safe, cost-gated-one); the
   **host-loop unit tests + its 30s default UNCHANGED**; the **§6 contract shapes UNCHANGED** (the suite stays
   hermetic — no real iframe/socket/audio).
2. **tdd-critic = PASS** on the M4 cycles.
3. **qa-verifier / navigator confirm** the **DoD #1 experience** on the running app (#6): open + Start-watching → the
   host delivers the spoiler-safe catch-up digest in its voice → ranked live moments surface.
4. **PO sign-off** vs this acceptance + the brief — **DoD #1 met** ("App loads → 'while you were gone' digest plays
   in the host's voice; the channel is never empty even at 4am") **and the two-level ranking is real** (event rank +
   vantage rank, §4.3), provably not the `heatDelta` placeholder.
5. **Invariants proven on the digest path + re-asserted on the unchanged surfacing path** (see below).

## M4 — BASED INVARIANTS (this feature EMITS narration (the digest) → spoiler-safety + cost-gating MUST be PROVEN with tests on that path; the rest re-asserted — ADR 0003)
1. **Spoiler-safety — PROVEN on the digest path.** The digest emits a `HostDirective` narration, so it must carry
   `spoilerSafe: true` (compiler-enforced) **and** a test must prove the digest `utterance` names **no outcome
   token** (anticipation-only, ADR 0006/0009 — exactly like the host's surfacing utterances). The mock's `digest`
   string is anticipation-framed ("is one trick from a world record", "drama is building") — **keep it outcome-free**;
   if the digest is composed from event data, derive from **safe fields** (type/streamer), **never** raw
   `event.narrative`. _Proven by:_ the digest's spoiler test (#4) + the unchanged host-loop/rail spoiler tests. Every
   directive in the feature stays `spoilerSafe: true`.
2. **Cost-gating — PROVEN on the digest path.** Exactly **one** digest narration on load (zero before Start-watching,
   one after — never one-per-event, never a storm); the per-surface `/narrate`/live-voice gating on timeline events
   is **unchanged** (zero on idle / one per surface). _Proven by:_ the digest call-count tripwire (#5) + the
   unchanged LV1/narrate cost-gating tests.
3. **Silence budget — KEPT (logic unchanged).** The digest is the **catch-up on load**, not a new continuous speak;
   the host-loop's silence-budget logic and its 30s default are **untouched** (ranking changes WHICH event surfaces,
   not WHETHER the loop rate-limits). The host still earns its interruptions. _Carried by:_ the unchanged
   `host-loop.test.ts`.
4. **Official embeds only — KEPT, re-asserted.** Ranking **reorders** events but the player still renders each
   surfaced event's first-party `embedUrl` **verbatim** (+ the ADR 0008 `parent`); the digest touches **no** embed.
   No rehost, no rewrite. _Pinned by:_ the existing Player verbatim/parent tests (unchanged) + the integration
   asserting the cut still uses the vantage's real `embedUrl`.
5. **Secrets-from-env — KEPT, untouched.** M4 is pure FE (a ranker + a digest directive + App wiring); it touches no
   key/credential path. If the digest is LLM-narrated it reuses the **existing** server-side `/narrate` proxy (key
   stays env-only, M3 — no new secret path). _No new test needed unless a new server path is added (it should not
   be)._
6. **Contracts-as-seam — ENFORCED, additive.** **No §6 contract shape changes.** The ranker produces the
   **already-specified** `RankedFeed` (`events: Array<PerceptionEvent & { eventScore: number }>` sorted desc,
   `contracts/index.ts:24` — the field M1 placeholdered), and the digest reuses the **already-declared**
   `HostDirective.action: 'digest'` member (`contracts/index.ts:30`). The UI still consumes only
   `RankedFeed` + `HostDirective`. M4 fills two existing-but-unused contract affordances; it does not reshape the
   seam.

## M4 — ARCHITECT-NEEDED VERDICT: **NO — skip the architect DESIGN (additive on existing §6 contracts).**
- **Verdict: M4 does NOT add or change a §6 contract/seam → it can SKIP the architect** (per CLAUDE.md outer-loop
  step 2: "Skip for additive UI on existing contracts").
- **Why:** both halves of M4 fill **already-present** contract affordances:
  - The ranker's `eventScore` is **not a new seam** — `RankedFeed.events` is already typed
    `Array<PerceptionEvent & { eventScore: number }>` "sorted desc by eventScore" (`contracts/index.ts:24-26`); M1
    filled it with a placeholder, M4 fills it with a real computation. **Same type, same field, real producer.**
  - The digest is **not a new HostDirective shape** — `HostDirective.action` already includes `'digest'`
    (`contracts/index.ts:30`), with the existing `utterance` + `spoilerSafe: true` fields. M4 produces one; nothing
    new is added to the contract.
  - **No cross-layer change:** M4 is pure-FE (a ranker module + a digest directive + App wiring). No backend, no new
    external dep, no new endpoint (if the digest is LLM-narrated it reuses the existing `/narrate` proxy).
- **The ONE BUILD-time wiring choice (NOT a seam decision, no ADR):** whether the digest's `utterance` is voiced
  through the **same** live-voice/`speak` path the surfacing events use. **Recommended: yes, reuse it** — so the
  digest is audibly the host, with the same cost-gating/failure-silent behavior. This is an App-level wiring choice
  inside the existing seam, the orchestrator/implementer settles it at BUILD.
- **The STOP condition (when to bring in the architect after all):** if during BUILD the team finds it wants a **new
  `HostDirective` field** (e.g. a structured digest payload — a list of missed moments rather than a single
  `utterance` string) or a digest shape the current contract **can't carry**, **STOP and bring in the architect +
  record an ADR** before extending the seam. Not expected — the current contract already carries both `eventScore`
  and a `digest` action with an `utterance`. (If the navigator/PO wants the richer structured-digest payload as a
  product choice, that's a seam change → architect; the default here is the simpler `utterance`-string digest, which
  needs no architect.)

## M4 — CONSTRAINTS / NON-GOALS
- **Additive on existing contracts — do NOT reshape the seam or the loop.** Do **NOT** change
  `frontend/src/contracts/` shapes, `host-loop.ts` (incl. its 30000 default + its surfacing/spoiler/budget logic) or
  its unit tests, `narrating-host-loop.ts`'s cost-gating, or the live-voice/`/narrate` transport. M4 **adds** a pure
  ranker module + a digest directive + App wiring **above** the unchanged contracts and loop.
- **The ranker is PURE and unit-testable.** `lib/ranker.ts` is a pure function of the event signals — no React, no
  timers, no I/O. The ordering proof (#1) and the score-from-signals property (#2) are plain unit tests. The exact
  weighting is the implementer's to satisfy the tests; document it; keep it deterministic.
- **The ordering proof is load-bearing — the ranker MUST provably reorder vs raw `heatDelta`.** A ranker that merely
  re-derives `eventScore = heatDelta` (or any monotone function of heat alone) is a no-op and FAILS the intent —
  #1's reorder-vs-heat assertion is what guarantees the two-level ranking is real (brief §4.2/§4.4 blends heat +
  novelty + legibility + confidence tier).
- **The digest is spoiler-safe + cost-gated-one — both PROVEN, not assumed.** One digest narration on load, no
  outcome token. Derive any composed digest text from **safe fields** only.
- **The App tests are already decoupled from the demo mock (`App.test.tsx:14`, WDC-D2) — extend the fixture.** Don't
  re-couple to the live mock; add a ranker-vs-heat reorder + a digest case to the existing `vi.mock` fixture so the
  App's behavior stays pinned independent of the demo data.
- **The hermetic suite stays hermetic.** No test loads a real iframe / socket / audio. "The digest sounds like a
  catch-up on load" is **qa-verifier / navigator on staging** (#6), not a unit assertion.
- **Predictive staging is NOT required for M4.** The brief's predictive-cut magic trick (§5, "Watch X in 3…2…") is a
  separate behavior; M4 = event ranking + digest. Only touch `staging.fireAtMs` if the work happens to emit it — and
  then convert ms←sec×1000 explicitly + test it (#7).
- **OUT of scope for M4 (deferred follow-ups — named so they aren't lost):**
  - **Dynamic real-event sourcing / real heat** — that is **M5** (poll a platform API for a crude real `heatDelta`,
    inject one real event). M4 ranks the **scripted** mock graph (§7/§11) — the ranker is real, the events stay
    mocked.
  - **Predictive staging (the timed cut)** — the §5 magic trick is a separate, later behavior; M4 does not build it.
  - **DYNAMIC-LIVE-FETCH** (always-live channel fetch) and **KICK-VARIETY** (a live Kick/YouTube id) — separate
    backlog items behind M4.
  - **LV1-D2** (the ~10s per-line live-voice wake latency) — the digest may make the *first* line feel slow; that's
    the carried LV1-D2 latency item (warm-WSS), **not** M4's target. Note it; don't fix it here.
  - **Tier-aware hedging wording** — the §13 wording call (non-blocking; pre-external-demo). M4 narrates the digest +
    surfacing lines on the existing default prompt/hedging; the wording is a future external-demo polish.
- **Decision posture:** M4 introduces **NO new §13 escalation.** It rides on settled-for-now defaults (persona = one
  host; voice = the shipped Gemini Live, **accepted at the WDC demo** — `backlog.md` → Decisions needed → Voice
  identity CLOSED; rights/ToS = official Twitch embeds only, unchanged). The ranker weighting and the exact digest
  copy are **tuning/content the navigator can adjust**, not seam decisions.

## M4 — MILESTONE CHECKLIST
- [x] M0a — TDD harness bootstrapped + verified
- [x] M0b — contracts + event bus + mock source-graph feed  *(frontend)*  · critic PASS
- [x] M1  — channel-surf shell: player + rail, manual surf, official embeds only  *(frontend)*  · PO-accepted
- [x] M2  — character silent↔active + TTS + cut + client host loop  *(frontend)*  · PO-accepted
- [x] M3  — real Gemini narration: `/narrate` proxy + FE swap  *(backend → frontend)*  · PO-accepted · DoD #4
- [x] LV1 — live-voice host: `gemini-3.1-flash-live-preview`, browser-direct (ADR 0007 Amendment C)  *(backend → frontend)*  · ✅ accepted + shipped to staging
- [x] WDC — "Watchable demo cut": real Twitch streams + Start-watching gesture + product look + graceful embeds  *(frontend)*  · ✅ navigator-accepted on staging 2026-06-03 ("staging looks ok, the pause is shorter")
- [x] WDC-D2 — demo pacing: 7-event graph + 12s silence budget (livelier cadence)  *(frontend)*  · ✅ accepted (folded into the WDC accept)
- [ ] **M4 — two-level ranking + "while you were gone" digest (brief DoD #1 — the LAST unmet DoD)  *(frontend)*  ← IN FLIGHT**
- [ ] E2E — one DoD journey  *(playwright)*
- [ ] M5  — (stretch) thin real heat

---

# Design notes — prior KICKOFFs (SHIPPED + ACCEPTED — condensed to a historical pointer)

The full WDC ("Watchable demo cut": real Twitch streams + Start-watching gesture + product look + graceful embeds)
and WDC-D2 (demo pacing: a 7-event graph + a 12s App-level silence budget for a livelier ~15s cadence) KICKOFFs
that built and enlivened the watchable cut are **shipped and accepted** — the navigator confirmed the deployed
staging demo on 2026-06-03 ("staging looks ok, the pause is shorter"). Their accept records (DoD, invariants
re-asserted, residuals carried) live in `.claude/state/backlog.md` under the WDC and WDC-D2 entries and the "Done"
section. Key carry-forwards relevant to M4: the App tests are **decoupled from the demo mock** via `vi.mock`
(`frontend/tests/App.test.tsx:14`), so M4 can extend that fixture freely; the §11 mock now has **7 surfacing
events** (all heat ≥ 0.6, varied channels) **and exports an unused `digest` string** M4 will surface; the host
loop / §6 contracts / live-voice transport are **unchanged** by WDC/WDC-D2 and remain the seam M4 builds above.
