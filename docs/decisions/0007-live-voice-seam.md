# 0007 — Live-voice seam: streamed-audio narration over the Gemini Live (WSS) API

## Status

Accepted (prototype phase). Extends ADR 0003 (boundaries + Based invariants),
ADR 0004 (the §6 seam), ADR 0005 (staging topology), and ADR 0006 (the `/narrate`
seam M3 built). Gates **LV1 · Live-voice host** BUILD; no RED until this is in
place. Append-only. Resolves the §13 **voice-identity** call (navigator chose
native streamed audio from `gemini-3.1-flash-live-preview` over the Gemini Live
API). Does **not** change the §6 types in `frontend/src/contracts/`.

## Context

M3 gave the host a real, LLM-generated line over a one-shot HTTP contract: FE
`narrate-client` → `POST /narrate` → `{ utterance }` text → FE `speak()`
(Web Speech). LV1 keeps the same *decision* loop but changes **how the line is
voiced**: the host now speaks in **native streamed audio** from
`gemini-3.1-flash-live-preview` over the **Gemini Live (WebSocket) API**, replacing
the browser's robotic Web Speech TTS. This is the deliberate-voice direction the
§13 voice-identity call asked for and the foundation for a conversational host
(brief §1 "a product with a face", §8 voice).

Three facts make this seam-touching and worth recording:

1. **The transport changes from request/response to a realtime session.** A
   WebSocket session streams audio *out*; the FE plays it via the Web Audio API.
   `POST /narrate` returns a finished string; a Live session emits audio frames over
   time. The host loop's *contract* (it decides when/whether to voice a line) must
   not change — only the renderer behind the seam does.

