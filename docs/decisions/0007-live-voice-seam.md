# 0007 — Live-voice seam: streamed-audio narration over the Gemini Live (WSS) API

## Status

Accepted (prototype phase). **Topology gate RESOLVED → (b) backend WSS relay**
(see Decision §1; ground-truth study below). **⚠ RE-OPENED by Amendment B
(2026-06-03): a live-API probe found the header-justification for §1's relay is
empirically wrong (the WSS authenticates via a `?access_token=` query param a browser
CAN set, not an `Authorization` header) — Amendment B RECOMMENDS (a) browser-direct,
gated on a browser-handshake check (B2), which would REVERSE Amendment A2's ECS infra.
Read Amendment B before §1. Corrections to the mint/method/wire (B0) apply regardless
of topology.** Extends ADR 0003 (boundaries + Based
invariants), ADR 0004 (the §6 seam), ADR 0005 (staging topology), and ADR 0006
(the `/narrate` seam M3 built). Gates **LV1 · Live-voice host** BUILD; the seam
surface below is now stable enough for the first RED. Append-only. Resolves the §13
**voice-identity** call (navigator chose native streamed audio from
`gemini-3.1-flash-live-preview` over the Gemini Live API). Does **not** change the
§6 types in `frontend/src/contracts/`.

> **Amendment (topology resolved).** The original Decision §1 *recommended* topology
> (a) browser-direct WSS with a server-minted ephemeral token, and kept (b) backend
> relay as a documented fallback, with the choice **gated** on "does an ephemeral
> token usable by a browser client exist for this model/SDK." A reference study of
> **`github.com/geda0/gvp`** (the navigator's "how the model is actually used"
> reference) resolves that gate the other way: **(b) backend WSS relay is the
> working topology**, because **a browser cannot set the custom `Authorization`
> header the Live WSS requires** — the ephemeral token must be attached server-side.
> §1 below is rewritten to record (b) as the chosen topology with the full wire
> contract; (a) moves to Alternatives with the rejecting evidence. The FE seam (§2)
> and the host-loop fit (§3) are **unchanged** — this was always a transport swap
> behind the same `VoiceNarrator`.

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

### Reference study — `github.com/geda0/gvp` (ground truth for the wire)

The navigator provided **gvp** as a working reference for how the Gemini Live API is
used in practice. It is treated as ground truth for the wire contract and resolves
the topology gate this ADR opened. What it establishes (cited inline below where
load-bearing):

- **Topology in practice is a backend relay, not browser-direct.** gvp mints a
  short-lived ephemeral token **server-side**, but the browser still connects to a
  backend **WSS relay on gvp's own host**; the relay opens the upstream Google WSS
  with the request header `Authorization: Token <ephemeral>`. The load-bearing
  reason: **browsers cannot set custom headers on a WebSocket handshake**, so the
  `Authorization: Token` header *must* be attached server-side. gvp's code contains a
  pure browser-direct variant (`wss://…?access_token=<token>`) but it is **disabled
  in practice** — it "typically fails with Google close 1011." gvp's relay defaults
  **ON**. Working topology: **browser → backend WSS relay → Google WSS**.

- **Ephemeral-token mint (server-side)** via the `@google/genai` SDK
  `authTokens.create` (Based's backend is **TypeScript/Node**, so the JS
  `@google/genai` SDK with `http_options { api_version: 'v1alpha' }`): single-use
  (`uses: 1`), a short window (~3 min) to OPEN the session
  (`newSessionExpireTime`), a 10-min hard expiry. No `LiveConnectConstraints` are
  baked into the token — the setup frame carries model + system instruction. The raw
  `GEMINI_API_KEY` never leaves the server; in the relay topology even the ephemeral
  token stays server-side (the browser only ever talks to our relay).

- **WSS endpoint + setup frame (the wire).** Endpoint
  `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent`
  (gvp uses the `…BidiGenerateContentConstrained` variant for the relay; plain
  `BidiGenerateContent` also works). First message is a `setup` frame: the model id
  appears **prefixed** as `models/gemini-3.1-flash-live-preview`;
  `generationConfig.responseModalities` must be **exactly ONE** modality
  (mixing AUDIO + TEXT silently hangs ~45–60 s); `systemInstruction.parts[].text`
  carries the persona; optional `outputAudioTranscription: {}` yields the spoken text
  *without* a second modality.

- **Make the model speak a fixed line with NO mic.** Send a `clientContent` turn —
  `{ clientContent: { turns: [{ role: 'user', parts: [{ text: 'Speak only these
  exact words… Say: "<TEXT>"' }] }], turnComplete: true } }`. Audio streams back; no
  mic is ever attached. This is exactly Based's narration case (output/TTS only).

- **Audio (output only for Based).** Google streams
  `serverContent.modelTurn.parts[].inlineData`, `mimeType "audio/pcm;rate=24000"` =
  **16-bit signed PCM, mono, 24 kHz, little-endian, base64**. Browser playback = a
  Web Audio `AudioContext` jitter buffer (decode b64 → Int16 → Float32 →
  `createBuffer` + `copyToChannel` → scheduled `BufferSource`s for gapless play). No
  `AudioWorklet` is needed for playback. Mic input (16 kHz) is **not** needed for
  narration.

## Decision

### 1. Key-safety topology — RESOLVED: **(b) backend WSS relay**

The browser connects to **our** backend over **WSS** — a new relay endpoint
`backend/.../live/…` (e.g. `GET /live/relay`, WS upgrade) — and the **relay** opens
the upstream Google Live WSS. The relay attaches the credential the browser cannot:
the request header `Authorization: Token <ephemeral>`. The long-lived
`GEMINI_API_KEY` and (in this topology) even the **ephemeral token** stay entirely
server-side; the browser only ever talks to our relay.

A second backend endpoint mints the ephemeral token the relay uses:
`POST /live/session` in `backend/src/modules/live/` (mirroring the
`modules/narrate/` convention) reads `GEMINI_API_KEY` from `process.env` only and
mints the short-lived token via the `@google/genai` SDK `authTokens.create`. Whether
the FE calls `POST /live/session` and the relay only forwards, or the relay mints the
token internally on upgrade, is an **implementation detail of the backend** (the
relay can do both server-side); the **seam surface** the FE builds against is just
"open a WS to our relay endpoint and exchange Live frames." The token never needs to
reach the browser in this topology.

**Why (b) is the resolved choice (the gate this ADR opened, now closed):**

- **A browser cannot set the `Authorization` header on a WebSocket.** The Live WSS
  authenticates the upstream connection via the `Authorization: Token <ephemeral>`
  request header, which the WHATWG/browser WebSocket API does not let client JS set.
  Per gvp, the only working path is to attach that header **server-side**, i.e. a
  relay. The browser-direct query-param variant
  (`wss://…?access_token=<token>`) exists but **fails in practice with Google
  close 1011** (gvp disables it; its relay defaults on). This is the empirical fact
  that flips the original recommendation.

