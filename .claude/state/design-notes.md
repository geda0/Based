# Design notes — Based prototype · M3 · Real Gemini narration — ✅ DONE (PO-accepted 2026-06-02)

> **STATUS: M3 is DONE and PO-accepted (2026-06-02).** All 7 acceptance bullets + the PO-mandated
> length-cap are GREEN; `pnpm verify`=0 (backend 7, frontend 24); tdd-critic PASS; **qa-verifier re-qa
> 5/5 PASS live** (DoD #4 confirmed — real, varied, spoiler-safe, tier-hedged Gemini lines; idle→speaking→idle;
> cut + manual surf; no blank speak; no key in logs). The 3 qa defects (D1 storm / D2 dev-env / D3 empty-200)
> were FIXED + unit-covered. **M3 satisfies brief DoD #4** ("host lines are LLM-generated live, not hardcoded").
> See `backlog.md` → Done for the full evidence record.
>
> **NEXT (navigator-chosen, queued in `backlog.md` → Next): LV1 · Live-voice host** —
> `gemini-3.1-flash-live-preview` over the WebSocket Live API for **native streaming audio** (replaces
> Web Speech; resolves the §13 voice-identity decision). **SEAM-TOUCHING → architect DESIGN required**
> (new WSS topology that keeps `GEMINI_API_KEY` server-side + an audio pipeline replacing `speak()`).
> Sequenced **ahead of M4** (M4 = two-level ranking + digest, immediately after). The orchestrator
> should refresh this file into the LV1 KICKOFF once the architect confirms the seam + records an ADR.
> _The M3 KICKOFF is retained below as the accepted record._

---

_KICKOFF (ACCEPTED RECORD) for the orchestrator's inner TDD loop. Scope was **M3 only** (brief §6/§7/§9 M3, §10
prompt, §12 item 4, §14 cost/spoiler guardrails). M0a/M0b/M1/M2 are Done (see backlog). M2 made the
product thesis literal (the character earns its interruptions) but speaks **canned** lines; M3 makes
"the Live AI understands and **narrates**" genuinely true — the host's lines become **LLM-generated
live** (brief DoD #4). This is the **first path that calls the LLM/backend**, so per ADR 0003 /
CLAUDE.md it must newly prove **cost-gating** and **secrets-from-env** with tests, and keep
**spoiler-safety** (now on a *generated*, tier-hedged line) and **official-embeds-only**._

## FEATURE
Give the host a real voice. Add a thin backend narration proxy and wire the FE to it:
1. **`POST /narrate` Fastify proxy** in `backend/src/modules/narrate/` with its **own local zod
   schema** (no cross-workspace runtime coupling — ADR 0003). It accepts a `PerceptionEvent`'s
   **safe fields** (the §10 inputs: `{type, narrative, confidenceTier, streamer, eventScore}`),
   shapes the §10 persona prompt, calls **Gemini 3.1 Flash Live** (model id from `GEMINI_MODEL`;
   confirm the exact id/endpoint against Google's docs at build time), and returns
   `{ utterance }` — one short, persona-voiced, spoiler-safe, tier-hedged line.
2. **FE swap:** the host loop (M2) currently populates `HostDirective.utterance` from a canned
   placeholder. M3 replaces that source with the `/narrate` result — **fired only when an event
   surfaces** (clears the host-loop threshold), never on idle and never on a poll/timer. On a
   narration failure the host **stays silent** rather than speaking a broken line.

The directive flow M2 built does **not** reshape — M3 only changes *where the utterance text comes
from* (the clean seam M2 left). The character/player still react to the same `HostDirective` stream
off the event bus; the cut still renders `cutToVantage.embedUrl` verbatim.

The **key stays server-side.** `GEMINI_API_KEY` is read only from the backend's env (already wired:
SSM SecureString → App Runner per progress.md). The browser never sees it; it is never accepted from
the request body and never logged or returned.

*Demo (brief §9 M3):* the same wake→speak→cut flow as M2, but the line is generated live and feels
alive — and stays spoiler-safe + tier-hedged.

## ACCEPTANCE CRITERIA (each → one or more red→green cycles; layer-tagged, observable)
_Layer order: **backend contract first, then FE** (cross-layer; backend produces the line, FE
consumes it). Gemini is **stubbed/injected** in tests — we assert on the proxy's prompt-shaping,
validation, env-key path, and response handling, never on the live model._

### Backend — `POST /narrate`  ✓ all 4 bullets GREEN (4 cycles · BE 6 tests · tdd-critic PASS)
- **[x] [backend] Valid payload → one short line.** Given a well-formed body
  (`{type, narrative, confidenceTier, streamer, eventScore}`) and a stubbed Gemini client, when
  POSTed, then `200` with `{ utterance }` where `utterance` is a **single non-empty line** (no
  newline characters) and **bounded in length** (the §10 "max ~20 words" shape — assert an upper
  bound, e.g. trimmed + capped). Proves the happy-path contract.
- **[x] [backend] Malformed payload → 400, no spend.** Given a body with a missing/wrong-typed required
  field (e.g. no `type`, `narrative` empty, or `confidenceTier` outside `1..4`), when POSTed, then
  `400` (zod-rejected) **and the Gemini client is NOT called** (the stub records zero calls) — the
  proxy rejects before spending.
- **[x] [backend] INVARIANT — spoiler-safety + tier-hedging (enforced at the PROMPT).** Spoiler-safety on
  a **generated** line is enforced **at the prompt**, not by a runtime verbatim-strip in the proxy.
  `buildNarratePrompt` (`narrate.prompt.ts`) **always** carries the §10 no-spoiler rule and matches
  register to `confidenceTier` (tier 1 plain; tiers 2–4 hedged — looks-like / chat's-losing-it; tier 4
  explicitly *unconfirmed*) — proven by `backend/tests/narrate-prompt.test.ts`. The proxy itself does
  **not** detect or strip an outcome from the model's reply (it returns the model text verbatim apart
  from collapsing newlines + trimming to one line — `narrate.routes.ts`): a reliable runtime strip is
  **infeasible** — there is **no outcome oracle** for arbitrary model output, so the proxy cannot know
  which words would be a spoiler. _(Assert on prompt-shaping with the stubbed client: the prompt
  carries the §10 no-spoiler + tier rules. Exact hedging copy is tunable per the navigator's
  tier-hedging call — see §13.)_ **Accepted residual risk:** despite the prompt, the model could in
  principle still emit a spoiler; the prompt is the control. The complementary guards stay: every
  `HostDirective` is **compiler-enforced `spoilerSafe: true`** (M2/ADR 0004), and a `/narrate` failure
  **degrades to silence** rather than speaking a broken/unverified line.