2. **Key-safety is now over WSS — the load-bearing call.** M3's secrets-from-env
   proof relied on the key living server-side because the browser only ever talked to
   *our* backend (ADR 0006 #secrets). A realtime audio session naively wired would
   have the browser open the Gemini socket directly **with the long-lived
   `GEMINI_API_KEY`** — an immediate secrets-from-env violation (the highest-risk
   invariant for this milestone, flagged in `backlog.md`). The topology must keep the
   long-lived key off the wire and out of the client bundle.

3. **The cost-gating shape must survive a session.** A WebSocket invites a
   persistent open "mic." The Based invariants (ADR 0003 #4 cost-gating, #2 silence
   budget) require narration to fire **only on a surfacing event**, one voiced
   utterance per surface, never a continuous stream — the M3 call-gate and D1's "no
   storm" carried onto a session model.

## Decision

### 1. Key-safety topology — RECOMMEND (a) **ephemeral token**, browser-direct WSS

The browser opens the **Gemini Live WSS directly**, authenticated with a
**short-lived, scoped token minted server-side** from the long-lived key. A new
backend endpoint — `POST /live-token` in `backend/src/modules/live/` (mirroring the
`modules/narrate/` convention) — reads `GEMINI_API_KEY` from `process.env` only and
returns `{ token, expiresAt, /* + the model/connect params the client needs */ }`.
The long-lived key **never reaches the browser**.

**Why (a) over (b):**

- **Secrets-from-env, re-proven over WSS.** The long-lived `GEMINI_API_KEY` stays
  `process.env`-only — never accepted from a body, never logged, never returned, never
  in the client bundle (the M3 guarantee, ADR 0006 #secrets, carried verbatim). The
  *only* credential that touches the browser is the **ephemeral token**:
  **short-lived** (a brief TTL), **scoped** (Live-session use only, ideally a single
  session), and **server-minted** (the client cannot forge it). A leaked token expires
  on its own and cannot be replayed into a long-lived key. The mint is structurally a
  copy of the M3 `/narrate` topology — the FE talks to *our* backend over HTTPS for a
  credential; only the *audio* transport is new.

- **Fits the staging topology (ADR 0005) with no new long-running infra.** App Runner
  keeps serving plain HTTP request/response (`/health`, `/narrate`, and now the brief
  `/live-token` mint); it does **not** have to hold open WebSocket sockets. This
  preserves the "bills while running / tear down between demos" posture and avoids the
  open question of whether App Runner cleanly proxies long-lived WSS.

- **Fits the cost-gating shape.** The token is minted on a **surfacing event** — the
  same gate point the M3 `/narrate` call sits in — so a token (and therefore a
  session) opens only when the host actually surfaces, bounded per surface. No idle
  socket to our backend.

**Fallback — (b) backend WSS relay — documented, not chosen.** If
`gemini-3.1-flash-live-preview` does **not** support ephemeral/auth tokens for
browser clients (the key API specific to confirm at BUILD — see below), fall back to
(b): the browser connects to **our** backend over WSS (e.g. `@fastify/websocket`),
which relays frames to Gemini's Live WSS with the key fully server-side. This keeps
secrets-from-env equally (the key never leaves the server) but costs more: a
persistent relay socket per client, a new WS dependency, and a **must-confirm** that
App Runner passes WSS through (ADR 0005 only health-checks HTTP). It is also in mild
tension with the cost-gating *spirit* (the relay itself is a long-lived socket even
when narration is gated), so it must still open the relay only on a surfacing event
and close it when the utterance ends. **Critically, (b) is a swap behind the same FE
seam (§2): only the audio-narrator's transport changes; the host loop, character, and
player do not reshape.** Re-sequence and log here if BUILD research forces (b).

### 2. Audio pipeline — swap behind the existing injectable speak seam

The M2 `speak(text)` Web Speech path (`frontend/src/lib/speak.ts`) is replaced by an
**audio-narrator** that voices a line by opening a Live session and playing the
streamed audio frames via the Web Audio API (`AudioContext`). The swap stays behind
the **already-abstracted seam** so the character/player and the host loop do not
reshape and tests can inject a fake.

- **Generalize the seam from "say this text" to "voice this line."** Today
  `Speaker = (text: string) => void` (fire-and-forget, synchronous). An audio session
  is asynchronous and has a lifecycle (opens, streams, ends/fails). The seam becomes a
  small **async, lifecycle-aware narrator interface** the loop drives — conceptually:

  ```ts
  // The injectable voice seam LV1 builds against. Web Speech and the Live-audio
  // narrator both satisfy it; tests inject a fake. Exact method names are the
  // implementer's; the SHAPE is: voice one line, async, completes/fails, idempotent stop.
  interface VoiceNarrator {
    // Voice exactly one line. Resolves when the utterance has finished playing
    // (so the character can return to idle); rejects/throws on session failure.
    speak(text: string): Promise<void>;
    // Idempotent: stop any in-flight audio (e.g. a manual surf overrides the host).
    stop?(): void;
  }
  ```

  The existing `createSpeak()` is trivially adapted to this shape (wrap the
  fire-and-forget Web Speech call in a resolved promise), so it remains a valid
  fallback narrator and the test fakes stay tiny.

- **`speaking` is gated on audio playing, not on `speechSynthesis`.** The character's
  `idle`/`speaking` states still drive off the **same `HostDirective` stream** off the
  bus; `speaking` now reflects **audio actually playing** and reverts to `idle` when
  the `speak(...)` promise resolves (utterance ended) — the silent↔active mechanic
  (M2) is preserved, only the signal source moves from a Web Speech event to the audio
  lifecycle.

- **The audio-narrator owns the Live session + the token client.** It calls
  `/live-token` (the injectable token client, mirroring the M3 `narrate-client`
  seam), opens the Gemini Live WSS with the token, feeds the system instruction +
  the line, plays the streamed audio, and resolves when playback ends. The session is
  an **internal detail of the narrator** — it never surfaces to the character or
  player. The cut still renders `cutToVantage.embedUrl` verbatim (untouched).

### 3. Fit to the host loop — M2/M3 invariants unchanged

LV1 changes **only HOW a line is voiced**, never **WHEN/WHETHER** the host speaks.
The client host loop (`frontend/src/lib/host-loop.ts` + `narrating-host-loop.ts`)
stays the decision-maker:

- **Cost-gating + silence budget UNCHANGED.** The loop still emits the `speak`
  intent only when an event clears the surface threshold *and* the silence budget;
  the audio session (and the `/live-token` mint that precedes it) opens **only in that
  branch** — exactly where the M3 `/narrate` call sits. One voiced utterance per
  surface; **never a continuous open mic**; no session on idle/timer. Asserted as
  bounded session opens (zero on idle, one per surface), not a persistent firehose.

- **Failure → degrade to silence.** A failed/empty audio session (token mint fails,
  WSS errors, empty stream) **degrades to silence** — the host stays `idle`, no forced
  noise — and the player **may still cut** to the vantage. This is the M2/M3
  failure-silent guard (`narrating-host-loop.ts` drops the `speak` directive on
  failure, keeps the `cutTo`), carried onto the audio path. The narrator's
  `speak(...)` rejecting is the signal; the loop already handles a dropped `speak`.

- **Spoiler-safety stays prompt-enforced (ADR 0006).** The §10 no-spoiler +
  tier-hedging rules now live in the **Live session's system instruction** instead of
  the `/narrate` prompt — the audio is just a different *rendering* of the same
  prompted line, so the prompt remains the control. No runtime outcome oracle (still
  infeasible, ADR 0006); every `HostDirective` stays compiler-enforced
  `spoilerSafe: true` (ADR 0004); a failed/unverified session degrades to silence.
  The accepted residual risk (the model could still emit a spoiler; the prompt is the
  control) is unchanged from M3.

### 4. The stable interface for the pair (test-writer / implementer)

Build against these seams; the Gemini Live transport is **stubbed** in the suite (the
suite never opens a real socket and never plays real audio — assert on session-gating,
the key/token topology, audio-lifecycle wiring, and failure-degrades-to-silence,
never on audio quality):

- **`[backend]` `POST /live-token`** in `backend/src/modules/live/` — its **own local
  zod schema** (no cross-workspace import; ADR 0003/0006). Reads `GEMINI_API_KEY` and
  the model id (`GEMINI_LIVE_MODEL` env knob, default `gemini-3.1-flash-live-preview`)
  from `process.env` **only**; mints + returns a short-lived scoped token (shape
  `{ token, expiresAt, ... }` — fields confirmed at BUILD). The long-lived key is
  **never** accepted from the body, **never** logged, **never** in the response. The
  token-mint client (the upstream call to Google's mint API) is **injectable** like
  M3's `GeminiClient`, so tests stub it.

- **`[frontend]` `VoiceNarrator`** (the generalized speak seam, §2): one async
  `speak(text): Promise<void>` that resolves on utterance-end and rejects on failure
  (+ optional idempotent `stop()`). The host-loop/character consume this; tests inject
  a fake narrator. The Web-Speech `createSpeak()` is adapted to satisfy it (fallback
  + tiny test fakes).

- **`[frontend]` the audio-narrator + `live-token` client** (e.g.
  `frontend/src/lib/live-narrator.ts` + `live-token-client.ts`, mirroring
  `narrate-client.ts`): the `VoiceNarrator` implementation that mints a token, opens
  the Live WSS, plays streamed audio via `AudioContext`, and owns the session
  lifecycle. The WSS + `AudioContext` are the injectable I/O edge (the untested edge,
  like `gemini-client.ts`'s `fetch`); tests inject fakes for both.

- **Unchanged seams (the pair must NOT reshape these):** `frontend/src/contracts/`
  (the §6 `HostDirective` keeps its M2 shape — `utterance` is still the line; the
  audio is a rendering of it), `host-loop.ts` / `narrating-host-loop.ts` (decision +
  cost-gate + failure-silent logic), the character/player components (consume the same
  `HostDirective` stream), and the cut (`cutToVantage.embedUrl` verbatim).

### 5. Invariants to RE-PROVE with tests on this path (ADR 0003)

LV1 emits narration over a new transport, so per CLAUDE.md the pair must re-prove,
with the transport stubbed:

- **Secrets-from-env over WSS (highest risk).** `POST /live-token` reads
  `GEMINI_API_KEY` from `process.env` only; a bogus key in the body is ignored; the
  long-lived key appears in **no** response body and **no** log line; the minted token
  is short-lived + scoped + server-minted (the only credential the browser holds).
  *(Mirror M3's secrets test on the new endpoint.)*

- **Cost-gating over a session.** Zero token mints / session opens on idle; exactly
  one per surfacing event; bounded per surface — **never** a persistent/continuous
  session. *(The D1 "no storm" instinct carried to sessions.)*

- **Silence budget / failure-silent.** A failed or empty session degrades to
  **silence** (no forced noise); the host stays `idle`; the player may still cut.

- **Spoiler-safety via the Live system instruction.** The §10 no-spoiler +
  tier-hedging rules are carried in the Live session's system instruction (the prompt
  remains the control, ADR 0006); every `HostDirective` stays compiler-enforced
  `spoilerSafe: true`.

- **Official embeds only — KEPT, unchanged.** The audio path never touches
  embeds/vantages; the cut still renders `cutToVantage.embedUrl` verbatim.

### 6. API specifics to CONFIRM at BUILD (a research step may precede the first RED)

These are **implementation minutiae**, not seam decisions — flagged explicitly so
they are verified against Google's docs before coding, not guessed:

- The exact **`gemini-3.1-flash-live-preview` model id** and the **Gemini Live WSS
  endpoint** (URL + connect/setup message shape). Wire the model id via
  `GEMINI_LIVE_MODEL` env — do **not** hardcode (ADR 0006 convention).
- **The ephemeral-token mint API** — *does it exist for this model/SDK, what scopes
  and TTL it supports, and the exact mint call.* **This is the gate for the
  recommended topology (a):** if no ephemeral-token mint is available for browser
  clients, fall back to (b) the backend WSS relay (§1) — same FE seam, log the
  re-sequence here.
- The **audio frame format** the Live API streams (PCM encoding, sample rate, frame
  size) and how to feed it to `AudioContext` (decode/`AudioBufferSourceNode` vs an
  `AudioWorklet`); also the input/output audio config in the session setup.
- For the **fallback (b) only:** that **App Runner passes WSS through** (ADR 0005 only
  health-checks HTTP) and the `@fastify/websocket` (or equivalent) wiring.

## Consequences

- The host gains a **real, deliberate voice** — native streamed Gemini audio replaces
  Web Speech — resolving the §13 voice-identity call and laying the conversational-host
  foundation (the Live API is bidirectional; LV1 uses only the OUT direction).
- A new backend module `backend/src/modules/live/` (`/live-token` + local zod schema +
  injectable token-mint client) joins `modules/narrate/`. Whether **`/narrate` is
  retired** depends on the BUILD shape: the Live session may take the safe-input
  projection directly (making the M3 one-shot proxy redundant for voicing), or
  `/narrate` may still produce the *text* the Live session then voices. **Either way
  the §6 contracts are untouched** and the decision is an implementation detail inside
  the audio-narrator — record a follow-up note here when BUILD settles it; do not
  pre-commit.
- The injectable speak seam **generalizes** from `(text) => void` to an async,
  lifecycle-aware `VoiceNarrator`. This is a small, faithful widening (it must voice a
  line that now has a duration and can fail), and Web Speech still satisfies it as a
  fallback — so the character/player and host loop do not reshape.
- **App Runner / ADR 0005 are unchanged for the recommended topology (a):** the
  backend stays HTTP request/response; no long-running socket. Only the fallback (b)
  would add a WSS relay and the App-Runner-WSS confirmation.
- New env knobs: `GEMINI_LIVE_MODEL` (default `gemini-3.1-flash-live-preview`);
  `GEMINI_API_KEY` is reused (already SSM SecureString → App Runner, ADR 0005). The FE
  reaches `/live-token` via the same `VITE_API_BASE_URL` base as `/narrate`.
- Backend-local validation means the `/live-token` schema is, like `/narrate`, an
  independent restatement (no cross-workspace runtime coupling, ADR 0003) — the
  accepted prototype cost.

## Alternatives considered

- **(b) Backend WSS relay/proxy as the primary choice.** Key fully server-side, no
  reliance on an ephemeral-token API. Rejected as the *primary* because it adds a
  persistent relay socket per client, a new WS dependency, and a hard dependency on App
  Runner passing WSS through (ADR 0005 health-checks only HTTP) — more infra and more
  surface than (a), and a long-lived socket in tension with the cost-gating spirit.
  **Kept as the documented fallback** if ephemeral tokens are unavailable, since it is
  a transport swap behind the same FE seam.
- **Browser opens the Gemini Live WSS with the long-lived `GEMINI_API_KEY`
  directly.** Simplest, zero backend. **Rejected** outright — an immediate
  secrets-from-env violation (the key in the client bundle / on the wire), the exact
  failure ADR 0003 #6 and ADR 0006 exist to prevent, and the highest-risk trap of this
  milestone.
- **Keep Web Speech; do nothing.** Cheapest, but the §13 navigator decision is
  explicitly to replace the robotic Web Speech voice with deliberate streamed audio —
  the visible gap between "ranked list with TTS" and "an AI host you'd lean back and
  watch." Rejected per the navigator's call.
- **Generate audio with a separate one-shot TTS API** (e.g. text → audio file → play),
  not the Live API. Simpler transport (HTTP, like M3) and would still beat Web Speech,
  but it is **not** the bidirectional Live foundation the navigator chose and the
  backlog names (`gemini-3.1-flash-live-preview` over the Live WSS, the conversational
  foundation). Rejected for LV1; could be a lower-risk fallback if *both* (a) and (b)
  prove infeasible at BUILD — log here if so.
- **Reshape `HostDirective` to carry an audio stream / session handle.** Speculative
  and leaks transport detail into the §6 seam the UI consumes. Rejected — the directive
  still carries `utterance` (the line); the audio is a rendering owned by the narrator
  (ADR 0004 minimalism; ADR 0003 contracts-as-seam).
- **Open the Live session on load / keep it warm to cut latency.** A persistent open
  mic — directly violates cost-gating + silence budget (ADR 0003 #4/#2). Rejected;
  sessions open on a surfacing event only and close when the utterance ends.