- **Secrets-from-env is *strengthened*, not just preserved.** The long-lived
  `GEMINI_API_KEY` stays `process.env`-only (the M3 guarantee, ADR 0006 #secrets,
  carried verbatim). In the relay topology the **ephemeral token also never reaches
  the browser** — the only thing the client holds is a socket to *our* origin. There
  is strictly less credential surface on the wire than topology (a) would have had.

- **Cost-gating shape is preserved (see §3).** The relay socket and the upstream Live
  session are opened **only on a surfacing `speak` directive**, and torn down per the
  session-lifecycle rule below — never an idle open mic.

**The cost of (b) — recorded, not hidden:** it needs a **persistent-WebSocket-capable
host** for the relay (gvp runs it on ECS/Fargate + ALB and explicitly notes API
Gateway/Lambda cannot upgrade the browser WS). Based's backend runs on **AWS App
Runner**; whether App Runner supports inbound WSS is an **open infra prerequisite**
(Consequences) being researched in parallel — do **not** assume it is resolved. The
fallback if App Runner cannot host the relay is a **separate small WS service**
(e.g. a tiny Fargate/ALB or equivalent persistent-socket host) running only the
relay; this is an infra placement detail and does **not** change the FE seam (§2).

### 2. The wire contract (what the relay sends upstream; what the narrator consumes)

This is the load-bearing detail the implementer codes against; it comes from the gvp
study above and is stated here so it is not re-guessed:

- **Upstream endpoint (relay → Google):**
  `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent`
  (the `…Constrained` variant also works), with request header
  `Authorization: Token <ephemeral>`.

- **`setup` frame — sent ONCE, server-side, by the relay.** The browser **must NOT**
  re-send `setup`. Shape:
  ```jsonc
  {
    "setup": {
      "model": "models/gemini-3.1-flash-live-preview",   // PREFIXED with models/
      "generationConfig": { "responseModalities": ["AUDIO"] }, // EXACTLY ONE modality
      "systemInstruction": { "parts": [{ "text": "<persona + no-spoiler/no-improvise rule>" }] },
      "outputAudioTranscription": {}                      // optional: spoken text w/o a 2nd modality
    }
  }
  ```
  `responseModalities` is **exactly `["AUDIO"]`** for narration — **never**
  `["AUDIO","TEXT"]` (mixing silently hangs ~45–60 s). The spoken text, if needed for
  captions/debug, comes from `outputAudioTranscription`, not a TEXT modality.

- **Speak-a-fixed-line turn (no mic).** To voice one already-decided line, send a
  `clientContent` turn:
  ```jsonc
  { "clientContent": {
      "turns": [{ "role": "user",
        "parts": [{ "text": "Speak only these exact words. Do not add anything. Say: \"<UTTERANCE>\"" }] }],
      "turnComplete": true } }
  ```
  Audio streams back; **no mic/input-audio is ever attached.** `<UTTERANCE>` is the
  already-spoiler-safe `HostDirective.utterance` (see §3 / invariants).

- **Audio out.** Frames arrive as `serverContent.modelTurn.parts[].inlineData`,
  `mimeType "audio/pcm;rate=24000"` = **16-bit signed PCM, mono, 24 kHz,
  little-endian, base64**. The narrator decodes b64 → `Int16Array` → `Float32` →
  `AudioContext.createBuffer` + `copyToChannel` → scheduled `AudioBufferSourceNode`s
  for gapless playback (a small jitter buffer; no `AudioWorklet` for playback). The
  utterance is "done" when the server signals turn completion and the scheduled
  buffers have drained — that is what resolves the narrator's `speak(...)` promise
  (§2-FE, §3).

### 3. Session lifecycle — RECOMMEND **open/close per utterance** for LV1

A Live session can be either **(i) opened once and kept warm**, reused across
utterances (fewer setup round-trips, lower per-line latency, cheaper if utterances
are frequent), or **(ii) opened on each surfacing event and closed when the utterance
ends** (no socket held while idle; simplest to reason about against cost-gating).

**Recommendation for LV1: (ii) open/close per surfacing `speak`.** It maps the
relay+upstream session lifetime exactly onto the existing cost-gate — a session
exists **iff** the host is currently voicing a surfaced line — which makes the
cost-gating and silence-budget invariants *structurally* true (no idle socket to
assert away) and matches the M3 gate point. Latency of an extra setup per line is
acceptable for the prototype's surfacing cadence (lines are seconds apart at most,
gated by the silence budget).

**(i) warm-session is recorded as a deliberate, ADR-gated option**, not a free
optimization: keeping a session warm means a relay+upstream socket is open while the
host is idle, which is in tension with cost-gating #4 / silence-budget #2 unless
paired with an explicit idle-timeout that closes it. If a future latency measurement
justifies it, switch to (i) **with** an idle-close timeout and record the change
here (append-only) — do not adopt it implicitly.

### 4. The FE seam — swap behind the existing injectable `VoiceNarrator` (UNCHANGED)

LV1 changes **only HOW a line is voiced**, never **WHEN/WHETHER**. The M2 `speak(text)`
Web Speech path (`frontend/src/lib/speak.ts`) is replaced by an **audio-narrator** that
voices a line by opening a Live session (through our relay) and playing the streamed
audio via `AudioContext`. The swap stays behind the **already-abstracted seam** so the
character/player and the host loop do not reshape and tests can inject a fake.

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

- **The audio-narrator owns the relay connection + the Live session.** It opens a WS
  to our **relay endpoint** (the injectable I/O edge), sends the `clientContent` turn
  with the line, plays the streamed PCM, and resolves when playback ends. The relay
  connection and the upstream Live session are an **internal detail of the narrator** —
  they never surface to the character or player. The browser **never** sees the
  ephemeral token or the key (topology b). The cut still renders
  `cutToVantage.embedUrl` verbatim (untouched).

### 5. Fit to the host loop — M2/M3 invariants unchanged

The client host loop (`frontend/src/lib/host-loop.ts` + `narrating-host-loop.ts`)
stays the decision-maker. LV1 sits **behind** the existing speak path:

- **Cost-gating + silence budget UNCHANGED.** The loop still emits the `speak` intent
  only when an event clears the surface threshold *and* the silence budget; the relay
  connection + Live session (open/close per §3) open **only in that branch** — exactly
  where the M3 `/narrate` call sits. One voiced utterance per surface; **never a
  continuous open mic**; no session on idle/timer. Asserted as bounded session/relay
  opens (zero on idle, one per surface), not a persistent firehose.