- **[x] [backend] INVARIANT — secrets-from-env.** Given a request that **carries a bogus key field**
  (e.g. `apiKey` / `GEMINI_API_KEY` in the body), when POSTed, then that body value is **ignored** —
  the Gemini client is constructed from the **env key only** — and the key appears **nowhere** in the
  response body or in any log line. _(Test: assert the client received the env key, not the body
  value; assert the response + captured logs are key-free. `GEMINI_API_KEY` read from `process.env`
  only.)_

### Frontend — wire the host loop to `/narrate`  ✓ all 3 bullets GREEN (+ App wiring · FE 22 tests · tdd-critic PASS)
- **[x] [frontend] INVARIANT — cost-gating.** Given a feed where **nothing clears the threshold**, when
  the host loop runs, then **`/narrate` is called zero times**; given **one surfacing event**, then
  it is called **exactly once**. The narration call fires **on events only — never on idle, never on
  a timer/poll** (mirrors the real cost-gate: the LLM fires on heat-gated events, not the firehose —
  brief §8, §14). _(Test: stub the `/narrate` fetch/client; drive both feeds; assert the call count.)_
- **[x] [frontend] Utterance comes from the API.** Given a surfacing event, when the host speaks, then the
  spoken `utterance` is the value returned by `/narrate` (stubbed in tests), **not** the M2 canned
  placeholder. _(The M2 `speak`/character path is unchanged; only the text source moves.)_
- **[x] [frontend] On narration failure, the host stays silent.** Given `/narrate` errors/rejects/times
  out, when an event surfaces, then **no `speak` is forced** with an empty/broken line — the host
  degrades to **idle/quiet** (the player may still cut to the vantage). A broken line is worse than
  silence; this preserves the silence-budget spirit. _(Test: stub `/narrate` to reject; assert
  `speak` is not called / no speaking state with empty text.)_

