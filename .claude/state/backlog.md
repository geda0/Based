# Backlog — Based prototype (owned by product-owner)

_Prioritized features. The PO selects the top unblocked item, writes `design-notes.md`
for it, and the orchestrator runs the inner TDD loop. Status: todo | in-progress |
done | blocked. Order follows the brief's milestones (§9); any re-prioritization is
logged with a one-line rationale. Acceptance criteria are layer-tagged and tied to
the brief's Definition of Done (§12) and invariants (ADR 0003)._

## Now (in flight)
- **M3 · Real Gemini narration** — `[backend]`→`[frontend]` — status: **in-progress**
  - Goal: replace M2's canned utterance with a **real, persona-voiced LLM line**. A thin
    Fastify proxy `POST /narrate` (`backend/src/modules/narrate/`, own zod schema) takes a
    `PerceptionEvent`'s **safe fields** and returns one short utterance from **Gemini 3.1
    Flash Live** (key server-side); the FE host loop swaps its placeholder for the API result.
    This satisfies brief DoD #4 ("host lines are LLM-generated live, not hardcoded") and makes
    "the Live AI understands and narrates" genuinely true in the demo (brief §7, §9 M3, §10).
  - This path **emits narration → must prove the Based invariants** (ADR 0003). M3 newly
    PROVES **cost-gating** + **secrets-from-env**, and KEEPS spoiler-safety (now tier-hedged on
    a *generated* line) + official-embeds-only:
  - Acceptance (layer-tagged, observable — see `design-notes.md` for the full KICKOFF; layer
    order is **backend contract first, then FE**):
    - `[backend]` Valid payload → **one short line**. Given a well-formed `/narrate` body
      (`{type, narrative, confidenceTier, streamer, eventScore}` per §10) with a stubbed Gemini
      client, when POSTed, then `200` + `{ utterance }` is a single non-empty line (no newlines;
      bounded length — the §10 "max ~20 words" shape).
    - `[backend]` Malformed payload → **400**. Given a body missing/!typed-wrong required fields
      (e.g. no `type`, or `confidenceTier` out of `1..4`), when POSTed, then `400` (zod-validated)
      and **no Gemini call** is made (the proxy rejects before spending).
    - `[backend]` **(spoiler-safety + tier-hedging)** Given an event whose `narrative` names an
      outcome, when narrated, then the returned `utterance` is anticipation-only — it does **not**
      echo the outcome token, AND tier ≥2 input yields a **hedged** line (looks-like / chat's-losing-it
      register vs tier 1 plain). _(Test stubs the Gemini client; asserts on the proxy's
      prompt-shaping + response handling, not the live model — see §13 escalation on how hard to hedge.)_
    - `[backend]` **(secrets-from-env — INVARIANT)** `GEMINI_API_KEY` is read **only from env**:
      it is never accepted from the request body (a body key field is ignored/rejected, never used),
      and never appears in the response or in any log line. _(Test: a request carrying a bogus
      `apiKey`/`GEMINI_API_KEY` field does not reach Gemini with it; assert the env key path + that
      logs/response are key-free.)_
    - `[frontend]` **(cost-gating — INVARIANT)** The FE calls `/narrate` **only when an event clears
      the host-loop threshold** (i.e. on a `speak`/`cutTo`), **never on idle and never on a poll/timer**.
      _(Test: drive a feed where nothing surfaces → zero `/narrate` calls; one surfacing event → exactly
      one call. Mirrors the real cost-gate: LLM fires on events, not the firehose — brief §8, §14.)_
    - `[frontend]` Utterance comes **from the API**. Given a surfacing event, when the host speaks,
      then the spoken `utterance` is the value returned by `/narrate` (stubbed in tests), not the
      M2 canned placeholder.
    - `[frontend]` On narration **failure, the host stays silent** (and the player may still cut).
      Given `/narrate` errors/times out, when an event surfaces, then **no `speak`** is forced with a
      broken/empty line — the host degrades to idle/quiet rather than speaking garbage (preserves the
      silence-budget spirit; a broken line is worse than silence).
  - Invariants (PROVEN HERE — narration path): **cost-gating** (FE fires only on surfacing events)
    + **secrets-from-env** (`GEMINI_API_KEY` env-only, never body/log/response); KEEP **spoiler-safety**
    (tier-hedged generated line, no outcome echo) + **official-embeds-only** (cut still renders
    `cutToVantage.embedUrl` verbatim — unchanged by M3). Contracts-as-seam holds: `/narrate` consumes
    only `PerceptionEvent` safe fields; the FE still trades `RankedFeed`/`HostDirective`.
  - Depends on: M2 host loop ✓ (the `utterance`-population seam M2 left clean), staging infra ✓
    (per progress.md: `@fastify/cors` w/ `CORS_ORIGINS`; `GEMINI_API_KEY` from SSM SecureString on
    App Runner; `GEMINI_MODEL` env — backend M3 prep already done). **Seam-touching + cross-layer →
    architect consult REQUIRED at DESIGN** (new `/narrate` contract + its zod schema; ADR). **Decision
    needed before the line ships externally:** tier-aware hedging (see below). UX-affecting → qa-verifier
    on green.
  - Confirm the exact **Gemini model id/endpoint** against Google's docs at implementation time
    (ADR 0003 note); `GEMINI_MODEL` is already an env knob. Keep the §10 prompt as the starting point.