- **Failure → degrade to silence.** A failed/empty session (token mint fails, relay or
  upstream WSS errors, close 1011, empty stream) **degrades to silence** — the host
  stays `idle`, no forced noise — and the player **may still cut** to the vantage. This
  is the M2/M3 failure-silent guard (`narrating-host-loop.ts` drops the `speak`
  directive on failure, keeps the `cutTo`), carried onto the audio path. The narrator's
  `speak(...)` rejecting is the signal; the loop already handles a dropped `speak`.

### 6. Spoiler-safety — the text path remains the single source of truth (CRITICAL)

**The Live API enforces NOTHING about content.** gvp's only content guardrail is the
system-instruction *text*; there is no server-side spoiler filter. Therefore
spoiler-safety must be enforced **before** any text reaches the `clientContent` turn.
Decision:

- The existing **spoiler-safe text generation is the single source of truth for what
  is spoken.** Today that is the `/narrate` Gemini *text* path producing
  `HostDirective.utterance`, prompt-enforced no-spoiler + tier-hedging per ADR 0006.
  **LV1 swaps only the *transport* of that already-spoiler-safe utterance** — from
  browser `speechSynthesis` to Gemini Live audio. The line the relay tells the model
  to "speak only these exact words" of is the *already-safe* `utterance`.