## BASED INVARIANTS (prove with tests on the paths that need them — ADR 0003)
M3 lights up the first LLM/backend path. It newly **proves 4 and 6**, and keeps **1 and 5**:
1. **Spoiler-safety** — KEPT + EXTENDED to a generated line, enforced **at the prompt** (ADR 0006).
   `buildNarratePrompt` always carries the §10 no-spoiler rule + tier-hedging (proven by
   `narrate-prompt.test.ts`); the proxy does **not** runtime-strip outcomes (no outcome oracle for
   arbitrary model output — infeasible). Forced by the backend spoiler/tier bullet. **Accepted
   residual risk** the model could still emit a spoiler — the prompt is the control; the directive
   `spoilerSafe: true` stays **compiler-enforced** (M2/ADR 0004) and `/narrate` failure degrades to
   silence.
2. **Silence budget** — KEPT (M2-proven). M3 adds the failure-degrades-to-silent bullet so a broken
   narration never becomes forced noise.
3. **Contracts-as-seam** — ENFORCED. `/narrate` consumes only a `PerceptionEvent`'s safe fields; the
   FE still trades only `RankedFeed` + `HostDirective` (+ the new narration client behind an
   interface). Swapping the stub for the real Gemini call never touches the character/player.
4. **Cost-gating** — **PROVEN HERE.** The FE calls `/narrate` only on surfacing events (zero on idle,
   one per surface) — forced by the cost-gating bullet. The proxy also refuses to spend on a 400.
5. **Official embeds only / route value to the source** — KEPT, unchanged. `/narrate` never touches
   embeds; the cut still renders `cutToVantage.embedUrl` verbatim (M1/M2 behavior).
6. **Secrets from env** — **PROVEN HERE.** `GEMINI_API_KEY` from env only; never accepted from the
   body, never logged, never returned — forced by the secrets bullet. (Key already lives only in
   `backend/.env` (gitignored) + SSM SecureString — progress.md.)

## CONSTRAINTS / NON-GOALS
- **Seam-touching + cross-layer → architect consult REQUIRED at DESIGN.** `/narrate` is a new §6-
  adjacent contract with its own backend zod schema. Before the first RED, the architect confirms/
  extends the seam (request/response shape; that the FE→backend boundary trades only
  `PerceptionEvent` safe fields → `{ utterance }`) and records an ADR. Do **not** start cycles until
  the seam is confirmed.
- **Backend validates with its OWN local zod schema** (ADR 0003) — the §6 types live in
  `frontend/src/contracts/`; the backend does not import across the workspace at runtime. Keep the
  `/narrate` body schema in `backend/src/modules/narrate/`.
- **Stub Gemini in tests; never hit the live model in the suite.** Inject the Gemini client (or fetch)
  so tests are deterministic and offline. The suite asserts on prompt-shaping, validation, the env-key
  path, and response handling — not on model output quality. (`pnpm verify` must stay hermetic.)
- **Cost-gating is loop/wiring logic, not type-enforced** — prove with the FE call-count test (zero on
  idle, one per surface). The proxy's "no spend on 400" complements it on the backend.
- **Use the §10 system prompt as the starting point** (sharp/warm/one line/no-emoji; no-spoiler; tier-
  match). Exact hedging copy is **tunable** per the navigator's tier-hedging call — build on the
  recommended default (tier 1 plain; 2–4 hedge; 4 explicitly unconfirmed). The prompt copy is not a
  blocking decision for the seam.
- **Confirm the exact Gemini 3.1 Flash Live model id/endpoint** against Google's docs at implementation
  time (ADR 0003 note). `GEMINI_MODEL` is already an env knob — wire it, don't hardcode.
