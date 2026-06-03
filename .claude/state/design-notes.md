# Design notes — Based prototype · IN FLIGHT: M3 · Real Gemini narration

_KICKOFF for the orchestrator's inner TDD loop. Scope is **M3 only** (brief §6/§7/§9 M3, §10
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

### Backend — `POST /narrate`
- **[backend] Valid payload → one short line.** Given a well-formed body
  (`{type, narrative, confidenceTier, streamer, eventScore}`) and a stubbed Gemini client, when
  POSTed, then `200` with `{ utterance }` where `utterance` is a **single non-empty line** (no
  newline characters) and **bounded in length** (the §10 "max ~20 words" shape — assert an upper
  bound, e.g. trimmed + capped). Proves the happy-path contract.
- **[backend] Malformed payload → 400, no spend.** Given a body with a missing/wrong-typed required
  field (e.g. no `type`, `narrative` empty, or `confidenceTier` outside `1..4`), when POSTed, then
  `400` (zod-rejected) **and the Gemini client is NOT called** (the stub records zero calls) — the
  proxy rejects before spending.
- **[backend] INVARIANT — spoiler-safety + tier-hedging.** Given an event whose `narrative` names an
  outcome, when narrated, then the returned `utterance` is **anticipation-only** — it does **not**
  echo the event's outcome token — AND a **tier ≥2** input is **hedged** (looks-like / chat's-losing-
  it register) vs a **tier 1** plain statement. _(Assert on the proxy's prompt-shaping + response
  handling with the stubbed client: the prompt carries the §10 no-spoiler + tier rules; if the model
  returned an outcome-bearing line the proxy must not pass it through verbatim. Exact hedging copy is
  tunable per the navigator's tier-hedging call — see §13.)_
- **[backend] INVARIANT — secrets-from-env.** Given a request that **carries a bogus key field**
  (e.g. `apiKey` / `GEMINI_API_KEY` in the body), when POSTed, then that body value is **ignored** —
  the Gemini client is constructed from the **env key only** — and the key appears **nowhere** in the
  response body or in any log line. _(Test: assert the client received the env key, not the body
  value; assert the response + captured logs are key-free. `GEMINI_API_KEY` read from `process.env`
  only.)_

### Frontend — wire the host loop to `/narrate`
- **[frontend] INVARIANT — cost-gating.** Given a feed where **nothing clears the threshold**, when
  the host loop runs, then **`/narrate` is called zero times**; given **one surfacing event**, then
  it is called **exactly once**. The narration call fires **on events only — never on idle, never on
  a timer/poll** (mirrors the real cost-gate: the LLM fires on heat-gated events, not the firehose —
  brief §8, §14). _(Test: stub the `/narrate` fetch/client; drive both feeds; assert the call count.)_
- **[frontend] Utterance comes from the API.** Given a surfacing event, when the host speaks, then the
  spoken `utterance` is the value returned by `/narrate` (stubbed in tests), **not** the M2 canned
  placeholder. _(The M2 `speak`/character path is unchanged; only the text source moves.)_
- **[frontend] On narration failure, the host stays silent.** Given `/narrate` errors/rejects/times
  out, when an event surfaces, then **no `speak` is forced** with an empty/broken line — the host
  degrades to **idle/quiet** (the player may still cut to the vantage). A broken line is worse than
  silence; this preserves the silence-budget spirit. _(Test: stub `/narrate` to reject; assert
  `speak` is not called / no speaking state with empty text.)_

## BASED INVARIANTS (prove with tests on the paths that need them — ADR 0003)
M3 lights up the first LLM/backend path. It newly **proves 4 and 6**, and keeps **1 and 5**:
1. **Spoiler-safety** — KEPT + EXTENDED to a generated line. The §10 prompt forbids outcomes;
   tiers 2–4 hedge; the proxy must not pass an outcome-bearing line through. Forced by the
   backend spoiler/tier bullet. _(Directive `spoilerSafe: true` remains compiler-enforced from M2.)_
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
- [ ] **M3  — real Gemini narration: `/narrate` proxy + FE swap  *(backend → frontend)*  ← IN FLIGHT**
- [ ] M4  — two-level ranking + "while you were gone" digest  *(frontend)*
- [ ] E2E — one DoD journey  *(playwright)*
- [ ] M5  — (stretch) thin real heat

## SUGGESTED CYCLE ORDER (orchestrator — cross-layer: backend contract FIRST, then FE)
Architect confirms the seam, then smallest seams first with the two new invariants explicit:
0. **DESIGN — architect** confirms/extends the `/narrate` seam + records an ADR (gate before RED).
1. **[backend] valid payload → one short line** — happy path + the `{ utterance }` shape. *(first RED)*
2. **[backend] malformed → 400, no spend** — zod rejects; the Gemini stub records zero calls.
3. **[backend] INVARIANT secrets-from-env** — body key ignored; env key only; nothing key-bearing in
   response/logs.
4. **[backend] INVARIANT spoiler-safety + tier-hedging** — anticipation-only (no outcome echo); tier
   1 plain vs tier ≥2 hedged (stubbed model + prompt-shaping assertions).
5. **[frontend] INVARIANT cost-gating** — zero `/narrate` calls on idle; exactly one per surfacing
   event (stub the client).
6. **[frontend] utterance from API** — the host speaks the `/narrate` result, not the canned placeholder.
7. **[frontend] failure → host stays silent** — `/narrate` rejects → no forced/empty `speak`.
Then: tdd-critic (~3–5 cycles), qa-verifier (drive the live wake→speak→cut and confirm the line is
LLM-generated, spoiler-safe, and that a forced failure degrades to silence), PO acceptance → M4.