- The Live `setup.systemInstruction` **additionally restates** the
  no-spoiler / no-improvise rule (defense-in-depth, e.g. "speak only the words you are
  given; never add or predict an outcome"), but it is **not** the primary control. The
  primary control is that we hand the model an already-safe line and constrain it to
  speak exactly that line.

- No runtime outcome oracle (still infeasible, ADR 0006); every `HostDirective` stays
  compiler-enforced `spoilerSafe: true` (ADR 0004); a failed/unverified session
  degrades to silence. The accepted residual risk (the model could in principle still
  deviate; the prompt + "speak only these words" is the control) is unchanged from M3.

### 7. The stable interface for the pair (test-writer / implementer)

Build against these seams; the Gemini Live transport and the relay are **stubbed** in
the suite (the suite never opens a real socket and never plays real audio — assert on
session/relay-gating, the key/token topology, audio-lifecycle wiring, and
failure-degrades-to-silence, never on audio quality):

- **`[backend]` the live module — `backend/src/modules/live/`:**
  - **`POST /live/session`** — mints the short-lived ephemeral token via
    `@google/genai` `authTokens.create` (single-use, ~3-min open window, 10-min hard
    expiry). Its **own local zod schema** for any request body (no cross-workspace
    import; ADR 0003/0006). Reads `GEMINI_API_KEY` and the model id
    (`GEMINI_LIVE_MODEL` env knob, default `gemini-3.1-flash-live-preview`) from
    `process.env` **only**. The long-lived key is **never** accepted from the body,
    **never** logged, **never** in the response. The `@google/genai` mint call is
    **injectable** (like M3's `GeminiClient`) so tests stub it. In topology (b) the
    token need not be returned to the browser at all (the relay holds it); if the
    relay mints internally on upgrade, this endpoint may be subsumed — record which at
    BUILD.
  - **the WSS relay endpoint** (WS upgrade, e.g. `GET /live/relay`) — accepts the
    browser WS, opens the upstream Google Live WSS with header
    `Authorization: Token <ephemeral>`, sends the **`setup` frame once** (model +
    `responseModalities: ["AUDIO"]` + persona/no-spoiler `systemInstruction` +
    `outputAudioTranscription`), forwards the browser's `clientContent` turn upstream,
    and pipes `serverContent` audio frames back to the browser. The upstream socket is
    the injectable I/O edge; tests stub it. Opened only on a surfacing `speak` (§3/§5),
    closed when the utterance ends.

- **`[frontend]` `VoiceNarrator`** (the generalized speak seam, §4): one async
  `speak(text): Promise<void>` that resolves on utterance-end and rejects on failure
  (+ optional idempotent `stop()`). The host-loop/character consume this; tests inject
  a fake narrator. The Web-Speech `createSpeak()` is adapted to satisfy it (fallback
  + tiny test fakes).

- **`[frontend]` the audio-narrator** (e.g. `frontend/src/lib/live-narrator.ts`,
  generalizing today's `speak.ts`): the `VoiceNarrator` implementation that opens a WS
  to our **relay endpoint**, sends the `clientContent` line turn, decodes + plays the
  PCM frames via `AudioContext`, and owns the connection lifecycle. The relay WS and
  `AudioContext` are the injectable I/O edge (the untested edge, like
  `gemini-client.ts`'s `fetch`); tests inject fakes for both. The browser holds **no**
  token/key (topology b).

- **Unchanged seams (the pair must NOT reshape these):** `frontend/src/contracts/`
  (the §6 `HostDirective` keeps its M2 shape — `utterance` is still the line; the audio
  is a rendering of it), `host-loop.ts` / `narrating-host-loop.ts` (decision +
  cost-gate + failure-silent logic), the character/player components (consume the same
  `HostDirective` stream), and the cut (`cutToVantage.embedUrl` verbatim). The
  `/narrate` text path is the source of the (already-safe) line; **§6 contracts and
  the host loop / cost-gating do not change.**

### 8. Invariants to RE-PROVE with tests on this path (ADR 0003)

LV1 emits narration over a new transport, so per CLAUDE.md the pair must re-prove,
with the transport/relay stubbed:

- **Secrets-from-env over WSS (highest risk).** `POST /live/session` (and/or the
  relay) reads `GEMINI_API_KEY` from `process.env` only; a bogus key in the body is
  ignored; the long-lived key appears in **no** response body and **no** log line; in
  topology (b) **the ephemeral token never reaches the browser** (the relay holds it).
  *(Mirror M3's secrets test on the new endpoint/relay.)*

- **Cost-gating over a session.** Zero session/relay opens on idle; exactly one per
  surfacing event; bounded per surface — **never** a persistent/continuous session.
  Per §3 the session is opened/closed per utterance, so this is structurally true.
  *(The D1 "no storm" instinct carried to sessions.)*

- **Silence budget / failure-silent.** A failed or empty session (incl. a close 1011)
  degrades to **silence** (no forced noise); the host stays `idle`; the player may
  still cut.

- **Spoiler-safety — text path is the source of truth.** The spoken line is the
  already-spoiler-safe `HostDirective.utterance` (the `/narrate` text path, ADR 0006);
  the relay constrains the model to "speak only these exact words"; the Live
  `systemInstruction` restates the no-spoiler rule as defense-in-depth only. Every
  `HostDirective` stays compiler-enforced `spoilerSafe: true`.

- **Official embeds only — KEPT, unchanged.** The audio path never touches
  embeds/vantages; the cut still renders `cutToVantage.embedUrl` verbatim.

## Consequences

- The host gains a **real, deliberate voice** — native streamed Gemini audio replaces
  Web Speech — resolving the §13 voice-identity call and laying the conversational-host
  foundation (the Live API is bidirectional; LV1 uses only the OUT direction, mic
  never attached).

- A new backend module `backend/src/modules/live/` joins `modules/narrate/`: a
  `POST /live/session` mint (`@google/genai` `authTokens.create`, local zod schema,
  injectable mint client) **and** a **WSS relay endpoint** that holds the upstream
  Google socket and the ephemeral token server-side. `@google/genai` becomes a backend
  dependency at LV1 (not currently in `backend/package.json`); the implementer adds it
  during GREEN, alongside a WS upgrade dependency (e.g. `@fastify/websocket` or
  equivalent) for the relay.

- **OPEN INFRA PREREQUISITE (App Runner WSS) — this ADR depends on it; do NOT assume
  resolved.** Topology (b) needs a **persistent-WebSocket-capable host** for the relay.
  gvp runs its relay on **ECS/Fargate + ALB** and explicitly notes **API
  Gateway/Lambda cannot upgrade the browser WS**. Based's backend currently runs on
  **AWS App Runner** (ADR 0005); whether App Runner supports **inbound WSS upgrade** is
  **being researched separately, in parallel**. Two outcomes:
  - **App Runner supports inbound WSS** → host the relay on the existing App Runner
    service (cheapest; no new infra); ADR 0005 gains a WSS health/route note.
  - **App Runner does NOT support inbound WSS** → **fallback:** stand up a **separate
    small persistent-socket WS service** (e.g. a minimal Fargate + ALB, or equivalent)
    running **only** the relay; the SPA points its relay URL there
    (`VITE_LIVE_RELAY_URL` or similar). **This is an infra-placement detail only — the
    FE seam (§4/§7) and the host loop do NOT change.** Record the outcome here
    (append-only) once the App-Runner-WSS research lands; until then LV1's backend
    relay BUILD can proceed against a local relay (the suite stubs the upstream
    socket), but **staging deploy of LV1 is gated on this prerequisite**.

- The injectable speak seam **generalizes** from `(text) => void` to an async,
  lifecycle-aware `VoiceNarrator`. This is a small, faithful widening (it must voice a
  line that now has a duration and can fail), and Web Speech still satisfies it as a
  fallback — so the character/player and host loop do not reshape.

- **ADR 0005 / App Runner are affected only by the WSS prerequisite above** — the
  `POST /live/session` mint and `/health`, `/narrate` stay plain HTTP request/response;
  the **relay** is the one piece that needs the persistent-socket host. The cost-gating
  posture is preserved by the per-utterance open/close lifecycle (§3): no socket held
  while idle.

- **`/narrate` is NOT retired.** The Live session does **not** generate the spoken text
  — it only voices the already-safe `HostDirective.utterance` produced by the
  `/narrate` text path (ADR 0006), which remains the single source of truth for content
  (§6). LV1 sits behind the speak transport; the §6 contracts, host loop, and
  cost-gating are untouched.

- New env knobs: `GEMINI_LIVE_MODEL` (default `gemini-3.1-flash-live-preview`); the FE
  reaches `POST /live/session` via the same `VITE_API_BASE_URL` base as `/narrate`, and
  the relay via a relay URL knob (e.g. `VITE_LIVE_RELAY_URL`, defaulting to the backend
  origin when App Runner hosts it). `GEMINI_API_KEY` is reused (already SSM SecureString
  → App Runner, ADR 0005) and stays server-side.

- Backend-local validation means the `/live/session` schema is, like `/narrate`, an
  independent restatement (no cross-workspace runtime coupling, ADR 0003) — the accepted
  prototype cost.

## Alternatives considered

- **(a) Browser-direct WSS with a server-minted ephemeral token** (the original
  *recommended* topology before the gvp study). The browser opens the Gemini Live WSS
  itself, authenticated by a short-lived token minted by `POST /live-token`; App Runner
  never holds a socket. **Rejected by ground-truth evidence:** the Live WSS
  authenticates the upstream via the `Authorization: Token <ephemeral>` **request
  header**, which the browser WebSocket API does not permit client JS to set; the
  query-param variant (`wss://…?access_token=<token>`) **fails in practice with Google
  close 1011** (gvp ships this variant but disables it; its relay defaults on). So
  browser-direct does not actually work for this API, and the credential would also be
  on the wire (vs the relay topology where the token never leaves the server). This is
  the gate this ADR opened — now resolved against (a).

- **Browser opens the Gemini Live WSS with the long-lived `GEMINI_API_KEY`
  directly.** Simplest, zero backend. **Rejected** outright — an immediate
  secrets-from-env violation (the key in the client bundle / on the wire), the exact
  failure ADR 0003 #6 and ADR 0006 exist to prevent, and the highest-risk trap of this
  milestone.

- **Mixing `responseModalities: ["AUDIO","TEXT"]`** to get the spoken text alongside
  audio. **Rejected** — per gvp it **silently hangs ~45–60 s**; exactly one modality is
  required. Use `outputAudioTranscription: {}` for the spoken text instead.

- **Re-send `setup` from the browser** (or have the browser drive the session
  directly). **Rejected** — in the relay topology the relay sends `setup` **once,
  server-side**; a browser-sent `setup` would duplicate/contradict it. The browser only
  sends the `clientContent` line turn.

- **Keep Web Speech; do nothing.** Cheapest, but the §13 navigator decision is
  explicitly to replace the robotic Web Speech voice with deliberate streamed audio —
  the visible gap between "ranked list with TTS" and "an AI host you'd lean back and
  watch." Rejected per the navigator's call. (Web Speech is retained only as the
  fallback narrator behind the same `VoiceNarrator` seam.)

- **Generate audio with a separate one-shot TTS API** (text → audio file → play), not
  the Live API. Simpler transport (HTTP, like M3), but it is **not** the bidirectional
  Live foundation the navigator chose and the backlog names. Rejected for LV1; a
  possible lower-risk fallback only if the relay proves infeasible at BUILD — log here
  if so.

- **Reshape `HostDirective` to carry an audio stream / session handle.** Speculative
  and leaks transport detail into the §6 seam the UI consumes. Rejected — the directive
  still carries `utterance` (the line); the audio is a rendering owned by the narrator
  (ADR 0004 minimalism; ADR 0003 contracts-as-seam).

- **Keep a Live session warm across utterances to cut latency** (lifecycle option (i),
  §3). A relay+upstream socket open while the host is idle — in tension with
  cost-gating #4 / silence-budget #2 unless paired with an idle-close timeout.
  **Deferred, not adopted:** LV1 opens/closes per utterance (§3); revisit with an
  explicit idle timeout only if latency measurement justifies it, and record here.

## Amendment (BUILD decisions) — 2026-06-02

Two decisions §7 and Consequences explicitly deferred to BUILD ("record which at
BUILD"; the OPEN infra prerequisite) are now resolved. This section is **additive**;
the §1–§8 wire contract, the FE `VoiceNarrator` seam (§4), and the §6 contracts
(`frontend/src/contracts/`) are **UNCHANGED** by both. Cycle 1 (the pure
`buildLiveSetup` builder, §7) has already landed GREEN; this fixes the contract for
**cycle 2/3** (`POST /live/session`) and records the resolved infra prerequisite.

### A1. Relay-token flow — RESOLVED: **(B) `/live/session` mints + returns the short-lived EPHEMERAL token to the FE**

§1/§7 left open *where* the ephemeral token the relay needs (`Authorization:
Token <ephemeral>` upstream) comes from. **Chosen: (B) token-to-FE.**

**The contract the test-writer/implementer build cycle 2/3 against:**

- **`POST /live/session`** mints the short-lived ephemeral token via the **injected**
  `@google/genai` client (`authTokens.create`, `http_options { api_version:
  'v1alpha' }`, single-use `uses: 1`, ~3-min open window, 10-min hard expiry — §reference
  study), reading `GEMINI_API_KEY` and the model id (`GEMINI_LIVE_MODEL`, default
  `gemini-3.1-flash-live-preview`) from `process.env` **only**, and **returns the
  ephemeral token to the FE**. **Exact success (`200`) response shape:**
  ```jsonc
  {
    "token":     "<short-lived ephemeral token>",   // single-use, ~3-min open window
    "model":     "gemini-3.1-flash-live-preview",    // BARE id (the relay/buildLiveSetup prefixes models/)
    "expiresAt": "<ISO-8601 hard-expiry instant>"    // the 10-min hard expiry
  }
  ```
  - The body schema is the module's **own local zod schema** (no cross-workspace
    import; ADR 0003/0006). The request body carries **no** credential; any `apiKey` /
    `GEMINI_API_KEY` field in the body is **ignored** (the secrets-from-env invariant).
  - The **long-lived `GEMINI_API_KEY` is never accepted from the body, never logged,
    and never in the response** — only the short-lived ephemeral `token` transits.
  - Malformed body → **`400`, mint client NOT called** (refuse to spend before
    validating; mirrors M3 `/narrate`).
  - The `@google/genai` mint call is **injectable** (like M3's `GeminiClient`) so the
    suite stubs it and never hits the network.

- **What the relay consumes:** the FE hands the relay the **ephemeral `token`** when it
  opens the relay WS (transport of the token — query param / subprotocol / first
  message — is the **implementer's** choice; not part of this seam). The relay attaches
  it upstream as the request header `Authorization: Token <ephemeral>` and sends the
  `setup` frame once (§2 — built by the already-landed `buildLiveSetup`). The relay
  itself does **not** call `authTokens.create`; the mint stays the one testable HTTP
  route. The upstream socket remains the relay's injectable I/O edge (§7).

**FE seam impact: NONE on the §6 contracts.** The FE still "opens a WS to our relay";
it now also makes one prior `POST /live/session` HTTP call (same `VITE_API_BASE_URL`
base as `/narrate`) to obtain the token it forwards to the relay. `frontend/src/contracts/`
(`HostDirective` et al.) and the host loop / cost-gating are untouched — the token is a
transport credential, never a §6 type.

**Why (B):**
- **Testable cycle decomposition (the deciding factor).** The mint is a plain
  `app.inject` HTTP route, exactly the KICKOFF cycle order (#2 valid→token, #3
  malformed→400-no-spend, #4 secrets-from-env). It is unit-TDD'd in isolation from the
  WS relay, with the mint client stubbed — the cleanest, most hermetic way to prove the
  highest-risk invariant (secrets-from-env) of this milestone. (A) and (C) bury the
  credential boundary inside WS-upgrade machinery that is far harder to `app.inject`.
- **Stateless relay.** No server-side session-state / TTL map (which (A) requires); the
  relay stays a stateless pipe (browser WS ↔ upstream WS), simplest to reason about
  against cost-gating (open/close per utterance, §3).
- **The Based secrets invariant is satisfied.** The *actual* invariant (ADR 0003 #6 /
  ADR 0006) is that the **long-lived `GEMINI_API_KEY`** never leaves the server. Under
  (B) it never does. The KICKOFF's secrets bullet explicitly anticipates this shape:
  "if the chosen backend shape does return a token to the FE, assert it is the
  short-lived ephemeral one and that the long-lived key is never on the wire" — that is
  exactly the cycle-4 assertion.

**Residual risk (recorded, not hidden):** under (B) the **short-lived, single-use,
~3-min ephemeral token transits the browser** (and the relay WS). This is strictly
**weaker** than (A)/(C), where the token never leaves the server — but it is the
**short-lived** credential, not the long-lived key, and it is single-use with a ~3-min
open / 10-min hard window, so the blast radius of disclosure is one expiring session.
Accepted for the prototype as the right trade against (A)'s session-state complexity and
(C)'s untestable mint. If the threat model later tightens (e.g. an external/public
demo), revisit toward (A) — *that change does not touch the FE seam either* (the FE
would receive `{ sessionId, relayUrl }` instead of a token, still "open a WS to our
relay") — and record it here append-only.

**Rejected at BUILD:**
- **(A) gvp-faithful, token stays server-side** — `POST /live/session` mints + STORES
  the token keyed by a `sessionId` (TTL map), returns `{ sessionId, relayUrl }` (no
  token to the browser); the relay looks the token up by `sessionId` on WS upgrade.
  **Strongest secrets posture** (token never on the wire — matches gvp). **Rejected for
  LV1:** needs server-side session state + a TTL/eviction map, and moves the credential
  boundary into WS-upgrade lookup, which is materially harder to unit-TDD with
  `app.inject` than a plain mint route. The marginal secrets gain (hiding a single-use
  ~3-min token) does not justify the added state + reduced testability for the
  prototype. Named as the upgrade path if the threat model tightens.
- **(C) relay mints on WS-upgrade** — no `/live/session` route; the relay calls
  `authTokens.create` itself on connect. **Token never on the wire; simplest topology.**
  **Rejected for LV1:** the mint is no longer a separately `app.inject`-testable HTTP
  route, deviating from the KICKOFF cycle order (#2–#4 TDD `/live/session`) and fusing
  the highest-risk invariant (secrets-from-env) into the WS-upgrade path where it is
  hardest to assert in isolation. Testability of the secrets boundary is the priority
  for this milestone; (C) sacrifices exactly that.

### A2. Relay hosting — RESOLVED: navigator approved new compute → **Amazon ECS Express Mode** for the relay

The Consequences "**OPEN INFRA PREREQUISITE (App Runner WSS)**" is now resolved.
Research closed it against App Runner; the navigator approved new compute.

**Resolution of the open prerequisite:**
- **App Runner CANNOT host the relay.** No inbound WebSocket support (roadmap item
  closed "not planned"); a non-configurable **120 s** request timeout (a relay session
  outlives that); stateless; **and App Runner is now closed to new customers /
  sunsetting toward ECS Express Mode.** This resolves the "App Runner supports inbound
  WSS" branch of the original two-outcome split → **NO**. The fallback branch (a
  separate persistent-socket service) is therefore the path.
- **Navigator decision (2026-06-02): "Full LV1 + approve relay infra."** Stand up a
  small **Amazon ECS Express Mode** service (Fargate task + auto-provisioned ALB) for
  the relay, **reusing the existing ECR image + the OIDC GitHub-Actions deploy**
  (ADR 0005). ~$25–30/mo, ~½ day to stand up, **additive**: the FE + CloudFront and the
  App Runner `/narrate` backend stay as-is. The SPA points `VITE_LIVE_RELAY_URL` at the
  ECS Express Mode service's ALB; `POST /live/session` stays on the existing backend
  origin (plain HTTP).

This satisfies the prior "fallback: a separate small persistent-socket WS service"
(Consequences) — now the **chosen, navigator-approved** placement, concretely ECS
Express Mode rather than hand-rolled Fargate+ALB.

**FE seam impact: NONE.** This is infra-placement only (ADR 0007 §4/§7) — the FE seam
(open a WS to our relay) and the host loop are **UNCHANGED**. Only the relay URL knob's
target moves.

**Carried into the BUILD/RELEASE boundary:**
- **This is a RELEASE-phase task** (after the LV1 inner-loop cycles are GREEN). LV1
  BUILD continues against a **local/stubbed relay** — the suite never opens a real
  socket. Do **not** block the inner loop on it. **Staging release of LV1 is gated on
  this service standing up.**
- **OPEN sub-question for the release phase (flagged, NOT decided here — dev-ops/PM at
  RELEASE):** **migrate the whole backend to ECS Express Mode** (a *single* service —
  also the App-Runner-sunset exit, one deploy target, but touches the working
  `/narrate` + `/health` deploy) **vs. a separate relay-only ECS Express Mode service**
  (*two* services — most additive, leaves the proven App Runner backend untouched, but
  carries an App-Runner-sunset migration as future debt). The navigator's "additive"
  framing leans separate-relay for LV1's first staging release; the whole-backend
  migration can be a deliberate later step. **Decide at RELEASE.**
- **dev-ops gotcha to carry (ALB idle timeout).** The ALB default idle timeout is **60 s**
  — too short for a held relay WS. Raise it toward **~3600 s** and add **app-level WS
  pings** (keepalive) so the relay session is not dropped mid-utterance. (Mirrors gvp's
  ECS/Fargate+ALB note; the App Runner 120 s timeout was one reason it cannot host the
  relay at all.) This is a deploy-config detail, not a seam change.

## Amendment B — live-API probe corrections + topology RE-OPENED — 2026-06-03

A **live end-to-end probe of the real `gemini-3.1-flash-live-preview` Live API** (the
JS `@google/genai` SDK), run M3-style before wiring LV1's production edges,
**VALIDATED the whole pipeline** — mint → WSS connect → `setup` → speak turn → **6
audio frames `audio/pcm;rate=24000`** → `turnComplete` — and found **three wire-shape
corrections** to §1–§8 / Amendment A1 above. Two are local wire fixes; **the third is
load-bearing and re-opens the §1 topology decision**, because the empirical fact §1
rested on (a "browser cannot attach the credential the WSS needs, so a relay is
required") is **wrong**. This amendment is **append-only**: §1–§8 and Amendments A1/A2
are **NOT rewritten**; where they now conflict with ground truth, **this section
supersedes them** and the conflict is named inline. **What is UNCHANGED in every case:
the §6 contracts (`frontend/src/contracts/`), the host loop + `narrating-host-loop`
decision/cost-gate/failure-silent logic, the cut (`cutToVantage.embedUrl` verbatim),
the cost-gating posture (open/close per surfacing `speak`), and the `VoiceNarrator`
interface the App consumes (`speak(text): Promise<void>` + optional `stop()`).** This
is still a transport swap behind that seam; only *which side opens the Google socket*
is reconsidered.

> **Ground truth (the pipeline WORKS).** A Node `ws` client: minted an ephemeral token
> via `authTokens.create`, opened the upstream WSS authenticated by that token, sent
> the `setup` frame then a fixed-line `clientContent` turn, and received 6 PCM frames
> (`audio/pcm;rate=24000`) terminated by `turnComplete`. The corrections below are the
> exact wire shapes that made it work.

### B0. The three probe corrections (ground truth)

**Correction 1 — AUTH MECHANISM (LOAD-BEARING — re-opens topology).** The Live WSS
authenticates an ephemeral token via a **`?access_token=<token>` URL query parameter,
NOT an `Authorization: Token <token>` request header.** The header approach **FAILED
with WSS close `1008` "unregistered callers."** The `@google/genai` SDK itself attaches
the token as `?access_token=…`.
→ **This moots §1's entire load-bearing justification for the backend relay** — which
was, verbatim (§1, §Decision-1, Alternatives): *"a browser cannot set the
`Authorization` header the WSS requires, so a server-side relay must attach it."* But a
browser's native `WebSocket` **can** set a URL query param
(`new WebSocket('wss://…?access_token=<token>')`). The thing §1 said only a server can
do is in fact done with a query param, which the browser sets natively. So **topology
(a) browser-direct is viable in principle** (subject to the B2 browser-handshake gate),
and the §1 close-`1011` evidence cited against (a) is **superseded**: the real failure
was close `1008` from the *header* path, i.e. the gvp relay-default and the "browser
variant fails 1011" claim §1 leaned on are **not reproduced** by this probe — the query
param is the SDK's own working path.

**Correction 2 — METHOD (applies regardless of topology).** For an **ephemeral token**
the WSS method must be **`…BidiGenerateContentConstrained`** (the SDK switches to the
`Constrained` variant for `auth_tokens/…` credentials). Plain `BidiGenerateContent`
was **not validated** with the token.
→ **Supersedes** §2's "plain `BidiGenerateContent` also works" and Amendment §2's
endpoint constant. `backend/.../live-relay.ts` currently hardcodes the **plain**
endpoint **and** the `Token` header — **both wrong**; whichever topology is chosen, the
upstream URL becomes the `…Constrained` endpoint **with `?access_token=<ephemeral>`
appended** and **no `Authorization` header**.

**Correction 3 — MINT RESPONSE SHAPE (applies regardless of topology).** The JS SDK
`client.authTokens.create({ config: { uses: 1, expireTime, newSessionExpireTime } })`
returns an `AuthToken` with **ONLY `.name`** — the token value, an `auth_tokens/…`
string — and **no `token` / `expiresAt` fields.**
→ So `POST /live/session` must **map `authToken.name → token`** and **synthesize
`expiresAt` itself** from the `expireTime` it passed into `create()` (the SDK does not
echo it back). This is a fix to the **real mint adapter**, not the route's public
shape: Amendment A1's `200` body — `{ token, model: "<bare id>", expiresAt:
"<ISO-8601>" }` — is **UNCHANGED and still correct**; the route still returns exactly
that. What changes is the **`MintFn` boundary** (`live-token-client.ts`): the real
`@google/genai` adapter must do the `name→token` rename and the `expiresAt` synthesis
**inside** the injected mint, because the SDK gives neither. (The scaffolded
`MintFn`/`mintToken` already type the *output* as `{ token, expiresAt }`; that output
contract stays — only the real adapter's mapping from the raw SDK `AuthToken` is now
specified. The stubbed mint in the suite already returns `{ token, expiresAt }`, so the
**hermetic tests are unaffected**.)

### B1. Topology — RE-EVALUATED → **RECOMMEND (a) browser-direct** (gated on B2)

With Correction 1, the only justification §1 gave for the relay is gone, so the two
topologies must be re-weighed on their actual merits. **Recommendation: (a)
browser-direct**, contingent on the **B2 browser-handshake validation gate** passing.

**(a) browser-direct (RECOMMENDED, gate-pending).** `POST /live/session` mints the
ephemeral token **server-side** (the long-lived `GEMINI_API_KEY` stays
`process.env`-only — **secrets-from-env intact**); the browser opens
**`wss://…GenerativeService.BidiGenerateContentConstrained?access_token=<ephemeral>`
DIRECTLY**, **sends the `setup` frame ITSELF** (it owns the connection), then sends the
`clientContent` line turn, and plays the streamed PCM. **No relay. No
`@fastify/websocket` / `ws`. NO ECS Express Mode.** App Runner keeps only the **plain
HTTP `POST /live/session` mint** (which it already serves fine — request/response,
under the 120 s timeout). This **eliminates** the relay module (`live-relay.ts`, cycles
8–10) and the entire Amendment A2 infra.

**(b) backend relay (the current build / §1).** Browser → our WSS relay → Google WSS;
the relay holds the token and sends `setup` server-side (un-tamperable). Costs: the
relay code + `@fastify/websocket`/`ws` + a **persistent-WebSocket host** — concretely
the navigator-approved **ECS Express Mode** service (**~$25–30/mo + ~½-day standup +
the App-Runner-sunset migration debt**), because App Runner cannot host inbound WSS
(Amendment A2).

**Weighing them now that the header argument is void:**

| | **(a) browser-direct** | **(b) relay (current)** |
|---|---|---|
| Secrets-from-env (long-lived key) | server-side only ✓ | server-side only ✓ |
| Credential on the wire | short-lived single-use ~3-min ephemeral token transits the browser | ephemeral token also stays server-side |
| Infra | **HTTP mint only — App Runner as-is, $0 new** | **ECS Express Mode (~$25–30/mo + standup + migration)** |
| Code | **delete the relay module + WS deps** | relay + `@fastify/websocket`/`ws` |
| App-Runner-sunset exposure | **sidestepped — no WS host needed** | forces the ECS migration now |
| `setup` trust | FE sends `setup` (FE-owned, see risk) | relay sends `setup` (un-tamperable) |
| Remaining unknown | **does a REAL browser `WebSocket` handshake succeed with `?access_token=` + `Constrained`? (B2 gate)** | none (relay path is the build) |

**Secrets-from-env holds in BOTH** — the long-lived key never leaves the server in
either; the **only** delta is the short-lived, single-use, ~3-min ephemeral token
transiting the browser under (a). **That exact trade was already accepted in Amendment
A1 (option B):** A1 chose to return the ephemeral token to the FE, explicitly recording
"the short-lived, single-use, ~3-min ephemeral token transits the browser … strictly
weaker than (A)/(C) … accepted for the prototype." Under topology (a) the token also
reaches Google **directly** instead of via our relay, but it is the **same** token with
the **same** blast radius (one expiring single-use session); **A1's accepted posture
already covers it.** So (a) introduces **no new secrets exposure beyond what A1
accepted** — it removes the relay, not a protection of the long-lived key.

**Why (a) is recommended:** it is **dramatically simpler and cheaper** (no relay
module, no WS server dep, **no ECS Express Mode spend or standup**) and it **sidesteps
the App-Runner-sunset / ECS-migration problem entirely** (Amendment A2's whole
open-question disappears — there is nothing that needs a persistent-socket host). The
secrets trade is one A1 already made. The decisive contingency is purely empirical and
small (B2).

**The remaining UNKNOWN — does a REAL browser confirm the handshake?** The probe that
proved Correction 1 ran in **Node (`ws`)**, which is permissive about handshake
mechanics. gvp claimed a browser-direct variant "fails with close `1011`" — **but gvp
may have hit that via the dead `Authorization`-header path or an unrelated cause**, and
this probe reproduced **`1008` from the header**, not `1011`, and **success from the
query param**. So the gvp `1011` claim is **unconfirmed for the query-param + Constrained
path in a real browser.** This is the **one** thing that must be checked before
committing to (a) — captured as the B2 gate. **If B2 fails, fall back to (b)** with no
seam change to the FE-visible `VoiceNarrator` (the narrator's I/O edge — "open the
Google WSS" vs "open our relay" — is internal to it; see B3).

### B2. The browser-WSS validation gate (the gate on recommending (a))

**Before committing to (a), run a qa/browser check** (qa-verifier, M3-style, a tiny
throwaway page — NOT a suite test; the hermetic suite never opens a real socket):

> In a **real browser** (Chrome + Safari), mint an ephemeral token via `POST
> /live/session`, then
> `new WebSocket('wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=<ephemeral>')`,
> send the `setup` frame (the existing `buildLiveSetup(...)` output) then a fixed-line
> `clientContent` turn, and confirm **PCM `serverContent` frames arrive and the socket
> does NOT close `1011`/`1008`.**

- **PASS (frames arrive, no abnormal close)** → **adopt (a)**; the gvp `1011` claim was
  path-specific or stale; proceed to retire the relay (B3) and **reverse Amendment A2's
  ECS infra** (B4).
- **FAIL (browser blocks the query-param handshake or Google closes it)** → **keep
  (b)**; record the browser-specific failure here (append-only) as the *real*
  re-justification for the relay (replacing the now-void header argument), and keep
  Amendment A2's ECS Express Mode. The FE-visible `VoiceNarrator` seam is identical
  either way (B3).

This gate is the **only** thing between this recommendation and a topology commit; it is
cheap (~an hour) and removable-throwaway, exactly the M3-style live probe that produced
these corrections.

### B3. The seam delta (for whichever topology B2 selects)

**UNCHANGED in both (a) and (b)** — and this is the point of the seam: the §6 contracts
(`frontend/src/contracts/`), `host-loop.ts` / `narrating-host-loop.ts` (decision +
cost-gate + failure-silent), the character/player, the cut (`cutToVantage.embedUrl`
verbatim), the cost-gating posture (open/close per surfacing `speak`, §3), and the
**`VoiceNarrator` interface the App consumes** (`speak(text): Promise<void>` + optional
idempotent `stop()`). The injectable I/O edge inside the narrator stays an injectable
I/O edge — the suite injects a fake socket either way and asserts on
line-frame/audio-lifecycle/failure-silent wiring, never on a real socket.

**Corrections 2 & 3 apply in BOTH topologies (do them regardless of B2):**
- **Mint adapter (`live-token-client.ts`, the real `MintFn`):** call
  `authTokens.create`, then **`token = authToken.name`** and **synthesize `expiresAt`**
  from the `expireTime` passed in. The route (`live.routes.ts`) and its `200` shape
  `{ token, model, expiresAt }` (A1) are **unchanged**. The stubbed mint + the
  `POST /live/session` HTTP tests are **unaffected** (they already use
  `{ token, expiresAt }`).
- **Upstream endpoint constant (wherever the Google socket is opened):**
  `…GenerativeService.BidiGenerateContentConstrained` **+ `?access_token=<ephemeral>`
  query param**, **no `Authorization` header.** In `live-relay.ts` today this is the
  plain endpoint + `Authorization: Token` header — **both must change** under (b); under
  (a) the relay module is retired and this constant lives in the FE narrator's open-edge.

**If B2 selects (a) browser-direct — the changes vs the current build:**
1. **FE narrator now OPENS THE GOOGLE WSS DIRECTLY** with the minted ephemeral token.
   The scaffolded `createLiveNarrator({ openRelay })` (`frontend/src/lib/live-narrator.ts`)
   keeps its shape, but **`openRelay` becomes "open the Google Live WSS directly"**
   (`wss://…Constrained?access_token=<token>`) — still the **injectable** open-socket
   edge (rename to `openSocket`/`connect` at the implementer's discretion; the fake the
   tests inject is identical). The narrator first obtains the token via `POST
   /live/session` (same `VITE_API_BASE_URL` base), then opens the socket.
2. **FE narrator NOW SENDS the `setup` frame ITSELF**, then the `clientContent` turn —
   it owns the connection. **This reverses §2's "browser MUST NOT re-send setup" /
   KICKOFF cycle-7's "FE never sends a `setup` frame".** The setup payload is the **same
   `buildLiveSetup(...)` output** (it moves from a backend-only builder to one the FE
   also uses, or the FE inlines the equivalent — implementer's call; the *shape* is
   fixed by §2 as corrected: `responseModalities: ["AUDIO"]` exactly one, prefixed
   model, no-spoiler `systemInstruction`). Spoiler-safety is **unaffected** — the spoken
   line is still the already-safe `HostDirective.utterance` constrained to "speak only
   these exact words"; the `systemInstruction` no-spoiler restatement is still
   defense-in-depth, now asserted on the FE setup frame instead of the relay's.
3. **The relay module is RETIRED** (`backend/src/modules/live/live-relay.ts`, cycles
   8–10) — **delete it, or keep it as a documented, off-by-default fallback** for the
   B2-FAIL path. `@fastify/websocket` / `ws` are **not added** to the backend. `POST
   /live/session` (mint, with Corrections 2 & 3) is the **only** backend live surface.
4. **Cost-gating is preserved structurally** — the FE opens the Google socket **only**
   inside `speak(...)` (one per surfacing event, closed on turn-drain), exactly the §3
   open/close-per-utterance rule, now applied to the direct socket. The KICKOFF
   cost-gating cycle ("zero opens on idle, one per `speak`") is **unchanged** — it
   asserts on the injected open-edge regardless of what that edge connects to.

**If B2 selects (b) relay — the changes vs the current build (smaller):** keep the
relay, but **fix `live-relay.ts`** for Corrections 1 & 2: upstream URL →
`…Constrained?access_token=<token>`, **drop the `Authorization: Token` header.** The
FE-visible seam (open a WS to our relay; FE sends only `clientContent`, relay sends
`setup`) is **unchanged from §1/§7**; Amendment A2's ECS Express Mode **stays**.

### B4. NAVIGATOR DECISION (flagged explicitly) — adopting (a) REVERSES Amendment A2's approved ECS infra

**This is a §13-class scope/infra call for the navigator,** surfaced with this
recommendation:

- **Recommendation: adopt (a) browser-direct, gated on B2 passing.**
- **Consequence if adopted: Amendment A2 is REVERSED.** The navigator-approved **ECS
  Express Mode relay service is NOT needed** — there is no relay and no inbound WSS to
  host, so **App Runner stays as-is** (plain HTTP `/narrate` + `/live/session` mint).
  This **saves the ~$25–30/mo + the ½-day standup**, **and removes the
  App-Runner-sunset / whole-backend-migration open question** (Amendment A2's deferred
  RELEASE sub-question) **entirely** — there is simply nothing that requires a
  persistent-socket host. The ALB-idle-timeout / WS-keepalive dev-ops gotcha (A2) also
  disappears.
- **What does NOT change either way:** the §6 contracts, the host loop, cost-gating, the
  `VoiceNarrator` interface, secrets-from-env (long-lived key server-side), and the
  spoiler-safe text path (`/narrate`). LV1's *product* outcome — the host audibly
  voiced by Gemini Live — is identical under (a) or (b).
- **Sequencing:** run **B2 first** (cheap browser probe). **B2 PASS → navigator
  confirms (a), A2 reversed, relay cycles 8–10 retired (or kept as documented
  fallback), infra spend cancelled.** **B2 FAIL → keep (b) + A2; record the browser
  failure here as the relay's real re-justification.** Either outcome leaves the
  hermetic suite and the FE seam untouched; Corrections 2 & 3 land regardless.

> **design-notes pointer:** the LV1 KICKOFF's "RESOLVED (Amendment A2)" relay-hosting
> line and cycle-7's "FE never sends setup" are now **conditional on the B2 gate** — see
> ADR 0007 Amendment B. Corrections 2 (Constrained method) & 3 (mint `name→token` +
> synthesize `expiresAt`) apply to the BUILD regardless of topology.
