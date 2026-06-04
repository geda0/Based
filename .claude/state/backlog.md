# Backlog — Based prototype (owned by product-owner)

_Prioritized features. The PO selects the top unblocked item, writes `design-notes.md`
for it, and the orchestrator runs the inner TDD loop. Status: todo | in-progress |
done | blocked. Order follows the brief's milestones (§9); any re-prioritization is
logged with a one-line rationale. Acceptance criteria are layer-tagged and tied to
the brief's Definition of Done (§12) and invariants (ADR 0003)._

## Now (awaiting the navigator's watch-through)

### M4 · Two-level ranking + "while you were gone" digest — `[frontend]` — milestone: **M4 (brief DoD #1 — the LAST unmet brief DoD)** — priority: **NOW (the one remaining brief Definition-of-Done item; WDC accepted)** — status: **✅ BUILD-ACCEPTED (PO, 2026-06-04) — DoD bullets 1–5 + 7 DONE; bullet 6 (the qa/visual watch-through) PENDING the navigator's eye → then FULLY DONE = ALL brief DoDs complete**
  - **✅ BUILD-ACCEPTED (PO, 2026-06-04) — experience confirmation pending.** M4 is **code-complete, committed (`c699a1e`), and DEPLOYED to staging** (FE bundle byte-verified live: ranker `eventScore` + the digest action + the reworded spoiler-safe digest; `/health` 200; the digest carries no outcome token — the lone bundle "world record" is an internal `narrative` DATA field, never rendered, ADR 0009). **`pnpm verify`=0 re-confirmed at sign-off (frontend 46 / 15 files · backend 16 / 7 files · typecheck + lint clean).** **tdd-critic CONCERNS → all 3 items CLOSED** (voiced-digest spoiler guard + multi-event cost-gating tripwire + `Character` digest-render). **This mirrors how WDC was accepted** — the build/TDD/deploy DoD is signed off now; the single remaining bullet is the navigator's running-app watch-through.
    - **DoD bullet status (against `design-notes.md` → M4 DEFINITION OF DONE + ACCEPTANCE CRITERIA):**
      - **[x] (1) TDD/build — `pnpm verify` = 0** ✅ — ranker ordering proof + score-from-signals; App/rail consume the ranker (M2 `heatDelta` placeholder GONE); digest produced-first / spoiler-safe / cost-gated-one; host-loop 30s default + tests + §6 contracts UNCHANGED. _(`ranker.test.ts`, `App.ranking.test.tsx`, `App.digest.test.tsx`, `event-graph.test.ts`.)_
      - **[x] (2) tdd-critic = PASS** ✅ — CONCERNS raised then all 3 CLOSED (see above).
      - **[x] (3) The two-level ranking is REAL** ✅ — `lib/ranker.ts` `computeEventScore` blends heatDelta/novelty/legibility/confidenceTier; the ordering proof shows it reorders vs raw `heatDelta` (provably not a no-op); App + rail consume `rankFeed`. Brief §4.3 event-rank + the already-done vantage-rank (`topVantage`) → both beats real.
      - **[x] (4) The digest contract** ✅ — exactly one `action:'digest'`, `spoilerSafe:true`, no-outcome-token `utterance`, emitted FIRST on Start-watching before any timeline `speak`/`cutTo`.
      - **[x] (5) Based invariants proven on the digest path + re-asserted** ✅ — **spoiler-safety** (digest no-outcome-token + the reworded mock `digest`; rail still `type · streamer`, ADR 0009), **cost-gating** (zero before the gesture / exactly one digest after / per-surface gating unchanged), **silence budget** (host-loop logic + 30s default untouched), **official-embeds-only** (player renders `embedUrl` verbatim + ADR 0008 `parent`; digest touches no embed), **secrets-from-env** (pure FE; the digest reuses the existing `/narrate`/live-voice path — no new secret path).
      - **[x] (7) Build + DEPLOY DoD** ✅ — committed `c699a1e`, deployed to staging, bundle byte-verified live, `/health` 200. _(15 commits parked / NOT pushed — the navigator's push ask; see DEMO-PREP / next-phase below.)_
      - **[ ] (6) qa/visual — the DoD #1 experience on the running app — PENDING THE NAVIGATOR'S WATCH-THROUGH.** Open `https://d253xma588uo3l.cloudfront.net` → "▶ Start watching" → confirm the host delivers the spoiler-safe catch-up digest in its voice FIRST (audible, no outcome named, the channel is never empty), THEN the ranked live moments surface. **This is the one bullet the hermetic suite can't judge** ("feels like a catch-up on load") — it carries the same residual as WDC/LV1 (the navigator's eye/ear is the proof). _Once the navigator confirms, M4 = FULLY DONE — and with it ALL brief §12 DoD items are met (see "Feature-complete" below)._
  - **KICKOFF (history): `design-notes.md` → M4** (full layer-tagged acceptance, the suggested first RED, the TDD plan: ranker unit → integration → digest, and the carry-forward watch-outs). Opened at the WDC accept boundary (2026-06-03); built + deployed; build-accepted 2026-06-04.
  - **Why now (the brief's last unmet DoD):** M0–M3, LV1, WDC, WDC-D2 are all shipped/accepted. M4 is **brief §12 DoD #1** ("App loads → 'while you were gone' digest plays in the host's voice") **plus** the brief's signature **two-level ranking** (§4.3) — the REAL `eventScore` that's been an **M1/M2 placeholder** since the shell landed. Completing it closes the brief's Definition of Done.
  - **Two things this feature delivers (both pure-FE, additive on existing contracts):**
    1. **REAL two-level ranking** — replace the placeholder `eventScore = heatDelta` (`App.tsx:16` feed map + `App.tsx:50` per-event) with a **pure, unit-testable ranker** that computes `eventScore` from the event signals the brief names (heatDelta / novelty / legibility / confidenceTier — §4.2/§4.4), and sorts `RankedFeed.events` **desc by `eventScore`**. **Within-event vantage ranking by `lensScore` is already done** (`topVantage` / `lib/top-vantage.ts`) — M4 adds the **event-level** rank. The ranker drives **which event surfaces/ranks** (the rail order + which event the host narrates).
    2. **"While you were gone" digest on load** — on Start-watching, the host delivers a **spoiler-safe catch-up** (the mock's `digest` string — currently exported but **unused in the UI** — plus a tease of the top missed moments) **before** the live feed surfaces anything. The brief's "open it, get caught up" experience (§5, §9 M4; DoD #1: "the channel is never empty even at 4am").
  - **The placeholder being replaced (confirmed in-tree):** `frontend/src/App.tsx:16` `const feed = { events: events.map((e) => ({ ...e, eventScore: e.heatDelta })) }` and `App.tsx:50` `nloop.onEvent({ ...event, eventScore: event.heatDelta })`. The §11 mock (`frontend/src/mocks/event-graph.ts`) exports `digest` but `App.tsx:3` imports only `{ events }` — **the digest is never imported or rendered.** `HostDirective.action` already includes `'digest'` in its union (`contracts/index.ts:30`) but **nothing produces or consumes a digest directive yet.**
  - **Acceptance (full layer-tagged, observable bullets in `design-notes.md` → M4 ACCEPTANCE CRITERIA):** a pure `rankFeed`/`scoreEvent` ranker computes `eventScore` from the signals and sorts desc (**with an ORDERING PROOF — a case where the real ranker reorders events differently from raw `heatDelta`, so it's provably not a no-op**); the App + rail consume the ranker's order; on Start-watching the host emits **exactly one** spoiler-safe **digest** narration FIRST (before any timeline event); ≥2 timeline events still fire after. **On every path that emits a `HostDirective`/narration (incl. the digest), the Based invariants ride:** spoiler-safety (the digest names **no outcome token** — anticipation-only; every directive `spoilerSafe: true`), cost-gating (**one** digest, not a storm), silence budget (the digest is the catch-up, not a new firehose), official-embeds-only (unchanged — ranking/digest touch no embed), secrets-from-env (untouched — pure FE).
  - **First RED (suggested):** the **ranker ordering proof** — a pure unit test (`frontend/tests/ranker.test.ts` against a new `frontend/src/lib/ranker.ts`) feeding events whose `eventScore` order **differs from their raw `heatDelta` order**, asserting `rankFeed(...).events` comes back in the **ranker's** `eventScore`-desc order (not heatDelta order). Pure, deterministic, no React/timers — the cleanest, highest-value first behavior, and it directly kills the "is this a no-op?" risk. _(Full TDD plan + cycle order in `design-notes.md` → SUGGESTED CYCLE ORDER: ranker unit (ordering + score-from-signals) → App/rail integration onto the ranker → digest directive (produced-first, spoiler-safe, cost-gated one) → digest surfaces in the host's voice on load.)_
  - **Watch-outs (carried forward — TEST these here):**
    - **`fireAtMs`(ms) vs `offsetSec`(sec) off-by-1000 trap** — `HostDirective.staging.fireAtMs` is **ms**; `Vantage.offsetSec` is **sec**. If M4 touches predictive-staging timing (digest tease or a `staging` field), **convert explicitly and test it** (a unit asserting the ms←sec×1000 conversion). _(Carried from `progress.md` "Carry-forward risks".)_
    - **`eventScore` ORDERING proof (non-no-op)** — the ranker MUST be proven to reorder differently from raw `heatDelta` in at least one case (per the first RED above). `RankedFeed.events` "sorted desc by `eventScore`" is a doc-comment (`contracts/index.ts:25`) the ranker must **prove**, not assume. _(Carried from `progress.md` + the M4 Next entry.)_
    - **Digest spoiler-safety** — the digest line must contain **no outcome token** (anticipation-only, like the host's utterances; ADR 0006/0009). A banned-outcome-token assertion on the digest, mirroring the host-loop/rail spoiler tests. The mock's current `digest` string is anticipation-framed ("is one trick from a world record", "drama is building") — **keep it outcome-free**; if the digest is composed from event data, derive from **safe fields** (type/streamer), never raw `narrative`.
    - **Digest cost-gating** — exactly **one** digest narration on load (not one-per-event, not a storm). A call-count assertion (zero before Start-watching; exactly one digest narration after; the live `/narrate`/live-voice path still cost-gated per surface, unchanged).
  - **Architect needed? → NO (additive on existing §6 contracts; skip the architect DESIGN).** _Verdict + rationale below._ M4 reuses the **existing** §6 seam: the ranker produces the **already-specified** `RankedFeed` (`events: Array<PerceptionEvent & { eventScore: number }>` sorted desc — `contracts/index.ts:24`, the field M1 filled with a placeholder), and the digest reuses the **already-present** `HostDirective.action: 'digest'` member (`contracts/index.ts:30`). No new contract, no new HostDirective shape, no new seam, no cross-layer change (pure-FE; no backend, no new external dep). **So M4 is additive-on-existing-contracts → it can SKIP the architect** (per CLAUDE.md outer-loop step 2: "Skip for additive UI on existing contracts"). **One thing for the orchestrator to confirm at BUILD (not a seam decision):** whether the digest's `utterance` is voiced through the **same** live-voice/`speak` path the surfacing events use (recommended — reuse, so the digest is audibly the host) — a wiring choice inside the App, not a contract change. _(If the team finds it wants a NEW `HostDirective` field or a digest payload shape the contract can't carry, STOP and bring in the architect + an ADR — but the current contracts already carry both `eventScore` and a `digest` action, so this is not expected.)_
  - **DoD:** `pnpm verify` = 0 (the ranker unit tests incl. the ordering proof; the App/rail integration onto the ranker; the digest cycles — produced-first, spoiler-safe, cost-gated-one; the host-loop unit tests + its 30s default UNCHANGED); **tdd-critic PASS** on the M4 cycles; **qa-verifier confirms on the running app** the DoD #1 experience (open → the host delivers the spoiler-safe catch-up digest in its voice → then live moments surface, ranked); **PO sign-off** vs this acceptance + the brief (DoD #1 met; two-level ranking real). Invariants proven on the digest path (spoiler-safe, cost-gated one) + re-asserted on the unchanged surfacing path.
  - **Out of scope (defer — named so they aren't lost):** the **`/narrate` cost-gating + live-voice transport** stay UNCHANGED (the digest reuses them; don't reshape `host-loop.ts` / `narrating-host-loop.ts` / the live-voice path); **dynamic real-event sourcing / real heat** is **M5** (M4 ranks the **scripted** mock graph — the ranker is real, the events are still mocked per brief §7/§11); the **DYNAMIC-LIVE-FETCH** always-live channel fetch (below) and **KICK-VARIETY** (below) are separate; **LV1-D2** wake-latency (below) is separate (the digest may make the *first* line feel slow — note it, don't fix it here).
  - **Invariants:** **spoiler-safety** (the digest emits narration → PROVE no-outcome-token + `spoilerSafe: true` on the digest directive, alongside the unchanged host-loop/rail spoiler tests), **cost-gating** (PROVE exactly one digest on load — zero before gesture, one after; the per-surface `/narrate`/live-voice gating unchanged), **silence budget** (the digest is the catch-up, not a new continuous speak — the loop's budget logic is untouched), **official-embeds-only** (re-asserted — ranking reorders events but renders the same first-party `embedUrl` verbatim + ADR 0008 `parent`; the digest touches no embed), **secrets-from-env** (untouched — pure FE; no key/credential path).
  - **Depends on:** M0b contracts ✓ (the `RankedFeed`/`HostDirective` seam, incl. the `eventScore` field + `digest` action), M1 shell ✓ (rail consumes feed order), M2/M3 host loop + narrate ✓ (the digest reuses the speak/narrate path), WDC ✓ (the watchable cut + gesture-gating the digest fires after), WDC-D2 ✓ (the App tests are now **decoupled via `vi.mock` of the event-graph** — `App.test.tsx:14`, so M4's ranker/digest changes won't fight the timing-coupled App assertions; the fixture can be extended for ordering/digest cases). **Pure FE; no §6 contract change; no architect DESIGN.** UX-affecting → qa-verifier confirms the DoD #1 experience on green.

## 🎯 FEATURE-COMPLETE AGAINST THE BRIEF (2026-06-04)

**With M4 build-accepted + deployed, ALL of the brief's Definition-of-Done items (§12 #1–#6) are now BUILT and DEPLOYED to staging.** The prototype is **feature-complete against `BASED_PROTOTYPE_BRIEF.md`.** Mapping (brief §12 → what ships it):

| Brief §12 DoD | Shipped by | State |
|---|---|---|
| #1 App loads → "while you were gone" digest plays in the host's voice | **M4** | deployed (`c699a1e`); experience pending the navigator's watch-through |
| #2 ≥2 events fire over ~3 min; character silent → active each time | M2 + WDC-D2 (7-event graph, ~15s cadence) | accepted |
| #3 player cuts to the top-ranked vantage; host says the *what + where* line | M1 (vantage rank) + M2 (cut) + **M4 (event rank → the *what*)** | deployed |
| #4 host lines are LLM-generated live (not hardcoded) | M3 (`/narrate`) + LV1 (live Gemini voice) | accepted + shipped |
| #5 no spoiler leak — no outcome named before the cut | M2/M3 (host voice) + SPOILER-HARDENING/ADR 0009 (rail) | accepted |
| #6 user can manually surf without breaking the host | M1/M2 (manual surf coexists with the cut) | accepted |

**The one remaining gate to "fully done" is human, not engineering:** the navigator's M4 watch-through (bullet #6 — the catch-up digest in the host's voice on load) + the carried §13 audible/voice confirmation (already accepted-for-the-demo at the WDC watch-through). The engineering bar is green across the board (`pnpm verify`=0; tdd-critic PASS on every milestone). **The brief's core thesis — the character earning its interruptions (silent ↔ active), spoiler-safe, official-embeds-only — is fully realized and watchable.** What remains is all **beyond-the-brief** (E2E robustness, the M5 stretch, or demo-prep) — see "NEXT-PHASE DECISION" under Decisions needed.

### WDC-D2 · demo pacing — a lively, watchable host cadence (the host stays present, not asleep) — `[frontend]` — milestone: **navigator-prioritized (WDC liveliness follow-up, ahead of M4)** — priority: **DONE (navigator-accepted at the WDC staging watch-through, 2026-06-03)** — status: **✅ DONE / accepted (2026-06-03)**
  - **✅ ACCEPTED (PO, 2026-06-03 — at the WDC sign-off boundary).** The navigator watched the deployed WDC staging cut and confirmed verbatim: **"staging looks ok, the pause is shorter."** That accepts the WDC-D2 pacing fix — the dead-air gap the navigator originally flagged ("a really long silence, then it spoke again") is gone; the host now narrates at a livelier cadence (~every ~15s). **DoD met:** the enriched 7-event graph (all heat 0.63–0.95, ~15s apart, varied types/channels) + the App-level `silenceBudgetMs: 12000` shipped, the App tests were decoupled via a `vi.mock` fixture (`App.test.tsx:14`) and `event-graph.test.ts` pins the enriched liveliness invariants (≥6 events, every heat ≥ 0.6, ≤25s gaps, no `EXAMPLE_`, `player.twitch.tv/?channel=` shape); `pnpm verify`=0 (frontend 39 / backend 16); the host-loop 30s default + its unit tests UNCHANGED; deployed to staging (dev-ops `78d189e`); navigator confirmed the livelier cadence on the running app. **Invariants HELD** (host-loop logic UNCHANGED — WDC-D2 only tuned demo data density + one App config + test fixtures): cost-gating bounded (no storm), spoiler-safety (rail `type · streamer`, `narrative` never rendered — ADR 0009), official-embeds-only (first-party `player.twitch.tv` verbatim + ADR 0008 `parent`), secrets-from-env (untouched). **Residual carried (NOT a blocker):** **LV1-D2** (~10s per-line live-voice latency) — the orchestrator offered to warm the WSS connection if the navigator wants it snappier; **not requested** at the watch-through. Kept on the backlog (see "Next" → LV1-D2). _(Original KICKOFF + root-cause analysis retained below for history.)_

### WDC-D2 (history) · demo pacing KICKOFF — retained for the record
  - **KICKOFF: `design-notes.md` → WDC-D2** (full layer-tagged acceptance + the TDD-vs-data split). Filed from a navigator watch-through of the deployed WDC cut.
  - **Navigator feedback (verbatim, 2026-06-03 staging watch-through):** _"looks ok, vid plays an host speaks the 1st line, then a really long silence, then it spoke again."_ So the WDC experience **WORKS** (real video plays + the live Gemini host speaks) — the defect is that the **pacing is too sparse**: the host narrates ~twice, far apart, then goes quiet. For a *watchable* demo the host must stay active. This is a focused **liveliness fix**, NOT a redesign and NOT a new behavior — it tunes the demo's event density + the App's demo silence budget so fresh moments keep surfacing.
  - **Root cause (orchestrator code analysis, confirmed by PO in-tree):** the §11 demo mock (`frontend/src/mocks/event-graph.ts`) has only **3 events** at `ts` 1 / 45000 / 90000; only **2 clear** the `surfaceThreshold` 0.6 (event 3 is `heatDelta` 0.55), and the `host-loop` enforces a **30s `silenceBudgetMs`** (`host-loop.ts:14`, default) because `App.tsx:45` calls `createHostLoop()` with no opts. Net: the host speaks at ~12s and ~57s, then dead air. _(Compounding but SEPARATE: per-line wake latency ~12s — the `/narrate` round-trip + live-voice setup — that is the existing **LV1-D2**; noted as related, NOT this fix's target.)_
  - **Acceptance (full layer-tagged bullets in `design-notes.md` → WDC-D2 ACCEPTANCE):** a lively, watchable host cadence — fresh moments keep surfacing and the host narrates **roughly every ~15–25s across a ~2–3 min demo window**, **no dead-air gaps**; the host feels *present*, not asleep. **Invariants HOLD (re-asserted — the host-loop logic is UNCHANGED):** cost-gating stays **bounded / budget-gated** (a *tuned demo budget*, NOT a `/narrate` storm — assert bounded calls over the window, not a firehose), spoiler-safety (rail still `type · streamer`, captions safe — outcomes stay as data in `narrative`, **never rendered**), official-embeds-only (real first-party `player.twitch.tv` embeds verbatim + ADR 0008 `parent`).
  - **Build approach to record (the "quickest cut" follow-up — NOT a real event-simulation engine; that is M5):**
    1. **[data]** **Enrich the demo event-graph** — **~6–8 events spaced ~15–20s apart** over the demo window, **each `heatDelta` ≥ 0.6** (so each surfaces), **varied across the real reliably-live channels already wired** (rifftrax / 247jynxzi / caedrel247 / lirik_247), spoiler-safe narratives (outcomes stay in `narrative` as data, never rendered). Pure data in `frontend/src/mocks/event-graph.ts`.
    2. **[config]** **Tune the demo silence budget** — `App.tsx` passes `createHostLoop({ silenceBudgetMs: ~12000 })` so ~15–20s-apart events actually surface. **The loop's 30s DEFAULT and its unit tests stay UNCHANGED** — this is an App-level demo config, NOT a loop-contract change (the navigator can tune the exact ms).
    3. **[TDD / RED — the test-decoupling work]** **Decouple the App tests from the demo mock.** `frontend/tests/App.test.tsx` currently **hardcodes the mock's exact timing/heat** (e.g. _"exactly two surfaces"_, the `ts 45000` / `ts 90000` / `heatDelta 0.78` / `0.55` windows — see App.test.tsx lines ~351–381, ~431) so enriching the mock **WILL break it**. The App tests must drive a **controlled fixture** instead (e.g. `vi.mock('../src/mocks/event-graph', …)` with a fixed small fixture) so the demo mock is tunable freely. **`event-graph.test.ts`** then updates to assert the **enriched shape's INVARIANTS** (all `heatDelta` ≥ 0.6, the new N events, digest present) rather than exact values.
  - **TDD-vs-data split (so the team executes consistently):**
    - **[TDD] (the inner loop — RED→GREEN):** **(a)** the App-test decoupling — replace the mock-coupled assertions in `App.test.tsx` with a `vi.mock`'d fixture so the App's behavior (gesture-gating, surface→speak, drain-revert, cost-gating tripwire) is pinned **independent of the demo data**; **(b)** `event-graph.test.ts` gains the enriched-shape **invariant** assertions (all heat ≥ 0.6, ≥ ~6 events, spacing/window sane, digest present, no `EXAMPLE_`, Twitch shape) — a tripwire so the enriched mock can't silently regress below "every event surfaces."
    - **[data / config] (NOT a TDD cycle — straight edits, guarded by the invariant test above):** the **mock enrichment** (the ~6–8 events + ids/heat/ts — content) and the **`createHostLoop({ silenceBudgetMs })` tune** in `App.tsx` (one-line demo config). These are *made safe by* the `event-graph.test.ts` invariant tripwire, not driven by their own behavioral RED.
    - **Suggested FIRST step:** **the App-test decoupling RED ([TDD] (a))** — land the `vi.mock` fixture and migrate the mock-coupled App assertions onto it **first**, so the bar stays green and the team can then enrich the mock + tune the budget without fighting red App tests. (Do the `event-graph.test.ts` invariant update alongside the enrichment so the new shape is pinned as it lands.)
  - **DoD:** `pnpm verify` = 0 (App tests pass on the fixture; `event-graph.test.ts` asserts the enriched invariants; the host-loop unit tests + 30s default UNCHANGED); **tdd-critic PASS** on the decoupling cycles; **qa-verifier / navigator** confirm the lively cadence on the running app (the host narrates ~every 15–25s with no dead-air over a ~2–3 min watch); **PO sign-off** vs this acceptance + the product thesis (the host stays *present*). Invariants re-asserted: cost-gating bounded (no storm), spoiler-safety (rail/captions safe), official-embeds-only.
  - **Out of scope (defer — named so they aren't lost):** the **per-line wake latency** reduction (**LV1-D2** — keep the live-voice WSS open / pre-mint; an LV optimization, already filed below); **dynamic real-event sourcing** (**M5** — a real event-simulation engine; WDC-D2 is the quickest data/config cut, not that); the cosmetic **WDC-D1** title (already FIXED in the working tree — `<title>Based — your AI host for live discovery</title>` — queued for the next deploy).
  - **Invariants (re-ASSERTED, not re-proven from scratch — the host-loop logic is UNCHANGED, this only tunes data + one App config):** spoiler-safety (rail `type · streamer`, captions verbatim-safe, `narrative` never rendered — ADR 0009; the enriched narratives keep outcomes as data only), silence budget (still *enforced* — the host still earns each interruption; WDC-D2 lowers the **demo** budget to ~12s so ~15–20s events surface, the loop's own 30s default + tests untouched), cost-gating (still one `/narrate` + one live-voice session per surface; bounded over the window — assert NOT a storm), official-embeds-only (first-party `player.twitch.tv` verbatim + ADR 0008 `parent`), secrets-from-env (untouched — pure FE data/config).
  - **Depends on:** WDC ✓ (the watchable cut this enlivens — real channels already wired, gesture-gating in place). Pure FE; **no §6 contract change**, no architect DESIGN needed (additive data + one App config + test-decoupling on existing contracts). UX-affecting → qa-verifier / navigator confirms cadence on green.

### WDC · "Watchable demo cut" — real Twitch streams + "Start watching" gesture + light UI polish + graceful embeds — `[frontend]` — milestone: **navigator-prioritized (post-LV1, ahead of M4)** — priority: **DONE (navigator-accepted on staging, 2026-06-03)** — status: **✅ DONE / accepted (2026-06-03)**
  - **✅ ACCEPTED (PO, 2026-06-03).** The navigator watched the deployed WDC staging demo and confirmed verbatim: **"staging looks ok, the pause is shorter."** That accepts the Watchable Demo Cut end-to-end: **real video plays** (real 24/7 Twitch channels — rifftrax / 247jynxzi / caedrel247 / lirik_247, Kick→Twitch — `mocks/event-graph.ts`, no `EXAMPLE_*` survives), the **"Start watching" gesture** gates the feed/host + unblocks the AudioContext (kills the on-mount flood), the **product look** landed (dark theme, "Based" header+tagline, 16:9 player, host orb w/ glow + caption, styled channel cards w/ heat bars, CTA overlay — "not a dev tool"), the **"Based" title** (WDC-D1) is set, graceful embeds (real Twitch + no Kick = no crash), and — with the **WDC-D2 pacing fix** (folded in) — the host narrates at a livelier ~15s cadence ("the pause is shorter"). The orchestrator visually confirmed the product look + real RiffTrax LIVE video + clean console + the /narrate wake-path locally; the navigator confirmed the experience on staging. `pnpm verify`=0 (frontend 39 / backend 16); tdd-critic PASS on the WDC cycles; deployed to staging (dev-ops `22975c7` → WDC-D2 `78d189e`). **DoD #1–#4 met** (real video; host wakes/speaks/cuts; no app crash/flood; reads as a product with a face) **+ the engineering bar** (suite green, critic PASS, navigator confirmed). **Invariants HELD** (host loop / §6 seam UNCHANGED — WDC swapped data + added a gesture + presentation + a degrade guard): spoiler-safety (rail `type · streamer`, never `narrative` — ADR 0009), silence budget + cost-gating (unchanged loop, gated behind one click — can only reduce spend), **official-embeds-only** (first-party `player.twitch.tv` verbatim + ADR 0008 `parent`, no rehost), secrets-from-env (pure FE, untouched).
  - **Sub-items folded into this accept:** **WDC-D1** (stale `<title>SaaS App` → `Based — your AI host for live discovery`) — **DONE** (shipped); **WDC-D2** (demo pacing — the dead-air fix) — **DONE / accepted** (see its own entry above + the navigator's "the pause is shorter"). **Residuals carried (NOT blockers):** **LV1-D2** (~10s per-line live-voice latency — warm-WSS offered, not requested; kept on the backlog under "Next"); **WDC-W1** (AudioContext-flood-gone) — **CLOSED** (it was a qa-tooling-blocked watch-item; the navigator watched live with no flood complaint, so it's moot — see "Closed at the WDC accept" below); **§13 audible/voice-identity** — the navigator did not flag the voice, so the current Gemini Live voice is **ACCEPTED for the demo** (see Decisions needed → Voice identity, now CLOSED).
  - **KICKOFF: `design-notes.md` → WDC** (full layer-tagged acceptance) — retained below for history.
  - **Why now (navigator's read of the deployed app):** LV1 shipped a working engine + a real live Gemini voice, but
    the **deployed staging app reads as a dev scaffold** — FAKE `EXAMPLE_*` embeds show "offline"/404/crash, the UI
    is bare ("idle" + a player + an unstyled rail), and there's a console flood (most loudly `"AudioContext was not
    allowed to start"` — the feed/audio fire on mount with no user gesture). The navigator chose the **quickest
    watchable cut** over M4. This advances the brief's §1 thesis — **"the product is the character... a product with
    a face"** — by closing the smallest gap to "open the link, click once, and watch."
  - **Re-prioritization rationale (PO):** placed **ahead of M4 at the navigator's explicit choosing.** M4 (digest +
    real ranking) is still the one unmet brief DoD and is queued **immediately after** WDC, but a *watchable* demo is
    worth more right now than a second behavior on an unwatchable scaffold — the experience gap (no real video, no
    face, console flood) dominates the value gap. WDC is also tiny and low-risk: a **data swap + one gating gesture +
    presentational polish + a degradation guard**, with the host loop / §6 contracts / cost-gating / live-voice
    transport all **UNCHANGED**.
  - **Scope — 4 tight moves (layer-tagged; full bullets in `design-notes.md`):**
    1. **Real streams** `[frontend]` **[TDD]** (data guard) + **[qa/visual]** (it plays) — the §11 mock
       (`frontend/src/mocks/event-graph.ts`) references **real reliably-live Twitch channels** via official
       `player.twitch.tv` embeds (navigator-sourced 24/7 ids: rifftrax, 247jynxzi, caedrel247, lirik_247, jynxzi);
       **no `EXAMPLE_*` survives** (a substring tripwire). Invariant #5 holds by construction (first-party embeds,
       verbatim + ADR-0008 `parent`).
    2. **"Start watching" gesture** `[frontend]` **[TDD]** — one click that UNBLOCKS the `AudioContext` (kills the
       `"AudioContext was not allowed to start"` flood) AND starts the feed/host (host wakes **on the click**, not on
       mount). Clean "▶ Start watching" state before; live experience after. **The cleanest first RED.**
    3. **Light UI polish** `[frontend]` **[qa/visual]** (look) + **[TDD]** (idle/speaking stays legible) — the host
       as a **visible presence** (idle vs speaking legible, not bare text), a real player+rail+host layout, a styled
       rail (the spoiler-safe `type · streamer` labels). **NOT a redesign** — just "not a dev tool."
    4. **Graceful embeds** `[frontend]` **[TDD]** (our code) + **[qa/visual]** — an offline/unavailable embed
       degrades quietly in OUR app (no crash, no app-level flood; rail + manual surf keep working). Third-party
       iframe logs are out of our control.
  - **DoD:** navigator opens staging, clicks "▶ Start watching," sees **real video** + the host **wake, speak
    (Gemini), cut** between streams — no broken player, no app crash/flood, looks like a product with a face;
    `pnpm verify`=0; tdd-critic PASS; **qa-verifier confirms on the running app**; **PO sign-off**. (Full DoD +
    [TDD]-vs-[qa/visual] split in `design-notes.md` → WDC DEFINITION OF DONE.)
  - **First RED (suggested):** the **"Start watching" gesture** — _feed NOT started on mount + a clean start control
    present_ (purely our code, deterministic with an injected feed, and it directly kills the AudioContext flood).
  - **Invariants (re-ASSERTED, not re-proven — the host loop / §6 seam are UNCHANGED):** spoiler-safety (no new text;
    rail still `type · streamer`, never `narrative`), silence budget + cost-gating (unchanged loop, merely gated
    behind one click — can only reduce spend), **official-embeds-only (the load-bearing WDC invariant — first-party
    `player.twitch.tv` verbatim + ADR-0008 `parent`, no rehost)**, secrets-from-env (untouched — pure FE).
  - **Depends on:** LV1 ✓ (the shipped live-voice experience this makes watchable), M1 shell ✓, the navigator's
    confirmed real channel ids (in progress) for bullet 1. UX-affecting → qa-verifier on green (required).
  - **Out of scope (deferred follow-ups — see "Next"):** the "while you were gone" digest on load (**M4**, DoD #1);
    deep visual design; the **dynamic "current top live channel" fetch** (robust always-live for a shared link —
    static 24/7 ids can still go offline); real two-level ranking (**M4**); **Kick-platform variety** (a reliably-live
    Kick/YouTube id — WDC may point non-Twitch vantages at a real Twitch id instead). **No new §13 escalation** —
    rides on the settled persona/voice/rights defaults (the LV1 audible/voice-identity confirmation already pending
    with the navigator covers the voice).

## Recently accepted — LV1 (this boundary)
- **LV1 · Live-voice host** — **✅ RE-ACCEPTED on the BROWSER-DIRECT transport (2026-06-03, ADR 0007 Amendment C).**
  **Status: `accepted (browser-direct)` — SUPERSEDES the relay-based conditional accept below.** The transport
  pivoted (relay retired → the browser opens Google's Live WSS directly with a server-minted ephemeral token), so
  the prior conditional accept (relay topology) needed PO re-sign-off; this is it. **Verdict: RE-ACCEPT** — same
  conditional basis (audible/voice-identity confirmation is the navigator's ear at demo); the architecture is now
  **simpler** (no relay, no `@fastify/websocket`/`ws`, no ECS) and the experience is **qa-confirmed end-to-end with
  no relay**. No new concern.
  - **Re-accepted against the SAME LV1 DoD + acceptance criteria** (`design-notes.md` §LV1 DEFINITION OF DONE) —
    every criterion re-verified against the browser-direct tree:
    1. **Hermetic suite GREEN** — `pnpm verify`=0 re-confirmed at re-accept (**backend 16, frontend 37**, e2e 1
       skipped). The relay tests were removed WITH the relay (cycles 8–10 retired); the additive `/live/session`-
       returns-`setup` cycle and the rewritten narrator setup-first cycle (C6 #1–#2) are green. The 11 surviving
       LV1 acceptance bullets (mint ×4, FE narrator ×4, integration ×1, + the two C-delta cycles) all green; the 3
       relay bullets are retired-by-design with the transport (no longer applicable — browser owns the socket).
    2. **tdd-critic = PASS** carried (the prior two rounds' HIGH/MEDIUM items stay CLOSED — the C delta is a bounded
       transport swap that did not re-open them; the surviving cycles are unchanged in intent).
    3. **Based invariants re-proven on the browser-direct transport, in source + tests** (verified at re-accept):
       **secrets-from-env** — `live-token-client.ts` reads `GEMINI_API_KEY` from `process.env` only, it flows INTO
       the mint and never returns; only the short-lived single-use ephemeral `token` (`authToken.name`) + synthesized
       `expiresAt` come back; no-key→reject-no-spend; malformed→400-no-spend; long-lived key never in body/log/response
       (route + client tests). **The long-lived key is server-side-only under (a) exactly as under the relay** — only
       the short-lived ephemeral token now reaches Google directly (the same A1-accepted blast radius: one expiring
       single-use session). **cost-gating** — the FE opens the (now Google-direct) socket only inside `speak(...)`,
       zero on construction/idle, one per surfacing `speak`, closed on turn-drain (open/close per utterance) + the
       integration call-count tripwire — asserts on the injected open-edge regardless of what it connects to, so
       UNCHANGED by the transport swap. **failure-silent** — mint/connect failure fires `error` → `speak` rejects →
       host stays idle, cut kept. **spoiler-safety by construction** — narrator speaks `HostDirective.utterance`
       VERBATIM (no generation), constrained "speak only these exact words"; `responseModalities` exactly `["AUDIO"]`;
       the no-spoiler `systemInstruction` is now carried in the **server-built `setup` envelope the FE sends verbatim**
       (`buildLiveSetup` stays the single source of truth — `live.routes.ts` returns `{ setup: buildLiveSetup({ model }) }`;
       the FE holds zero setup-shape knowledge, so it cannot drift/omit the no-spoiler rule).
    4. **qa-verifier RE-VERIFIED the WIRED FE live on the browser-direct path (2026-06-03) — ALL PASS, no new
       defects.** The browser mints `POST /live/session → 200`, opens a WS **DIRECTLY to
       `generativelanguage.googleapis.com/…BidiGenerateContentConstrained?access_token=`** (the ONLY WS host — no
       relay, no `/live/relay`), sends **setup→clientContent**, receives **34 PCM frames**, plays them on a 24 kHz
       AudioContext, `speak()` resolves on drain, the host stays speaking the FULL ~8 s audio then idles (drain-coupled,
       **LV2-D1 confirmed live**); cut works (Twitch `parent` correct), **NO on-screen spoiler before the cut**, one
       utterance per surface (open/close per utterance), secrets-from-env holds (long-lived key server-side, ephemeral
       token redacted), no console errors. 2 of 3 qa-only bullets fully PASS (spoken line == on-screen safe utterance,
       no pre-cut spoiler; silence budget holds); the 3rd's pipeline is proven end-to-end with **audibility deferred to
       the navigator's ear** (the carried condition — see below).
    5. **No regression to M3** — `/narrate` text path, cost-gating, secrets-from-env, §6 contracts unchanged;
       `host-loop`/`narrating-host-loop`/`VoiceNarrator`/`audio-sink` untouched by the C delta (C4).
    6. **PO sign-off** — this entry (re-accept). _Supersedes the relay-based conditional accept retained below for
       history._
  - **What the browser-direct pivot changed vs the accepted relay version (all verified in-tree):**
    - **(C2.1)** `POST /live/session` now ALSO returns `setup: { setup: buildLiveSetup({ model }) }` (the fully-wrapped
      envelope, built from the same env model it reports) — additive to the A1 `{ token, model, expiresAt }` body.
    - **(C2.2)** the FE open-edge (`live-relay-client.ts`) opens **Google's** WSS directly (`GOOGLE_LIVE_WSS …
      BidiGenerateContentConstrained?access_token=`) — the only WS URL in the tree; `VITE_LIVE_RELAY_URL` dropped,
      `VITE_API_BASE_URL` (mint) + `VITE_LIVE_VOICE` (gate) kept; `binaryType='arraybuffer'` (LV1-D1 fix) kept.
    - **(C2.3)** the FE narrator (`live-narrator.ts`) now sends **`setup` FIRST then `clientContent`** on `open`
      (cycle-7 INVERTED — was "FE never sends setup"); audio routing / drain-coupled resolve / close-on-end /
      failure-silent / cost-gating all unchanged.
    - **(C5)** the relay is RETIRED — `live-relay.ts` + `live-relay.routes.ts` + `live-relay.test.ts` deleted, the
      `@fastify/websocket`/`ws`/`@types/ws` backend deps removed, `app.ts` registers only the mint
      (`registerLiveRoutes`). The mint (`/live/session`) is the only backend live surface.
  - **⚠ ACCEPTANCE CONDITION (CARRIES UNCHANGED from the prior accept — the one thing no agent can close):** _final
    **audible** confirmation is the navigator's at demo_ — does the streamed Gemini Live voice **sound** audible,
    intelligible, and like the host we want? This is the §13 **voice-identity** call (engine chosen; specific
    voice/persona-audio is the human's ear). The browser-direct pivot does **not** affect this residual — it is the
    same audio pipeline, the same `buildLiveSetup` AUDIO-only output. **Escalated below.** If the navigator finds the
    audio inaudible/wrong-voice at demo, re-open LV1 with a defect (voice/output-audio config — a tuning knob, NOT a
    seam change).

- **LV1 · Live-voice host (RELAY topology) — ⛔ SUPERSEDED by the browser-direct re-accept above (2026-06-03).** **✅ CONDITIONALLY PO-ACCEPTED (2026-06-03).** **Status: `in-progress → accepted`
  (conditional) → SUPERSEDED.** _Retained append-only for history — this was the relay-based accept; the transport
  pivoted to browser-direct (ADR 0007 Amendment C) and the entry above re-signs off on the new transport. The relay
  modules/tests/deps referenced below are RETIRED (C5)._ Native `gemini-3.1-flash-live-preview` audio over a backend WSS relay now voiced the host,
  replacing M2/M3's Web-Speech TTS — a transport swap behind the existing `speak` path (§6 contracts, host loop,
  cost-gating, and the `/narrate` text path UNCHANGED, proven by the integration bullet).
  - **Accepted against LV1 DoD (`design-notes.md` §LV1 DEFINITION OF DONE):**
    1. **All 12 unit-TDD bullets GREEN** — `pnpm verify`=0 re-confirmed at accept (**backend 21, frontend 37**;
       LV1 modules `live-setup`, `live-session`, `live-token-client`, `live-relay`, `live-narrator` all green).
    2. **tdd-critic = PASS** (two rounds: backend-mint, then relay+FE+integration; every HIGH/MEDIUM item CLOSED —
       route-secrets tripwire, model-override+env-leak, the drain-revert race + cost-gating tripwire).
    3. **Based invariants re-proven on the NEW transport, with tests** — **secrets-from-env** at BOTH client
       (`createLiveTokenClient`: env-only, no-spend-without-key, body-key-ignored, key-never-echoed) AND route
       (bogus body key ignored, long-lived key never in response/log, model-id from env); **cost-gating** (zero
       opens idle / one per `speak`, open/close per utterance) + the integration call-count tripwire (zero on idle /
       one per surface); **failure-silent** (relay/session failure → `speak` rejects → host stays idle, cut kept);
       **spoiler-safety by construction** (narrator speaks `HostDirective.utterance` VERBATIM, no generation; relay
       `setup` carries the persona + no-spoiler systemInstruction as defense-in-depth; `responseModalities` exactly
       `["AUDIO"]`).
    4. **qa-verifier — 2 of 3 qa-only bullets fully PASS; the 3rd's pipeline proven, audibility deferred to the
       navigator's ear (see condition).** qa drove the running local stack TWICE against the REAL Gemini Live API.
       PASS: **cut to vantage with NO on-screen spoiler before the cut** (DoD #5 on the audio path); **spoken line ==
       on-screen spoiler-safe utterance** (verbatim, no leaked outcome); **silence budget holds** (one utterance per
       surface; AUDIO-only; failure-silent). For the 3rd ("host is **AUDIBLY** voiced by Gemini Live") qa proved the
       **pipeline executes end-to-end** — 37 PCM frames decoded → `audio.play()` → scheduled on a 24 kHz AudioContext
       → `speak()` resolves on drain → per-utterance WS closes — and that the line is spoiler-safe, but **whether it
       SOUNDS audible / intelligible / like the right host is a human-ear judgment** (escalated, below).
    5. **No regression to M3** — `/narrate` text path, cost-gating, secrets-from-env, §6 contracts unchanged
       (integration bullet proves the loop/contract did not reshape; `host-loop` + `narrating-host-loop` untouched).
    6. **PO sign-off** — this entry.
  - **Live-validation strength (beyond the hermetic suite):** a live probe (`backend/scripts/`, throwaway) proved
    mint→WSS→setup→speak→PCM→turnComplete against the real account and **caught + fixed 3 ADR-0007 wire corrections**
    (auth via `?access_token=` query param not the `Authorization: Token` header; the `…Constrained` method; mint
    `name`→`token` + synthesized `expiresAt`) **and** a `@fastify/websocket` v8 registration bug — none of which the
    hermetic suite could see. qa then re-verified end-to-end on the running stack.
  - **⚠ ACCEPTANCE CONDITION (the one thing no agent can close):** _final **audible** confirmation is the
    navigator's at demo_ — does the streamed Gemini Live voice **sound** audible, intelligible, and like the host we
    want? This is the §13 **voice-identity** call (engine was chosen; the specific voice/persona-audio is the human's
    ear). **Escalated below.** If the navigator finds the audio inaudible/wrong-voice at demo, re-open LV1 with a
    defect (voice/output-audio config — a tuning knob, NOT a seam change).
  - **Closed defects (all FIXED + re-verified):**
    - **✅ LV1-D1 (was BLOCKER) — CLOSED.** Real-browser binary frames arrived as `Blob` → narrator's string-only
      branch dropped them → no audio, `speak()` never resolved, WS leaked. **Fix:** relay socket `binaryType='arraybuffer'`
      + narrator decodes `ArrayBuffer` frames (cross-realm-safe via `Object.prototype.toString`) + **a binary-frame
      regression test** (closing the hermetic-suite gap qa flagged — the old fake delivered only `JSON.stringify`
      strings). qa run 2 confirmed audio flows end-to-end; no regressions.
    - **✅ LV2-D1 — CLOSED.** `Character` `speakingMs` 4000→**30000** (a safety cap) so the App's **drain-coupled
      revert** governs the speaking window (host stays speaking for the full audio, falls idle on drain) — the
      load-bearing revert that LV1-D1 had masked is now re-verified live. _(Process note in `progress.md`: the base
      implementer overreached forcing this green; the orchestrator reverted the hacks surgically — no hacks remain;
      lesson = fake-timer flushes use `vi.advanceTimersByTimeAsync`, never raw `setTimeout`.)_
    - **✅ LV2-D2 — CLOSED.** Relay close-propagation added (`live-relay.ts`: browser WS close → upstream close, +
      reverse) so the upstream Google WSS no longer lingers on browser disconnect — a TDD'd relay-logic cycle (in the
      6 green `live-relay` tests). Pre-ECS resource-hygiene item, now closed.
  - **Carried forward (non-blocking — do NOT re-open the accept):**
    - **LV1-D2 (minor / cosmetic) — host wakes ~12 s after the event surfaces** (dominated by the real `/narrate`
      Gemini round-trip that runs before `setSpeakDirective`). The silent→speaking→idle transition is correct
      (DoD #2 holds); only the **wake latency** is worth a glance for demo snappiness. Filed under Next as a small
      polish item; not accept-blocking. _(Now that LV1-D1 is fixed, the drain-coupled revert is load-bearing and
      qa-re-verified — no longer just the `Character` timer.)_
    - **DEFERRED RELEASE-GATE (RELAY topology) — ⛔ MOOT / CANCELLED on the browser-direct pivot.** This was the
      ECS-Express-Mode infra gate for the relay; under topology (a) **there is no relay and no inbound WSS to host**,
      so the ECS standup is CANCELLED (saves ~$25–30/mo + the ½-day standup) and the whole-backend-migrate
      vs separate-relay-service sub-question is **closed/moot** (nothing needs a persistent-socket host). App Runner
      keeps only the plain-HTTP `POST /live/session` mint. **The LV1 staging release is now a plain deploy** (App
      Runner mint + S3/CloudFront FE with `VITE_LIVE_VOICE=1`, NO relay/ECS) — see Decisions-needed cleanup below.

## Next (prioritized)

### M4 · Two-level ranking + "while you were gone" digest — **MOVED TO "Now (in flight)"** (the canonical M4 entry + KICKOFF pointer are at the TOP of this file; design in `design-notes.md` → M4)
  - M4 is the in-flight feature as of the WDC accept (2026-06-03). The full prioritized entry — acceptance pointer,
    first RED (the ranker ordering proof), watch-outs, the **architect-not-needed** verdict (additive on existing
    `RankedFeed`/`HostDirective` contracts), and the invariants — lives at the **top of this file** under "Now (in
    flight)". This stub is left so a reader scanning "Next" finds the trail; it is no longer the canonical entry.

### DYNAMIC-LIVE-FETCH · always-live channels via a platform "currently-live" query — `[frontend|backend]` — milestone: **post-WDC robustness** — priority: **medium (the robust fix behind WDC's static-id expedient)** — status: **todo — DEFERRED from WDC (filed at the WDC KICKOFF)**
  - **Why:** WDC swaps in **static research-confirmed 24/7 Twitch ids** so the demo is watchable now — but a static id
    **can still go offline**, so a *shared* staging link is not guaranteed live at an arbitrary moment (WDC's bullet 4
    only degrades gracefully when that happens). The robust fix: **query a platform API for a currently-live channel**
    (e.g. a Twitch "get streams" call, server-side so any key stays in env) and target the mock's vantages at a
    genuinely-live id at load — so the link is **always live**, not just usually. _Out of WDC scope (WDC is the
    quickest cut); promote when "shared link is always live" matters (e.g. an external demo)._
  - **Goal:** the surfaced vantage is a channel that is **live right now**, fetched dynamically, not a static id.
  - **Invariants:** official-embeds-only (still first-party embeds rendered verbatim); **secrets-from-env** if the
    platform query needs a key (server-side, env-only — re-prove on the new path); cost-gating (one cheap query at
    load, not a poll firehose). **Confirm at DESIGN:** which platform API, whether a key is needed, where the query
    runs (a thin backend proxy mirrors M3's `/narrate` if a key is involved).
  - **Depends on:** WDC ✓ (the static-id watchable cut it hardens). Likely seam-touching if it adds a backend query →
    architect confirms + ADR if so. UX-affecting → qa-verifier on green.

### KICK-VARIETY · a reliably-live Kick (or YouTube) 24/7 id for embed-platform diversity — `[frontend]` (data/curation) — milestone: **post-WDC demo-prep** — priority: **low (demo-prep / variety)** — status: **todo — DEFERRED from WDC (filed at the WDC KICKOFF)**
  - **Why:** WDC may point the non-Twitch (Kick/YouTube) vantages at a **real Twitch id** rather than block on
    sourcing a reliably-live Kick id (Kick's `EXAMPLE_JC` is the known crash/404 source). Restoring genuine
    **embed-platform variety** (a live Kick or YouTube channel) — so the demo shows the multi-platform surf the brief
    describes (§1: "Twitch, YouTube, Kick, TikTok") — is a deferred content/curation call. **Pure data** once a
    confirmed-embeddable, ToS-compliant, reliably-live id is found. Official embeds only (the settled Rights/ToS
    invariant). _Out of WDC scope (don't block the watchable cut on sourcing a live Kick id)._
  - **Depends on:** WDC ✓. Pure data + the §13 Rights/ToS posture (already settled: official embeds only).

### DOC-RECONCILE · align ADR 0007 / design-notes / backlog to topology (a) browser-direct — `[docs]` (architect) — priority: **low (housekeeping, non-blocking)** — status: **todo (filed at the LV1 browser-direct re-accept)**
  - **Why:** the code is now topology (a) browser-direct (ADR 0007 Amendment C — relay RETIRED, ECS CANCELLED), but
    the ADR 0007 **body §1–§8 + Amendments A1/A2/B still describe the relay as the chosen topology** (append-only, so
    "C wins" is stated but the body reads relay-first), and `design-notes.md` §FEATURE / SUGGESTED CYCLE ORDER /
    parts of MILESTONE CHECKLIST still narrate the relay build. **No code or test impact** — purely doc hygiene so a
    cold reader isn't misled. **Owner: architect** (owns ADRs/seams). _Scope:_ make Amendment C the lead/canonical
    topology pointer; mark every relay/`Authorization: Token`/`@fastify/websocket`/ECS reference in ADR 0007 body +
    design-notes + this backlog as **historical/superseded** (the relay cycles 8–10, A2 ECS, B1/B4's "gated on B2"
    are all closed). PO will fold the design-notes pass into the **M4 KICKOFF** rewrite (design-notes is replaced
    per-feature anyway); the ADR 0007 body pass is the architect's. **Do NOT re-open the LV1 accept** — docs only.

### LV1-D2 · host wake latency — shave the ~12 s wake (cosmetic / demo-snappiness) — `[frontend]` — priority: **low (demo-prep)** — status: **todo (carried forward from the LV1 re-accept — NON-blocking)**
  - **CARRIED FORWARD unchanged across the browser-direct pivot** (the wake latency is dominated by the `/narrate`
    text round-trip, which is untouched by the transport swap; if anything browser-direct removes a relay hop so it
    is no worse). On a surfaced event the host wakes ~12 s late, dominated by the real `/narrate` Gemini round-trip
    that runs **before** `setSpeakDirective`. The silent→speaking→idle transition itself is correct (DoD #2 holds);
    only the wake latency reads as sluggish for a demo. _Possible angles (DESIGN if picked):_ overlap/prefetch the
    `/narrate` call, or surface the cut first and let the voice catch up. **Do NOT re-open the LV1 accept** — this is
    a polish item. Worth glancing before any external demo (couples with the §13 audible/voice-identity confirmation).

### LV1 · binary-frame regression test — already landed (record only) — `[frontend]` — status: **done (folded into the LV1-D1 fix)**
  - The hermetic gap qa flagged (the old fake relay delivered only `JSON.stringify` string frames, so the
    string-only narrator branch passed while real-browser `Blob`/`ArrayBuffer` frames were dropped) is **closed**:
    the LV1-D1 fix added a binary-frame regression test feeding an `ArrayBuffer` frame. Recorded here so it isn't
    re-filed; no further action.

### LV1 · Live-voice host — `gemini-3.1-flash-live-preview` over the WebSocket Live API (native streaming audio) — `[backend]`→`[frontend]` — milestone: **post-M3 (navigator-chosen)** — priority: **DONE-conditional (see "Recently accepted — LV1")** — status: **✅ conditionally accepted 2026-06-03 (green bar + invariants + qa pipeline; audible/voice confirmation = navigator at demo) · staging deploy infra-gated (ECS — RELEASE-phase, NOT an accept gate)**
  - **KICKOFF written (PO, 2026-06-02):** the full layer-tagged acceptance is now in `design-notes.md` (this
    sketch below is retained as the rationale record). **12 unit-TDD bullets** (backend mint ×4 incl.
    secrets-from-env; relay/setup ×3 incl. the pure `buildLiveSetup` builder, `Authorization: Token` + setup-once,
    forward/pipe; frontend `VoiceNarrator` ×4 incl. failure-silent + cost-gating; integration ×1) + **3 qa-only
    bullets** (audibly Gemini Live; spoken == on-screen safe utterance / no pre-cut spoiler; silence budget holds).
    **First RED = the pure `buildLiveSetup(...)` setup-frame builder `[backend]`.** Transport/socket/`AudioContext`
    are STUBBED in the suite. **It is a transport swap behind the existing speak path — host loop, cost-gating, §6
    contracts, and the `/narrate` text path are UNCHANGED.**
  - **Rationale for sequencing (PO, 2026-06-02):** placed **ahead of M4** at the navigator's choosing.
    It directly advances the brief's §1 thesis — "a host with a face" / a *live conversation* — by
    replacing the robotic Web Speech voice with real streamed Gemini audio; it makes the existing
    demoable loop (M3) feel genuinely alive rather than adding a second behavior (M4 ranking/digest,
    which is still high-value and queued immediately after). It is also the natural moment to **resolve
    the §13 "voice identity" decision** (Web Speech was only ever the settled-for-now default). Lower
    surface area than M4's two-level ranking, and the narration seam is already injectable from M3, so
    the swap is contained — a good next step. _If the live audio integration proves heavy/uncertain,
    M4 (pure-FE, no new external dep) is the fallback-first item — re-sequence and log here._
  - **Goal:** give the host a **real voice** — native **streamed audio** narration from
    `gemini-3.1-flash-live-preview` over the **WebSocket Live API**, replacing the one-shot text
    `/narrate` + `window.speechSynthesis` (Web Speech) path. The host's lines arrive as low-latency
    streamed speech in a deliberate voice instead of the browser's robotic TTS; this is also the
    **foundation for a conversational host** (the Live API is bidirectional — brief §1 "a product with
    a face", §8 voice). **Resolves the §13 "voice identity" decision** (see Decisions needed — this is
    the gate that was deferred to "the first external demo").
  - **Why now / product fit:** M3 proved the host can speak a live, spoiler-safe, tier-hedged LLM line —
    but in a flat Web Speech voice. The voice is the most visible gap between "ranked list with TTS" and
    "an AI host you'd lean back and watch." This is the smallest feature that closes that gap on the
    already-demoable M3 loop.
  - **Scope sketch (architect to confirm/own at DESIGN — seam re-opens):**
    - **Re-open the narration seam.** Today: FE `narrate-client` → backend `POST /narrate` (one-shot
      HTTP) → `{ utterance }` text → FE `speak()` (Web Speech). New: a **bidirectional WSS session** to
      the Gemini Live API (key still **server-side** — the browser must never hold `GEMINI_API_KEY`, so
      the backend either proxies the socket or mints a short-lived/ephemeral session credential; architect
      decides the topology and records it in an ADR).
    - **Audio pipeline replacing `speak()`.** The M2 `speak(text)` Web Speech path is replaced by an
      **audio-playback path** that consumes the streamed PCM/audio frames from the Live session (Web
      Audio API). The `idle`/`speaking` character states still drive off the same `HostDirective` stream;
      `speaking` is now gated on **audio playing** rather than `speechSynthesis` events.
    - **Contained swap.** The `gemini-client` / `narrate-client` seam is **already injectable** (M3), and
      `speak()` is already an abstracted interface (M2) — so the character/player and the host loop do
      **not** reshape; only the *transport + audio source* change behind those interfaces. The cut still
      renders `cutToVantage.embedUrl` verbatim.
  - **Invariants (this path emits narration → MUST re-prove with tests — ADR 0003):**
    - **secrets-from-env** — `GEMINI_API_KEY` stays server-side; the **browser never receives the raw key**
      (architect's WSS topology must preserve this — proxy or ephemeral token, key env-only, never in a
      response/log/client bundle). The highest-risk invariant for this milestone (a browser WSS naively
      done would leak the key) — call it out explicitly at DESIGN.
    - **cost-gating** — the live audio session opens/streams **only on a surfacing event** (heat-gated),
      never on idle/timer; a session must not stay open streaming continuously (mirror M3's call-gate +
      D1's "no storm" — assert bounded session opens, not a persistent firehose).
    - **silence budget** — idle stays the default; a failed/empty audio session **degrades to silence**
      (no forced noise — carry M2/M3's failure-silent guard onto the audio path).
    - **spoiler-safety** — the streamed line is still spoiler-safe + tier-hedged at the **prompt**
      (ADR 0006 — the audio is just a different rendering of the same prompted line; the prompt remains
      the control); every `HostDirective` stays compiler-enforced `spoilerSafe: true`.
    - **official-embeds-only** — unchanged (the audio path never touches embeds).
  - **Acceptance (sketch — architect + PO to finalize the layer-tagged, observable bullets at DESIGN;
    Gemini Live is STUBBED in the suite — assert on session-gating, the env-key/topology guard, audio
    wiring, and failure-degrades-to-silence, never on live audio quality):**
    - `[backend]` the WSS narration endpoint/credential path reads `GEMINI_API_KEY` from **env only** and
      never returns/logs it nor exposes it to the client (secrets-from-env, re-proven on the new transport).
    - `[frontend]` a session opens **only on a surfacing event** (zero on idle, bounded per surface —
      cost-gating; the D1 regression instinct carried to sessions).
    - `[frontend]` on a surfacing event the host's `speaking` state is driven by **streamed audio playing**
      (the new audio path), not Web Speech; idle resumes when the audio ends (silent↔active preserved).
    - `[frontend]` on a session **failure/empty stream**, the host **stays silent** (no forced noise) and
      the player may still cut (silence-budget spirit, carried from M3).
  - **DoD touchpoints:** keeps DoD #2/#3/#5/#6 (silent↔active, cut, no-spoiler, manual-surf) and makes
    DoD #4 (LLM-generated live) *audibly* live; does not regress M3.
  - **Depends on:** M3 ✓ (the injectable narrate seam + the abstracted `speak()` it leaves clean). **MUST
    NOT START until architect confirms the seam + records an ADR** (new WSS topology + audio pipeline; the
    secrets-from-env-over-WSS topology is the load-bearing design call). UX-affecting → qa-verifier on green.
  - **Confirm at DESIGN/build time:** the exact `gemini-3.1-flash-live-preview` model id, the Live API WSS
    endpoint + audio frame format, and Google's guidance on **server-side key handling for browser clients**
    (proxy vs ephemeral token) — against Google's docs (ADR 0003 note); wire model id via env, don't hardcode.

### Staging demo-quality / embed follow-ups — surfaced by the navigator's staging screenshot (2026-06-02, https://d253xma588uo3l.cloudfront.net)

_Filed for team awareness from a live STAGING screenshot. **None block LV1** (LV1 proceeds in parallel — it
swaps the narration transport/voice, not the embed path). The structure works on staging: app runs, host shows
**"idle"** (correct default), the rail renders the 3 mock channels with heat bars, the player area mounts.
The two **demo-blockers** the navigator prioritized ("fix embeds first") — EMBED-TWITCH-PARENT (embed playback
fails) and SPOILER-HARDENING (on-screen spoiler leak) — are now **FIXED (local, green)** → moved to **Done**.
**⚠ Both are local-only — NOT yet committed/deployed; they MUST NOT be pushed until the CI `GEMINI_MODEL`→SSM
gap is fixed (see "Deploy dependency" below), since a push auto-triggers CI which would regress M3's live
narration on staging.** The remainder below is coordinated demo-prep. Severity/ownership noted per item. PO
will not pick these ahead of LV1 unless the navigator re-prioritizes for a demo date._

- **⚠ DEPLOY DEPENDENCY (blocks shipping the two fixes — record + surface to navigator).** EMBED-TWITCH-PARENT
  and SPOILER-HARDENING are **fixed locally and green** (`pnpm verify`=0, 25 FE tests) but **NOT committed or
  deployed**. **They must NOT be pushed yet:** a push **auto-triggers CI**, and CI currently re-ships the wrong
  `GEMINI_MODEL` (the **open CI `GEMINI_MODEL`→SSM gap**), which would **regress M3's live narration on staging**.
  So these embed/spoiler fixes should **ride with the LV1 release** (LV1 needs the CI fix anyway) **or a dedicated
  patch deployed only AFTER the CI `GEMINI_MODEL`→SSM gap is fixed**. **Sequencing:** CI fix → then ship these +
  LV1. Until then they stay local. (Orchestrator: surface to navigator + dev-ops; this is a release-gate, not a
  PO feature gate.)

- **PLACEHOLDER-EMBEDS · swap `EXAMPLE_*` placeholders for real, confirmed-embeddable channel ids** — `[frontend]` (data/curation) — priority: medium (demo-prep) — status: todo — _**UNBLOCKED by EMBED-TWITCH-PARENT** (now that the Player appends `&parent=<host>`, real Twitch ids will actually render) — remaining gate is the §13 Rights/ToS content call_
  - **Known issue, reconfirmed on staging.** The §11 mock uses `EXAMPLE_*` placeholder channel ids that aren't
    real streams, so embeds blank-render / 404 (expected since M1 — see Rights/ToS in Decisions needed). The
    staging screenshot shows this concretely: `GET kick.com/api/v2/channels/EXAMPLE_JC/playback-url 404` +
    Kick's own internal "Playback URL not found" error (Kick's player is a third-party React-Router app — **that
    error is from the THIRD-PARTY embed, not our SPA**), from `frontend/src/mocks/event-graph.ts:70`
    (`player.kick.com/EXAMPLE_JC`). The Twitch `EXAMPLE_A`/`EXAMPLE_RUN` channels are likewise fake.
  - **Now purely a content/curation call.** EMBED-TWITCH-PARENT (✓ Done) means the Player now appends the required
    `&parent=<host>`, so a **real Twitch channel will render**. The only remaining work is picking real,
    confirmed-embeddable, ToS-compliant ids — a **content/curation call, not a code change**. Resolve the §13
    Rights/ToS gate (official embeds only) and swap the `EXAMPLE_*` mock ids.
  - Goal (demo-time): the rail's channels render **live** official embeds end to end (real id + the Twitch
    `parent` now appended), proving the channel-surf mechanic on actual streams.
  - Depends on: §13 Rights/ToS decision (real ids). **EMBED-TWITCH-PARENT no longer a dependency — it's Done.**
    Pure data once the Rights/ToS gate is decided.

- **POLISH · critic nits (M1 + M2 + M3)** — `[frontend|backend]` — priority: low — status: todo
  - Non-blocking tdd-critic nits; do opportunistically (e.g. alongside M4 work). No product impact.
    The M3 #3 (vantage dedup) + #4 (seam tripwire) nits are folded in here (last two entries).
    - **(M1)** Drop the redundant `aria-valuenow` on the heat `<meter>` (`channel-rail.tsx`) — the `<meter>`
      already exposes its value natively. _(Note: `channel-rail.tsx` was just edited by SPOILER-HARDENING — the
      label now uses `topVantage`'s `streamer`; re-confirm the current line for the `<meter>` before editing.)_
    - **(M1)** Give the click→switch test its own independent `max lensScore` guard (today it leans on the load
      test's shared `topVantage`).
    - **(M2-a)** Delete the stale **compiled `.js` test artifacts** in `frontend/tests/` (`*.test.js`, `setup.js`)
      left by the old `tsc -b`, and **gitignore `frontend/**/*.js`** so they can't reappear. Coordinate with the
      navigator's build/gitignore work (the `build` script is already `tsc --noEmit && vite build`, so nothing
      re-emits these — they're just stale).
    - **(M2-b)** Fix the cosmetic React `act()` warning in `App.test.tsx`'s wake test; also that test's no-`act`
      timing coupling is a bit fragile — make its timing assertion robust (it shouldn't depend on incidental
      scheduling).
    - **(M2-c / M3 · tdd-critic #3) — PARTIALLY DONE.** `topVantage` (max-`lensScore` vantage selection) has now
      been **extracted to the shared helper `frontend/src/lib/top-vantage.ts`** (done as part of SPOILER-HARDENING,
      which needed the safe `streamer` field — the rail now calls it). **Remaining trim:** confirm/migrate the
      other copies onto the shared helper — `host-loop.ts` (inline `reduce`) and M3's `narrating-host-loop.ts`
      **may still hold local copies**; verify and trim so `lib/top-vantage.ts` is the single source of truth.
      _(Low-priority/no-product-impact — do opportunistically, ideally folded into the #4 seam-tripwire pass or
      M4 ranking work which also touches vantage selection.)_
    - **(M3 · tdd-critic #4 — seam tripwire, low)** Add **one** cheap backend test that feeds a
      `NarrateInput`-shaped object (the FE client's request type) through `narrateRequestSchema.safeParse`
      and asserts it passes — a tripwire against FE↔BE seam drift (the two restatements of the §10 safe-input
      list, ADR 0006, drift only if changed without review). Not accept-blocking; fold into POLISH (or do it
      in the #2 cap cycle since both touch `backend/src/modules/narrate/`).
  - _(M4 promoted to the TOP of Next — see the "M4 · Two-level ranking + digest" entry above; this duplicate
    removed at the LV1 accept boundary so M4 has one canonical entry.)_
- **WDC-QA findings (filed by qa-verifier, 2026-06-03 — staging accept-gate pass)** — `[frontend]` — status: todo
  - **WDC-D1 (low / cosmetic) — stale `<title>SaaS App</title>` on the deployed page.** The deployed
    `https://d253xma588uo3l.cloudfront.net/` `index.html` still ships the Vite scaffold default
    `<title>SaaS App</title>` (and the browser tab/window reads "SaaS App"), not "Based". The in-app header
    wordmark is correctly "Based", but the document title is a scaffold leftover — minor polish gap against the
    "reads as a product, not a dev tool" intent (design-notes WDC #3). _Repro:_ `curl -s https://d253xma588uo3l.cloudfront.net/`
    → `<title>SaaS App</title>`; or open the URL and read the tab title. _Fix:_ set `<title>Based</title>` in
    `frontend/index.html`. Not accept-blocking.
  - **WDC-W1 (watch-item) — AudioContext-flood-gone — ✅ CLOSED (2026-06-03, at the WDC accept).** _Was a
    qa-tooling-blocked watch-item, not a defect._ The gesture-gating fix is present in the shipped build (`App.tsx`:
    feed only starts when `started` flips true via the "▶ Start watching" click; the live `AudioContext` is created
    lazily on the first post-gesture `speak()`). qa could not drive the live console (both Chrome MCP bridges were
    down), so it was filed as a watch-item for the navigator's eye. **Now moot:** the navigator watched the deployed
    cut live ("staging looks ok, the pause is shorter") and **raised no console/flood complaint** — and the
    orchestrator had already confirmed a clean console locally via Preview MCP. The flood is gone in practice;
    nothing left to watch. **CLOSED.**
- **E2E · One DoD journey** — `[e2e]` — status: todo
  - Goal: Playwright journey covering brief §12 end to end (load→digest→events→cut→surf,
    no spoiler). Enable `webServer` in `e2e/playwright.config.ts`. Keep e2e count ≤2.
- **M5 (stretch) · Thin real heat** — `[frontend|backend]` — status: todo
  - Goal: poll one platform API for a crude real `heatDelta`; inject one real event.

## Done
- **EMBED-TWITCH-PARENT · Twitch embeds get the required `&parent=<host>`** ✓ (PO-accepted 2026-06-02 ·
  architect-designed · TDD'd) — **demo-blocker resolved (local).** The Player now appends Twitch's required
  `parent=<window.location.hostname>` **only** for `player.twitch.tv` URLs (so it's environment-correct at
  runtime — CloudFront host on staging, `localhost` on dev — and Twitch no longer `[NoParent]`-fails);
  **non-Twitch (YouTube/Kick) URLs stay byte-for-byte verbatim.** Resolves the §5 "render `embedUrl` verbatim"
  invariant call: the architect ruled the mandated `parent` is **legitimate embed configuration, not rehosting**
  — **ADR 0003 #5 was AMENDED** to allow required platform params while keeping no-rehost; topology recorded in
  **ADR 0008** (Player-appends, single place). **official-embeds-only re-proven with tests:** Twitch-gets-parent
  + non-Twitch-verbatim (player + App). With this fix, **real Twitch channel ids now render** → unblocks
  PLACEHOLDER-EMBEDS down to a pure content/Rights-ToS call. **⚠ LOCAL ONLY — not committed/deployed; see Deploy
  dependency above (must wait for the CI `GEMINI_MODEL`→SSM fix; rides with LV1 or a post-CI patch).** ADRs: 0008
  (parent topology), 0003 #5 (amended).
- **SPOILER-HARDENING · rail labels no longer leak outcomes** ✓ (PO-accepted 2026-06-02 · architect-designed ·
  TDD'd) — **demo-blocker resolved (local); the confirmed on-screen staging leak is fixed.** The channel-rail
  label is now the **spoiler-safe** `` `${event.type} · ${streamer}` `` (streamer from the shared `topVantage`
  helper — **newly extracted to `frontend/src/lib/top-vantage.ts`**; falls back to `${type}` if no streamer) and
  **NEVER renders the outcome-bearing `narrative`**. So the host's anti-spoiler voice now holds **across surfaces**,
  not just in the ear — closing the gap where the rail plainly showed "…to win the round" / "…world record" to any
  viewer. **spoiler-safety re-proven with tests** (rail + shell-surf + App migrated): asserts the new label, that
  no raw `narrative` renders, and that **no banned outcome token** appears on screen. This **resolves the §13
  "spoiler-across-surfaces" decision** (bind the no-spoiler rule to the whole UI, not just the host — see Decisions
  needed, now RESOLVED) — recorded in **ADR 0009**. **⚠ LOCAL ONLY — not committed/deployed; see Deploy dependency
  above.** ADR: 0009 (spoiler-across-surfaces). _Note: this also partially completes the POLISH `topVantage` dedup
  (helper extracted; other call-sites still to trim — see POLISH M2-c/M3 #3)._
- **M3 · Real Gemini narration (`POST /narrate` proxy + FE swap)** ✓ (PO-accepted 2026-06-02) —
  **satisfies brief DoD #4** ("host lines are LLM-generated live, not hardcoded"): M2's canned utterance
  is replaced by a real, persona-voiced, spoiler-safe, tier-hedged line from Gemini (`gemini-3.1-flash-lite`)
  via a thin server-side proxy. **First LLM/backend path → both newly-required invariants PROVEN with tests:**
  **cost-gating** (FE fires `/narrate` only on a surfacing event — zero on idle, bounded per surface; re-proven
  live: no storm) + **secrets-from-env** (`GEMINI_API_KEY` env-only, never accepted from the body, never
  logged/returned — confirmed live). KEPT: **spoiler-safety** on the generated line, enforced at the **prompt**
  (ADR 0006 — no runtime outcome oracle; `narrate-prompt.test.ts` proves the §10 no-spoiler + tier rules; every
  `HostDirective` stays compiler-enforced `spoilerSafe: true`) + **official-embeds-only** (cut renders
  `embedUrl` verbatim, unchanged). **Build:** backend `/narrate` proxy (4 cycles: valid→one-short-line ·
  400-no-spend · secrets-from-env · spoiler/tier-prompt) + FE integration (cost-gating · utterance-from-API ·
  failure-silent · App wiring) + the **PO-mandated length-cap** (~20 words — the line is model-generated, so a
  cheap defensive backend bound on the one path qa drives live). New modules:
  `backend/src/modules/narrate/{routes,schema,gemini-client,prompt}`, `frontend/src/lib/{narrate-client,narrating-host-loop}`.
  `pnpm verify`=0 (**backend 7, frontend 24**). **tdd-critic PASS.** The **3 qa-found defects were FIXED +
  unit-covered before accept:** **D1** `/narrate` storm (unstable `App.tsx` client identity → stabilized
  module-level + a regression test on the DEFAULT-client path, closing the gap the stable-client unit left),
  **D2** local `dev` didn't load `backend/.env` (→ `tsx watch --env-file=.env`; staging was always fine — SSM),
  **D3** empty-200 utterance dispatched a blank `speak` (→ treated as no-speak, extending the failure-silent
  guard — silence-budget spirit). **qa-verifier re-qa 5/5 PASS live** (DoD #4 confirmed: real, varied,
  spoiler-safe, tier-hedged Gemini lines captured verbatim, e.g. _"Co-streamer A is locked in; it's a 1v3
  nightmare, and the momentum is shifting right here."_; idle→speaking→idle cycle; cut + manual surf both
  work; no blank speak; no key in logs). _Open, non-gating follow-ups carried forward:_ SPOILER-HARDENING
  (rail labels — high), POLISH nits incl. the M3 `topVantage` 3× dedup + seam-tripwire, placeholder→real
  embeds + digest-on-load (M4). ADRs: 0003 (scope/invariants), 0006 (spoiler claim — prompt is the control).
- **M2 · Character silent↔active + TTS + cut + client host loop** ✓ (PO-accepted 2026-06-02) — the
  product thesis made literal: the character earns its interruptions. 9 behaviors test-driven green
  (cycles 1–8 + App wiring + character **auto-revert to idle** — completing silent↔active): `speak()`
  abstraction; character idle/speak + auto-revert; shell `cutTo` + manual-surf coexist; client host
  loop (idle-default + **spoiler-safety** + **silence-budget**); App wiring. `pnpm verify`=0 (19 tests,
  lint+typecheck clean). **First `HostDirective`-emitting path → both required invariants PROVEN with
  tests:** spoiler-safety (every directive `spoilerSafe: true`; utterance anticipation-only, derived
  from `streamer` not `narrative`) + silence budget (burst of N events ≪ N speaks; idle the default).
  Official-embeds-only carries forward (cut renders `embedUrl` verbatim). tdd-critic **PASS** (3
  non-blocking nits → "POLISH" above). **qa-verifier 5/5 PASS** on the live app: idle→speaking→idle
  (4s auto-revert), player cut to a different vantage on event 2, manual surf overriding the host's
  cut, and **no host-utterance text on screen** — DoD #2/#3/#5/#6 met **at the host level**.
  _Accept caveat → follow-up:_ the **rail** still renders raw `narrative` (names outcomes); spoiler-safe
  for the *host* but a leak on the *page*. Pre-existing M1 behavior, outside M2's literal DoD #5, so it
  does **not** block M2 — filed as the high-priority "SPOILER-HARDENING" item + navigator escalation above.
- **M1 · Channel-surf shell** ✓ (PO-accepted 2026-06-02) — player + rail; rail lists one
  channel per event in order with a `heatDelta` heat indicator; player default = top event's
  `max lensScore` vantage; click switches; official embed `src` rendered **verbatim** (invariant
  proven); manual surf works (selection is the sole M1 driver). `pnpm verify`=0 (9 tests/7 files);
  tdd-critic PASS (2 minor non-blocking nits → "POLISH · M1 critic nits" above); qa-verifier PASS
  on all 5 items via Preview MCP (placeholder `EXAMPLE_*` embeds blank-render as expected — real
  channel ids are a demo-time content call, not a code change; see Rights/ToS below).
- **M0a · TDD harness** ✓ — agents, hooks, config, state, ADR 0003 (verified, `pnpm verify`=0).
- **M0b · Event bus** ✓ — `createEventBus<T>()`; in-order delivery tested; unsubscribe
  inherent to the `Set` impl (no tautological test).
- **M0b · Mock source-graph feed** ✓ — `createSourceGraphFeed()` emits each `PerceptionEvent`
  onto the bus at its `ts` offset in time order (`source-graph-feed.test.ts`, fake timers).
  All four §6 contract types now exist in `frontend/src/contracts/index.ts` (`PerceptionEvent`,
  `Vantage`, `RankedFeed`, `HostDirective`), feed typed against them — architect closed the
  seam (ADR 0004: literal `spoilerSafe: true`, `ts` = ms offset from feed start). §11 mock
  `frontend/src/mocks/event-graph.ts` also landed (digest + 3 events). `pnpm verify`=0,
  frontend 4/4; tdd-critic PASS; qa-verifier N/A (logic-only, no UX).

## Decisions needed (PO → human navigator)  [brief §13]
_Status (post-LV1 BROWSER-DIRECT re-accept, 2026-06-03): **LV1 is RE-ACCEPTED on the browser-direct transport**
(ADR 0007 Amendment C — relay retired, ECS cancelled; green bar + invariants re-proven + qa re-confirmed
end-to-end with no relay) with **one navigator action outstanding — the AUDIBLE / voice-identity confirmation at
demo** (the §13 voice call; recommended default = accept the current Live voice as-is — see "Voice identity"
below; the pivot does NOT affect this residual — same audio pipeline). **M3 is Done.** **spoiler-across-surfaces is
RESOLVED** (rail hedged via SPOILER-HARDENING; ADR 0009 — now DEPLOYED per `progress.md`). **One §13 wording call
remains OPEN but non-blocking — tier-aware hedging** — needed only **before a generated line is shown externally**
(shapes wording, not a seam). **The LV1-relay-host infra escalation is CLOSED/MOOT** (no relay under (a) — see the
struck entry below). **WDC update (2026-06-03): the §13 AUDIBLE / voice-identity call is now CLOSED — ACCEPTED for
the demo** (the navigator watched the deployed WDC cut, "staging looks ok, the pause is shorter", and did not flag
the voice → the current Gemini Live voice is accepted; see "Voice identity" below). **So NO §13 escalation is
currently open as a blocker.** The **only** open §13 item is **tier-aware hedging** (non-blocking; needed only
before a generated line is shown externally) — it does NOT block **M4** (M4 narrates the digest + surfacing lines
on the existing default prompt/hedging; the wording is a future external-demo polish). **Persona / rights** stay
settled-for-now on the M2 defaults (re-attach at the first external demo). **Release note:** the embed/spoiler
staging fixes are now DEPLOYED (CI `GEMINI_MODEL`→SSM gap CLOSED on `ce194e7`) — so model-id-changing releases
are CI-safe; **the LV1 staging release is a plain App-Runner-mint + S3/CloudFront-FE deploy** (NO relay, NO ECS).
**M4 (the in-flight feature) introduces NO new §13 escalation** — it rides on all settled-for-now defaults._

- **🧭 NEXT-PHASE DECISION — the brief's core is DONE; what's next? (§13-style: scope / next-phase — a genuine navigator call).** **OPEN · escalated 2026-06-04 · NOT a blocker (the build bar is green; lower-risk demo-prep can progress meanwhile).** With M4 deployed, **the prototype is feature-complete against the brief** (all §12 DoD #1–#6 built + deployed — see "🎯 FEATURE-COMPLETE" above). There is no more "next brief milestone" to demand — so the next move is a deliberate navigator choice among three roads. The PO frames them with the cost of each and a clear recommendation:
  - **(a) E2E journey test** — one end-to-end Playwright test of the full user journey (open → Start → digest → ranked surf), per the long-standing `E2E · One DoD journey` backlog item. **Value:** robustness / regression insurance — locks the whole DoD as one executable path so future changes can't silently break the experience. **Cost (non-trivial):** it needs the running app + a real-or-mocked `/narrate` + the live-voice path (a real iframe/socket/audio surface the hermetic suite deliberately stubs); deciding mock-vs-live for `/narrate` + live voice is itself a small design call; enabling `webServer` in `e2e/playwright.config.ts`. A few cycles, not a quick win — but bounded and additive (no new product surface).
  - **(b) M5 stretch — "thin real heat"** — replace the scripted mock event-graph with **real live data** (a real platform-API integration — e.g. poll a "currently-live / get-streams" endpoint for a crude real `heatDelta` and inject ≥1 genuinely-live event). **Value:** the demo stops being fully scripted — a real signal drives a real surface; it also subsumes DYNAMIC-LIVE-FETCH (always-live channels) and is the brief's named §9 stretch. **Cost (significant — a real new feature):** seam-touching (a new backend platform query + likely a key → **architect DESIGN + an ADR required first**, re-prove **secrets-from-env** + **cost-gating** on the new path); which API / whether a key is needed is an open design question; more uncertain than (a) or (c). This is net-new scope beyond the brief's core, not polish.
  - **(c) Wrap / demo-prep — land the carry-forwards, leave a clean demoable prototype.** Clear the parked items: **LV1-D2** (warm the live-voice WSS for snappier per-line latency — the host wakes ~10–12s late today, the most visible demo-snappiness gap), **DOC-RECONCILE** (architect: align ADR 0007 + design-notes to the browser-direct topology — relay refs are stale/historical), and **the navigator's push** (15 commits are parked locally, NOT pushed — `c20d3db` is 15 ahead of origin; pushing needs the navigator's go + a check that the `VITE_LIVE_VOICE=1` build flag stays committed so a CI-on-push deploy doesn't silently flip live voice OFF). **Value:** lowest-risk, highest demo-readiness — a clean tree, a snappier host, accurate docs, and the work safely on origin. **Cost:** small, mostly mechanical (one LV optimization + a docs pass + a guarded push).
  - **PO RECOMMENDATION → (c) Wrap / demo-prep, THEN (a) E2E as light robustness insurance — defer (b) M5 unless the navigator wants a real-data demo.** **Rationale:** the brief is *met and watchable*; the highest marginal value now is making what exists **clean, snappy, and safely shipped** (the 15 parked commits + the laggy first-line wake are the two things a navigator/viewer actually feels), not adding more surface. (a) E2E is the right *second* step — cheap insurance once the tree is clean, and it pins the now-complete DoD as one executable journey. (b) M5 is genuinely valuable but is **new scope with real cost** (architect + ADR + a new external dependency + secrets/cost-gating re-proof) — worth it only if "the demo shows REAL live heat, not a script" is an explicit goal for this phase; otherwise it's gold-plating past a done brief. **This is the navigator's call** (the brief's core is complete — picking the next investment is a scope decision, not a PO default). Meanwhile the PO will keep the lowest-risk (c) items demo-ready (LV1-D2 / DOC-RECONCILE / push-readiness already on the backlog under "Next"); whichever road the navigator picks, the PO writes the KICKOFF / surfaces the architect DESIGN as needed. [pending — navigator]

- **LV1 relay host — infra-scope: where does the WSS relay run?** **✅ CLOSED / MOOT (2026-06-03, ADR 0007
  Amendment C).** ~~OPEN · escalated 2026-06-02 · release-gate.~~ **No longer applicable — there is no relay.** The
  B2 browser-handshake probe PASSED and the navigator chose **topology (a) browser-direct**: the browser opens
  Google's Live WSS directly with a server-minted ephemeral token, so **nothing needs a persistent-WebSocket host.**
  Both sub-decisions this escalation framed are now **moot/closed:** (1) "does App Runner support inbound WSS" — N/A
  (no inbound WSS); (2) "whole-backend-migrate vs separate-relay-only ECS service" — N/A (Amendment A2's approved
  ECS Express Mode is **CANCELLED**, saving ~$25–30/mo + the standup; App Runner keeps only the plain-HTTP
  `/live/session` mint). **No navigator action needed.** [CLOSED · ADR 0007 Amendment C]

- **Tier-aware hedging — how hard to hedge confidence tiers 2–4** (esp. IRL/breaking: highest
  spoiler + misinformation risk). **OPEN (shipped in M3 on the default; non-blocking).** _Recommend:_
  tier 1 → state plainly; tiers 2–4 → hedge in register ("looks like", "chat's losing it over"), tier 4
  → explicitly *unconfirmed* (per §10/§14). M3 built the proxy + invariant tests on this default with the
  model stubbed, so the exact hedging copy is tunable without reshaping the seam; LV1 inherits the same
  prompt + default. **Needed by:** showing a generated line externally (the wording is brand- and
  misinformation-sensitive). _The coupled rail-labels call (spoiler-across-surfaces) is now RESOLVED (ADR
  0009); this hedging wording is the last open §13 wording call._ [pending]
- **Spoiler-safety across surfaces — does the host's no-spoiler rule bind the WHOLE UI, or only the
  host's voice?** **✅ RESOLVED (2026-06-02) — bind it EVERYWHERE.** The recommended default was taken:
  the rail no longer renders the raw outcome-bearing `narrative`; its label is the spoiler-safe
  `` `${type} · ${streamer}` `` (host's anticipation register). Shipped via the **SPOILER-HARDENING** item
  (now Done; spoiler-safety re-proven with tests across rail + shell-surf + App) and recorded in **ADR 0009**.
  Rationale held: the moat is **pro-creator / anti-spoiler** — a visible outcome is "the opposite of a
  product-killer" (brief §5, §14). _(⚠ The fix is local + green but not yet deployed — see Deploy dependency.)_
  **Tier-aware hedging (the coupled wording call) remains OPEN** — see above. [RESOLVED · ADR 0009]
- **Persona — one named host vs per-channel skins.** _Recommend: ONE named persona_ (stronger brand,
  merch/clip engine — brief §13). **SETTLED-FOR-NOW:** M2 shipped a single `idle`/`speaking` character
  on the one-host default; carries no rework risk into M3. **Re-attaches at:** the first external demo
  (final name/look). [pending — external-demo gate]
- **Voice identity / audible confirmation — does the Gemini Live voice SOUND right?** **✅ CLOSED / ACCEPTED for
  the demo (2026-06-03, at the WDC accept).** The **engine** was resolved earlier (navigator chose
  `gemini-3.1-flash-live-preview` streamed audio over Web Speech, 2026-06-02). The remaining call — whether the
  streamed voice is **AUDIBLY** right (a human-ear judgment qa could prove only as a working pipeline) — was the
  navigator's at demo. **The navigator watched the deployed WDC cut live ("staging looks ok, the pause is shorter")
  and did NOT flag the voice.** Per the PO's recommended default (accept the current Live voice as-is for the
  prototype demo — the pipeline is proven, the line is spoiler-safe and matches on screen), **the current Gemini
  Live voice is ACCEPTED for the demo.** This §13 call is **CLOSED.** _(Re-attaches only at a later "pick a final
  TTS voice direction before any external/marketing demo" gate — a future, separate decision; the
  voice/persona-audio config remains a low-risk tuning knob, not a seam, if a future re-voice is wanted.)_ [CLOSED
  — navigator accepted at the WDC demo]
- **Rights/ToS:** official embeds only; never rehost/restream; route value to the source.
  **SETTLED-FOR-NOW:** invariant carries through M2 (cuts render `embedUrl` verbatim) and is unchanged
  by M3 (`/narrate` never touches embeds). The §11 mock's `EXAMPLE_*` placeholders keep proving the
  mechanic structurally. **Re-attaches at:** the first external demo (pick real, confirmed-embeddable
  channel ids — a content/curation call, no code change). **Staging update (2026-06-02):** the
  **EMBED-TWITCH-PARENT** defect is now **FIXED** (Player appends `&parent=<host>`; ADR 0008, **ADR 0003 #5
  amended** to allow required platform params while keeping no-rehost — local + green, deploy-gated). So
  picking real Twitch ids is **now sufficient** — they will render. This gate is therefore reduced to a pure
  **content/curation Rights-ToS call** (real, confirmed-embeddable, ToS-compliant ids — official embeds only).
  See **PLACEHOLDER-EMBEDS** in the embed follow-ups section. [pending — external-demo gate]