- **Out of scope for M3:** the **rail-label spoiler leak** (separate high-priority "SPOILER-HARDENING"
  backlog item + navigator escalation — it's an FE-rendering fix, not narration); two-level ranking +
  digest (M4); predictive staging timed cut + the ms/sec conversion trap (M4); real perception/firehose/
  source-graph (brief §15, all deferred behind the contracts). M3 does not change the M2 directive flow.
- **Carried-forward risk (architect — test at M4, NOT here):** `HostDirective.staging.fireAtMs` (ms) vs
  `Vantage.offsetSec` (sec) off-by-1000 trap; `RankedFeed.events` "sorted desc by `eventScore`" is a
  doc-comment the M4 ranker must prove with an ordering test. M3 trusts the given order.
- **Decision active for M3 (do NOT block BUILD — see backlog "Decisions needed"):** **tier-aware
  hedging** (how hard to hedge tiers 2–4). M3 builds the proxy + invariant tests on the recommended
  default and the stubbed model; the exact wording is tunable and is **needed before showing a
  generated line externally**. (Persona / voice / rights are settled-for-now on M2's defaults.)

## MILESTONE CHECKLIST
- [x] M0a — TDD harness bootstrapped + verified
- [x] M0b — contracts + event bus + mock source-graph feed  *(frontend)*  · critic PASS
- [x] M1  — channel-surf shell: player + rail, manual surf, official embeds only  *(frontend)*  · PO-accepted
- [x] M2  — character silent↔active + TTS + cut + client host loop  *(frontend)*  · PO-accepted (spoiler-safety + silence-budget PROVEN; rail-label leak → SPOILER-HARDENING follow-up)
- [x] **M3  — real Gemini narration: `/narrate` proxy + FE swap  *(backend → frontend)*  · PO-accepted 2026-06-02 — satisfies brief DoD #4**
      _(all 7 bullets + App wiring + the PO-mandated length-cap GREEN · `pnpm verify`=0 (backend 7 / frontend 24) · tdd-critic PASS.
      **PROVES cost-gating + secrets-from-env**; KEEPS spoiler-safety (prompt-enforced, ADR 0006) + official-embeds-only. The 3 qa defects
      D1 (storm) / D2 (dev-env) / D3 (empty-200) were FIXED + unit-covered. **qa-verifier re-qa 5/5 PASS live** — DoD #4 confirmed: real,
      varied, spoiler-safe, tier-hedged Gemini lines captured verbatim (e.g. "Co-streamer A is locked in; it's a 1v3 nightmare, and the
      momentum is shifting right here."); idle→speaking→idle; cut + manual surf; no blank speak; no key in logs.)_
- [ ] **LV1 — live-voice host: `gemini-3.1-flash-live-preview` over WSS, native streaming audio (replaces Web Speech)  *(backend → frontend)*  ← NEXT · navigator-chosen · SEAM-TOUCHING (architect DESIGN required) · resolves §13 voice identity**
- [ ] M4  — two-level ranking + "while you were gone" digest  *(frontend)*  *(sequenced after LV1; fallback-first if LV1 audio proves heavy)*
- [ ] E2E — one DoD journey  *(playwright)*
- [ ] M5  — (stretch) thin real heat

## SUGGESTED CYCLE ORDER (orchestrator — cross-layer: backend contract FIRST, then FE) — ALL DONE
Architect confirmed the seam (ADR 0006), then smallest seams first with the two new invariants explicit:
0. [x] **DESIGN — architect** confirmed the `/narrate` seam + recorded ADR 0006 (spoiler claim since reconciled — prompt is the control).
1. [x] **[backend] valid payload → one short line** — happy path + the `{ utterance }` shape.
2. [x] **[backend] malformed → 400, no spend** — zod rejects; the Gemini stub records zero calls.
3. [x] **[backend] INVARIANT secrets-from-env** — body key ignored; env key only; nothing key-bearing in response/logs.
4. [x] **[backend] INVARIANT spoiler-safety + tier-hedging** — enforced at the **prompt** (`narrate-prompt.test.ts`); tier 1 plain vs 2–4 hedged.
5. [x] **[frontend] INVARIANT cost-gating** — zero `/narrate` calls on idle; exactly one per surfacing event (stubbed client).
6. [x] **[frontend] utterance from API** — the host speaks the `/narrate` result, not the canned placeholder.
7. [x] **[frontend] failure → host stays silent** — `/narrate` rejects → no forced/empty `speak`.
   _(+ App wiring narrates via the injectable client.) New modules: `backend/src/modules/narrate/{routes,schema,gemini-client,prompt}`,_
   _`frontend/src/lib/{narrate-client,narrating-host-loop}`. `pnpm verify`=0 (BE 6 / FE 22 = 28 tests); tdd-critic **PASS**._
**REMAINING before M3 is Done:** (a) **#2 length-cap decision** (below — cap-now is the call; one BE cycle); (b) **qa-verifier** drives the
live wake→speak→cut, confirms the line is LLM-generated (DoD #4), spoiler-safe, and a forced failure degrades to silence; (c) **PO sign-off** → then RELEASE m3 → M4.