## Next (prioritized)
- **SPOILER-HARDENING · rail labels must not leak outcomes** — `[frontend]` — priority: **high** — status: todo
  - **Defect (qa-verifier, during M2 accept).** The channel rail (`frontend/src/components/channel-rail.tsx:9`)
    renders each event's `narrative` **verbatim** as the button label, and the §11 mock narratives **name
    outcomes** ("1v3 retake clutch **to win the round**", "Speedrunner … **for a world record**"). So while
    the *host's utterance* is spoiler-safe (M2 proven), the **rail leaks the same outcomes on screen** — the
    foreknowledge is meant only to *time the cut*, never to leak (brief §5, §14). Spoiler-safe in the ear,
    spoiler on the page.
  - **Scope note.** This is **pre-existing M1-accepted** behavior (the rail rendered `narrative` since M1) and
    sits **outside M2's literal DoD #5**, which scopes "no spoiler" to the **host**. So it did **not** block M2
    accept. But it contradicts the spoiler-safety **spirit** (the moat is pro-creator / anti-spoiler — "the
    opposite of a product-killer"), so it is filed high and **re-opens an M1 design choice** → escalated to the
    navigator (see "Decisions needed: spoiler-safety across surfaces").
  - Goal: the rail labels describe **where to look** in the host's anticipation register **without revealing the
    outcome** — consistent with the host's voice across every surface.
  - Acceptance (sketch — finalize after the navigator call):
    - `[frontend]` The rail label is a **spoiler-safe** string derived from safe fields (recommend `type` +
      `streamer`, e.g. "Valorant clutch — Co-streamer A", "World-record attempt — Original runner") — it does
      **not** render the raw `narrative`, and does **not** contain the event's outcome token.
    - `[frontend]` Given the §11 mock, when the rail renders, then **no** label contains a banned outcome token
      (e.g. "to win the round", "world record") — assert on the rendered labels.
    - `[frontend]` Manual surf still works (label change is cosmetic; `onSelect(eventId)` unchanged).
  - Depends on: navigator decision (how strictly spoiler-safety applies across surfaces; couples to tier-aware
    hedging). **Recommended default:** hedge the rail now (don't wait) — derive the label from `type`+`streamer`.
- **POLISH · critic nits (M1 + M2)** — `[frontend]` — priority: low — status: todo
  - Non-blocking tdd-critic nits; do opportunistically (e.g. alongside M3 FE work). No product impact.
    - **(M1)** Drop the redundant `aria-valuenow` on the heat `<meter>` (`channel-rail.tsx:11`) — the `<meter>`
      already exposes its value natively. _(Note: this file is also touched by the SPOILER-HARDENING item above —
      sequence so they don't collide.)_
    - **(M1)** Give the click→switch test its own independent `max lensScore` guard (today it leans on the load
      test's shared `topVantage`).
    - **(M2-a)** Delete the stale **compiled `.js` test artifacts** in `frontend/tests/` (`*.test.js`, `setup.js`)
      left by the old `tsc -b`, and **gitignore `frontend/**/*.js`** so they can't reappear. Coordinate with the
      navigator's build/gitignore work (the `build` script is already `tsc --noEmit && vite build`, so nothing
      re-emits these — they're just stale).
    - **(M2-b)** Fix the cosmetic React `act()` warning in `App.test.tsx`'s wake test; also that test's no-`act`
      timing coupling is a bit fragile — make its timing assertion robust (it shouldn't depend on incidental
      scheduling).
    - **(M2-c)** `topVantage` (max-`lensScore` vantage selection) is **duplicated**: `channel-surf-shell.tsx:6`
      (the `topVantage` fn) and `host-loop.ts:32` (the inline `reduce`). Extract one shared helper into
      `frontend/src/lib` and have both call it (single source of truth for "best vantage").
- **M4 · Two-level ranking + "while you were gone" digest** — `[frontend]` — status: todo
  - Goal: event rank → `RankedFeed` desc; vantage rank picks best lens; digest on load.
  - Acceptance (sketch): events sorted by `eventScore` desc; best `lensScore` chosen;
    digest directive produced first; ≥2 events fire over the timeline.
- **M4 · Two-level ranking + "while you were gone" digest** — `[frontend]` — status: todo
  - Goal: event rank → `RankedFeed` desc; vantage rank picks best lens; digest on load.
  - Acceptance (sketch): events sorted by `eventScore` desc; best `lensScore` chosen;
    digest directive produced first; ≥2 events fire over the timeline.
- **E2E · One DoD journey** — `[e2e]` — status: todo
  - Goal: Playwright journey covering brief §12 end to end (load→digest→events→cut→surf,
    no spoiler). Enable `webServer` in `e2e/playwright.config.ts`. Keep e2e count ≤2.
- **M5 (stretch) · Thin real heat** — `[frontend|backend]` — status: todo
  - Goal: poll one platform API for a crude real `heatDelta`; inject one real event.

## Done
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
_Status for the in-flight **M3**: M3 can BUILD now (backend `/narrate` contract, zod, env-key
path, FE swap, cost-gating + secrets invariants) on the §10 prompt + recommended hedging default.
The **tier-aware hedging** call (and the related **spoiler-across-surfaces** call) are needed
**before the generated line / rail labels are shown externally** — they shape exact wording, not
the seam. **§13 persona/voice/rights** are settled-for-now (M2 shipped on the recommended defaults;
they re-attach only at the first external demo) — kept below for visibility._

- **Tier-aware hedging — how hard to hedge confidence tiers 2–4** (esp. IRL/breaking: highest
  spoiler + misinformation risk). **NOW ACTIVE (M3).** _Recommend:_ tier 1 → state plainly; tiers
  2–4 → hedge in register ("looks like", "chat's losing it over"), tier 4 → explicitly *unconfirmed*
  (per §10/§14). **Blocks M3 BUILD? NO** — M3 builds the proxy + invariant tests on this default and
  the §10 prompt; the model is stubbed in tests, so the exact hedging copy is tunable without
  reshaping the seam. **Needed by:** showing a generated line externally (the wording is brand- and
  misinformation-sensitive). Couples to the rail-labels call below. [pending]
- **Spoiler-safety across surfaces — does the host's no-spoiler rule bind the WHOLE UI, or only the
  host's voice?** **NEW — re-opens an M1-accepted choice.** The rail renders raw `narrative`, which
  names outcomes; the host is spoiler-safe but the page is not. _Recommend:_ bind it **everywhere** —
  hedge the rail too (derive labels from `type`+`streamer`, the host's anticipation register), because
  the moat is being **pro-creator / anti-spoiler** and a visible outcome is "the opposite of a
  product-killer" (brief §5, §14). **Blocks M3? NO** (separate, high-priority "SPOILER-HARDENING"
  item). **Needed by:** any external demo where viewers see the rail; resolve **together with
  tier-aware hedging** (same anti-spoiler / hedging instinct, same wording sensitivity). [pending]
- **Persona — one named host vs per-channel skins.** _Recommend: ONE named persona_ (stronger brand,
  merch/clip engine — brief §13). **SETTLED-FOR-NOW:** M2 shipped a single `idle`/`speaking` character
  on the one-host default; carries no rework risk into M3. **Re-attaches at:** the first external demo
  (final name/look). [pending — external-demo gate]
- **Voice identity — Web Speech API direction for the prototype.** _Recommend: Web Speech **default**
  voice for now._ **SETTLED-FOR-NOW:** M2 used the default voice behind the abstracted `speak(text)`;
  the voice/engine swaps without touching callers. **Re-attaches at:** the first external demo (pick a
  deliberate voice or a TTS-API voice). [pending — external-demo gate]
- **Rights/ToS:** official embeds only; never rehost/restream; route value to the source.
  **SETTLED-FOR-NOW:** invariant carries through M2 (cuts render `embedUrl` verbatim) and is unchanged
  by M3 (`/narrate` never touches embeds). The §11 mock's `EXAMPLE_*` placeholders keep proving the
  mechanic structurally. **Re-attaches at:** the first external demo (pick real, confirmed-embeddable
  channel ids — a content/curation call, no code change). [pending — external-demo gate]
