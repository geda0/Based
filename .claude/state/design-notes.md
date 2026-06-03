# Design notes — Based prototype · LV1 · Live-voice host (native Gemini Live audio) — KICKOFF

> **STATUS: LV1 KICKOFF — ready for the inner TDD loop.** DESIGN is DONE: architect resolved the seam in
> **ADR 0007** (topology gate → **(b) backend WSS relay**; the wire contract, setup frame, and FE
> `VoiceNarrator` shape are all fixed there). This file turns ADR 0007 into the layer-tagged acceptance
> bullets the orchestrator picks behaviors from. **Scope is LV1 only:** a **transport swap behind the
> existing speak path** — the host loop, cost-gating, the §6 contracts (`frontend/src/contracts/`), and
> the spoiler-safe TEXT path (`/narrate`, ADR 0006) are **UNCHANGED**. LV1 only changes **HOW** a line is
> voiced (browser `speechSynthesis` → native Gemini Live audio), never **WHEN/WHETHER** it is voiced.
>
> **Prior milestone:** M3 (real Gemini text narration) is DONE + PO-accepted (2026-06-02) — see
> `backlog.md` → Done. LV1 builds on the injectable narrate seam + the abstracted `speak()` M3/M2 left.
>
> **⚠ DEFERRED RELEASE-GATE (not a BUILD gate — orchestrator: surface to navigator).** Deploying the relay
> needs a **persistent-WebSocket-capable host** (ADR 0007 Consequences): App Runner WSS support is unknown;
> the likely path is **new compute (ECS Express Mode / Fargate + ALB)** — an **infra-scope decision being
> escalated to the navigator** (logged in `backlog.md` → Decisions needed). **LV1 BUILD proceeds against a
> local/stubbed relay regardless** — the suite never opens a real socket — but the **staging release of LV1
> waits on that infra approval.** Do not block the inner loop on it.
>
> _The M3 KICKOFF is preserved in git history / `backlog.md` → Done as the accepted record; it is replaced
> here by the LV1 KICKOFF._

---

## FEATURE
Give the host a **real, deliberate voice.** Replace the browser's robotic `window.speechSynthesis` TTS with
**native streamed audio from `gemini-3.1-flash-live-preview`** over the Gemini Live (WebSocket) API — the
**same already-spoiler-safe line**, a far better voice. Per ADR 0007 this is **(b) a backend WSS relay**:

1. **Backend live module — `backend/src/modules/live/`** (mirrors `modules/narrate/`):
   - **`POST /live/session`** — mints a **short-lived ephemeral token** via the `@google/genai` SDK
     (`authTokens.create`, `http_options { api_version: 'v1alpha' }`, single-use, ~3-min open window). Reads
     `GEMINI_API_KEY` + the model id (`GEMINI_LIVE_MODEL`, default `gemini-3.1-flash-live-preview`) from
     `process.env` **only**; **its own local zod schema** for any request body (no cross-workspace import —
     ADR 0003/0006); the `@google/genai` mint call is **injectable** (stub in tests, like M3's `GeminiClient`).
     The long-lived key is **never** accepted from the body, **never** logged, **never** in the response.
   - **WSS relay endpoint** (WS upgrade, e.g. `GET /live/relay`) — accepts the browser WS, opens the upstream
     Google Live WSS with the request header `Authorization: Token <ephemeral>` (the header a browser cannot
     set — the load-bearing reason for the relay), sends the **`setup` frame ONCE server-side** (prefixed
     `model: "models/gemini-3.1-flash-live-preview"`, `generationConfig.responseModalities: ["AUDIO"]` —
     **exactly one** modality, persona + no-spoiler `systemInstruction`, optional `outputAudioTranscription: {}`),
     forwards the browser's `clientContent` line turn upstream, and pipes `serverContent` PCM frames back. The
     **upstream socket is the injectable/stubbed I/O edge** in tests.

2. **Frontend `VoiceNarrator`** (generalizes today's `speak.ts` into e.g. `frontend/src/lib/live-narrator.ts`):
   `speak(text): Promise<void>` — opens a WS to **our relay** (never to Google; the browser holds **no**
   key and, in topology b, **no** token), sends exactly
   `{ clientContent: { turns: [{ role: 'user', parts: [{ text: 'Speak only these exact words. Do not add anything. Say: "<UTTERANCE>"' }] }], turnComplete: true } }`,
   decodes the returned **24 kHz / 16-bit / mono / little-endian** PCM (b64 → `Int16Array` → `Float32` →
   `AudioContext.createBuffer` + `copyToChannel` → scheduled `AudioBufferSourceNode`s, a small jitter buffer)
   and **resolves when playback drains**. **Rejects on any failure** (token mint / relay / upstream WSS /
   close 1011 / empty stream / audio) → the host **stays silent** (reuse the M2/M3 failure-silent behavior in
   `narrating-host-loop.ts`: a dropped `speak`, kept `cutTo`). The **relay WS and `AudioContext` are the
   injectable/stubbed I/O edges** in the suite.

The M2/M3 directive flow does **NOT** reshape. The character/player still react to the same `HostDirective`
stream off the bus; `speaking` is now gated on **audio actually playing** (reverts to `idle` when `speak(...)`
resolves) — the silent↔active mechanic is preserved, only the signal source moves from a Web Speech event to
the audio lifecycle. The cut still renders `cutToVantage.embedUrl` verbatim (untouched).

*Demo (DoD #4, made audible):* the same wake→speak→cut flow, but the line is now **spoken by Gemini Live**, not
the browser — and stays spoiler-safe + within the silence budget.

## ACCEPTANCE CRITERIA (each → one or more red→green cycles; layer-tagged, observable)
_Layer order: **backend mint → backend relay/setup (pure builder first) → frontend VoiceNarrator → integration**,
then **qa**. The Gemini Live transport and the upstream socket are **STUBBED** in the suite — the suite **never
opens a real socket and never plays real audio**. Assert on session/relay-gating, the key/token topology,
audio-lifecycle wiring, and failure-degrades-to-silence — **never** on audio quality. Each bullet names whether
it is **unit-TDD** or **qa-only**._

### Backend — `POST /live/session` (mint)  — unit-TDD
- **[ ] [backend] Valid request → token minted via the injected client, key from env, never echoed.** Given a
  well-formed request (per the module's own zod schema) and a **stubbed** `@google/genai` mint client, when
  POSTed, then `200` and the **ephemeral token is minted by the injected client constructed from the ENV key**
  — the response carries the short-lived token (or, if the relay mints internally, the response is whatever the
  chosen backend shape is — record which at BUILD per ADR 0007 §7), and the **long-lived `GEMINI_API_KEY`
  appears in NO response body and NO log line.** _(Test: assert the mint client received the env key and was
  called once; assert response + captured logs are key-free.)_
- **[ ] [backend] Malformed request → 400, no spend.** Given a body that fails the local zod schema, when
  POSTed, then `400` (zod-rejected) **and the mint client is NOT called** (the stub records zero calls) — refuse
  to spend before validating. _(Mirrors M3's `/narrate` 400-no-spend.)_
- **[ ] [backend] INVARIANT — secrets-from-env (highest risk).** Given a request that **carries a bogus key
  field** in the body (e.g. `apiKey` / `GEMINI_API_KEY`), when POSTed, then that body value is **ignored** — the
  mint client is constructed from the **env key only** — and the long-lived key appears **nowhere** in the
  response or any log line. **In topology (b), the ephemeral token never needs to reach the browser** (the relay
  holds it); if the chosen backend shape does return a token to the FE, assert it is the **short-lived ephemeral**
  one and that the **long-lived key is never on the wire**. `GEMINI_API_KEY` read from `process.env` only.
  _(Mirror M3's secrets test on the new endpoint.)_
- **[ ] [backend] Model id from env default.** Given `GEMINI_LIVE_MODEL` unset, the mint/setup path uses the
  default `gemini-3.1-flash-live-preview`; given it set, that value is used. _(Wire via env — don't hardcode;
  ADR 0003 note. Small cycle; may fold into the valid-request cycle.)_

### Backend — the relay / `setup` frame  — unit-TDD
- **[ ] [backend] The `setup` frame is built correctly (testable as a PURE builder).** A pure
  `buildLiveSetup(...)` (analogous to `buildNarratePrompt`) returns the exact `setup` shape ADR 0007 §2 fixes:
  **`model` PREFIXED** as `models/gemini-3.1-flash-live-preview` (from env),
  **`generationConfig.responseModalities` is EXACTLY `["AUDIO"]`** (length 1 — never `["AUDIO","TEXT"]`, which
  silently hangs), and **`systemInstruction.parts[].text` carries the persona + the no-spoiler / no-improvise
  rule** (defense-in-depth restatement, e.g. "speak only the words you are given; never add or predict an
  outcome"). _(Pure function → cheap, deterministic test; no socket. This is the cleanest first RED.)_
- **[ ] [backend] The relay attaches `Authorization: Token <ephemeral>` and sends `setup` ONCE.** Given a
  browser WS and a **stubbed** upstream socket, when the relay opens upstream, then it attaches the request
  header **`Authorization: Token <ephemeral>`** (the credential the browser cannot set) and sends the **`setup`
  frame exactly once, server-side** before forwarding any browser frame. _(Test: assert on the stubbed upstream
  the header is present and `setup` was written once; the relay never expects the browser to send `setup`.)_
- **[ ] [backend] The relay forwards the browser's `clientContent` turn and pipes `serverContent` PCM back.**
  Given a `clientContent` line turn from the (fake) browser WS and a stubbed upstream that emits
  `serverContent.modelTurn.parts[].inlineData` frames, when the relay runs, then the line turn is forwarded
  upstream **after** `setup`, and the audio frames are piped back to the browser WS unmodified. _(Test: assert
  forward order + that returned frames reach the browser stub. No real audio.)_

### Frontend — `VoiceNarrator` (the generalized speak seam)  — unit-TDD
- **[ ] [frontend] Given an utterance, sends exactly that line wrapped in "speak only these exact words".**
  Given a `speak(text)` call and an **injected** fake relay WS, when invoked, then the WS receives **exactly one**
  `clientContent` turn whose text is `Speak only these exact words. Do not add anything. Say: "<text>"` with
  `turnComplete: true` — and the FE **never sends a `setup` frame** (the relay owns it). _(Test: assert the
  serialized frame on the fake WS.)_
- **[ ] [frontend] Plays the returned PCM via the injected `AudioContext`; resolves when playback drains.**
  Given the fake relay WS emits `serverContent` PCM frames then a turn-complete signal, when `speak` runs, then
  the narrator **decodes + schedules** the frames on the **injected** `AudioContext` (assert the decode→buffer→
  schedule wiring is invoked with the frames) and the returned `Promise` **resolves only after** the scheduled
  buffers drain / turn completes. _(Test injects fakes for both the WS and `AudioContext`; asserts on wiring +
  resolution timing, never on audible output.)_
- **[ ] [frontend] INVARIANT — failure-silent.** Given the fake relay WS errors / closes (incl. close 1011) /
  emits an empty stream, OR the session/mint fails, when `speak` runs, then the returned `Promise` **rejects**
  and **no audio is forced** — so `narrating-host-loop.ts` (unchanged) **drops the `speak`, keeps the `cutTo`**,
  and the host stays `idle`. _(Test: make the fake fail; assert `speak` rejects and no playback was scheduled.)_
- **[ ] [frontend] INVARIANT — cost-gating: opens no session unless `speak` is called.** Constructing /
  holding a `VoiceNarrator` opens **zero** relay connections; a relay WS is opened **only** inside a `speak(...)`
  call (one per surfaced line, torn down when the utterance ends — open/close per utterance, ADR 0007 §3). _(Test:
  assert zero WS opens on construction/idle; exactly one per `speak`.)_

### Integration / seam  — unit-TDD
- **[ ] [frontend] The narrating-host-loop drives `VoiceNarrator` instead of `speechSynthesis`, no contract
  change.** Given a surfacing event, the loop calls the injected **`VoiceNarrator.speak(utterance)`** (not Web
  Speech) with the `/narrate`-produced line; given nothing surfaces, it calls it **zero** times (cost-gate intact);
  given `speak` rejects, the host stays silent (failure-silent intact). **The `HostDirective` shape, the
  `host-loop`/`narrating-host-loop` decision + cost-gate logic, and the §6 contracts are UNCHANGED** — only the
  injected narrator differs. _(Test: inject a fake narrator into the existing loop; assert call-count + that
  `Speaker`/Web-Speech is no longer the path. The Web-Speech `createSpeak()` is adapted to satisfy the
  `VoiceNarrator` shape so it remains a valid fallback + keeps test fakes tiny.)_

### QA — experience-level (qa-verifier drives the running app; manual, NOT unit-testable)  — qa-only
- **[ ] [qa] The host is AUDIBLY voiced by Gemini Live (not browser TTS).** On a surfaced `speak` directive the
  host speaks in the **native streamed Gemini voice**, not `window.speechSynthesis`. _(Manual: confirm the voice
  changed; the relay path is exercised end-to-end against a real/local relay.)_
- **[ ] [qa] The spoken line matches the on-screen utterance (no spoiler before the cut).** What is **spoken**
  is the **already-spoiler-safe `HostDirective.utterance`** — verbatim, no added/leaked outcome — and matches
  the line the UI shows; **no spoiler appears before the cut lands** (DoD #5, on the audio path). _(Manual:
  listen + read; confirm no outcome is voiced.)_
- **[ ] [qa] Silence budget holds on the audio path.** Idle stays the default; a burst of events does **not**
  produce a continuous stream of audio (one voiced utterance per surface); a **forced failure degrades to
  silence** (no broken/looping audio). _(Manual: drive a burst; force a relay failure; confirm degrade.)_

## LV1 DEFINITION OF DONE
LV1 is **DONE** when:
1. **Every unit-TDD bullet above is GREEN** (backend mint ×4, relay/setup ×3, frontend VoiceNarrator ×4,
   integration ×1) — `pnpm verify` = 0 across backend + frontend.
2. **tdd-critic = PASS** on the LV1 cycles.
3. **The Based invariants are re-proven with tests on this new transport** (see below) — secrets-from-env,
   cost-gating, failure-silent, spoiler-safety-by-construction.
4. **qa-verifier confirms the 3 qa-only bullets** against the running app (audibly Gemini Live; spoken line ==
   on-screen safe utterance, no pre-cut spoiler; silence budget holds). _(UX feature → qa-verifier required on
   green, per CLAUDE.md.)_
5. **No regression to M3** — `/narrate` text path, cost-gating, secrets-from-env, and the §6 contracts are
   unchanged (the integration bullet proves the loop/contract didn't reshape).
6. **PO sign-off** against this acceptance + product intent.

**Which bullets are unit-TDD vs qa-only:**
- **Unit-TDD (the inner loop builds these):** all **Backend mint**, all **Backend relay/setup**, all **Frontend
  VoiceNarrator**, and the **Integration/seam** bullet — 12 bullets, transport + socket + AudioContext stubbed.
- **qa-only (qa-verifier drives the live app at ACCEPT):** the 3 **QA** bullets — they assert *audibility* and
  *the voice actually changed*, which the hermetic suite cannot (it never plays audio). These are the experience
  proof that LV1 delivered a real voice, not just wired one.

**DEFERRED RELEASE-GATE (record; not a DoD-for-BUILD item):** even with all the above green, **staging deploy of
LV1 is gated** on the infra prerequisite — a **persistent-WebSocket-capable host for the relay** (App Runner WSS
support is unknown; likely **new compute: ECS Express Mode / Fargate + ALB** per ADR 0007 Consequences). That is an
**infra-scope decision escalated to the navigator** (logged in `backlog.md` → Decisions needed). LV1 can be
**PO-accepted on the green bar + qa** (against a local relay) **independently of staging**; the staging release of
LV1 (PM + dev-ops) waits on the infra approval. **Surface this to the navigator; do not let it block BUILD.**

## BASED INVARIANTS (re-prove with tests on this NEW transport — ADR 0003 / ADR 0007 §8)
LV1 emits narration over a new transport, so per CLAUDE.md the pair must re-prove these with the transport/relay
**stubbed**:
1. **Spoiler-safety — text path remains the single source of truth (KEPT; by construction).** The narrator
   speaks the **already-spoiler-safe `HostDirective.utterance` VERBATIM** — **LV1 generates no new text** (the
   `/narrate` text path, ADR 0006, owns content). It never adds/leaks an outcome; the relay constrains the model
   to "speak only these exact words"; the Live `systemInstruction` restates the no-spoiler rule as
   **defense-in-depth only**. Every `HostDirective` stays compiler-enforced `spoilerSafe: true` (ADR 0004).
   _Asserted by:_ the VoiceNarrator "sends exactly that line wrapped" bullet (verbatim utterance, no generation)
   + the relay/setup persona bullet (no-spoiler systemInstruction present). **Accepted residual risk unchanged
   from M3** (the model could in principle deviate; the prompt + "speak only these words" is the control).
2. **Cost-gating over a session — PROVEN HERE.** Zero relay/session opens on idle; exactly one per surfacing
   `speak`; opened/closed per utterance (ADR 0007 §3) so it is **structurally** true — never a persistent/
   continuous open mic. _Forced by:_ the FE "opens no session unless `speak` is called" bullet + the integration
   call-count bullet. (D1's "no storm" carried onto sessions.)
3. **Silence budget / failure-silent — KEPT + RE-PROVEN on audio.** Idle is the default; a failed/empty session
   (token mint fail, relay/upstream error, close 1011, empty stream, audio failure) **degrades to silence** — the
   host stays `idle`, no forced noise — and the player **may still cut**. _Forced by:_ the FE failure-silent
   bullet (carries M2/M3's `narrating-host-loop.ts` dropped-`speak`/kept-`cutTo` guard onto the audio path).
4. **Cost-gating + secrets-from-env over WSS (highest risk) — PROVEN HERE.** `POST /live/session` (and/or the
   relay) reads `GEMINI_API_KEY` from `process.env` **only**; a bogus key in the body is ignored; the long-lived
   key is in **no** response and **no** log; **in topology (b) the ephemeral token never reaches the browser**
   (the relay holds it; the browser holds only a socket to our origin). _Forced by:_ the backend secrets-from-env
   bullet. (Mirror M3's secrets test on the new endpoint/relay — the load-bearing call of this milestone.)
5. **Official embeds only — KEPT, unchanged.** The audio path never touches embeds/vantages; the cut still
   renders `cutToVantage.embedUrl` verbatim (M1/M2/ADR 0008 behavior). _No new test needed; not on this path._
6. **Contracts-as-seam — ENFORCED.** The FE still trades only `RankedFeed` + `HostDirective` (+ the
   `VoiceNarrator` interface behind the speak seam); the `HostDirective` keeps its M2 shape (`utterance` is still
   the line; the audio is a rendering). Swapping the stub narrator for the real relay never touches the
   character/player. _Forced by:_ the integration "no contract change" bullet.

## CONSTRAINTS / NON-GOALS
- **Transport swap ONLY — do NOT reshape the §6 seam or the host loop.** `frontend/src/contracts/` (the
  `HostDirective` keeps its M2 shape), `host-loop.ts` / `narrating-host-loop.ts` (decision + cost-gate +
  failure-silent logic), the character/player components, and the cut (`cutToVantage.embedUrl` verbatim) are
  **UNCHANGED**. The `/narrate` text path is the source of the (already-safe) line; **LV1 swaps only the voice
  transport behind `VoiceNarrator`** (ADR 0007 §4–§7). DESIGN is already done — do **not** re-open the seam.
- **Backend validates with its OWN local zod schema** (ADR 0003) — `/live/session`'s body schema lives in
  `backend/src/modules/live/`; no cross-workspace runtime import.
- **STUB the Live transport + the upstream socket + `AudioContext` in tests; never hit the real model/socket and
  never play real audio in the suite.** Inject the `@google/genai` mint client, the upstream WSS socket (relay
  side), and the relay WS + `AudioContext` (FE side). The suite asserts on the setup-frame builder, mint env-key
  path, relay header/once/forward wiring, FE line-frame + audio-lifecycle wiring, session-gating, and
  failure-degrades-to-silence — **not** on audio quality. `pnpm verify` must stay hermetic.
- **`responseModalities` is EXACTLY `["AUDIO"]`** for narration — **never** `["AUDIO","TEXT"]` (mixing silently
  hangs ~45–60 s per ADR 0007). The spoken text, if ever needed for captions/debug, comes from
  `outputAudioTranscription: {}`, **not** a TEXT modality.
- **The `setup` frame is sent ONCE, server-side, by the relay.** The browser **never** sends `setup` — only the
  `clientContent` line turn. PCM is **24 kHz / 16-bit / mono / little-endian**.
- **New deps the implementer adds during GREEN** (ADR 0007 Consequences): `@google/genai` (backend; not yet in
  `backend/package.json`) for the mint; a WS-upgrade dep (e.g. `@fastify/websocket` or equivalent) for the relay.
  New env knob: `GEMINI_LIVE_MODEL` (default `gemini-3.1-flash-live-preview`); `GEMINI_API_KEY` is reused
  (already SSM SecureString → server-side, ADR 0005) and stays server-side. The FE reaches `POST /live/session`
  via the same `VITE_API_BASE_URL` base; the relay via a relay URL knob (e.g. `VITE_LIVE_RELAY_URL`, defaulting
  to the backend origin when the relay is co-hosted).
- **Confirm at BUILD time** (ADR 0003/0007 notes): the exact `@google/genai` `authTokens.create` call shape +
  `api_version: 'v1alpha'`, the upstream WSS endpoint, and whether `POST /live/session` returns the token to the
  FE or the relay mints internally on upgrade (an **implementation detail of the backend** — the FE seam is just
  "open a WS to our relay"; **record which at BUILD** per ADR 0007 §7). Wire model id via env, don't hardcode.
  - **RESOLVED (ADR 0007 Amendment A1, 2026-06-02):** token-flow is **(B)** — `POST /live/session` mints + returns
    the **short-lived ephemeral** token to the FE; **cycle 2/3 success (`200`) shape is fixed:
    `{ token, model: "<bare id>", expiresAt: "<ISO-8601>" }`** (long-lived `GEMINI_API_KEY` never in body/log/response;
    bogus body key ignored; malformed → 400, mint NOT called). The relay consumes the FE-forwarded `token` →
    `Authorization: Token <ephemeral>` upstream. **§6 contracts + FE seam unchanged.**
  - **RESOLVED (ADR 0007 Amendment A2 + ADR 0005 note):** relay hosting — navigator approved (2026-06-02) a small
    **ECS Express Mode** service (App Runner can't host WSS). **RELEASE-phase** task; BUILD runs on a stubbed relay.
    Open release sub-question: whole-backend migration vs. separate relay-only service (dev-ops/PM at RELEASE).
- **Out of scope for LV1:** mic/input audio (Live is bidirectional; LV1 uses only the OUT direction — no mic ever
  attached); a warm/kept-alive session (ADR 0007 §3 chose open/close per utterance; revisit with an idle-close
  timeout only if a latency measurement justifies it, and record in ADR 0007 append-only); two-level ranking +
  digest (M4); the §13 tier-aware-hedging wording (inherited from M3's default — tunable, not a seam, needed only
  before an external demo); the staging deploy of the relay (deferred release-gate above — infra-scope, navigator).
- **Decision active for LV1 (escalated — does NOT block BUILD):** the **relay-host infra-scope** call (App
  Runner WSS vs new compute / ECS Express Mode / Fargate+ALB) — logged in `backlog.md` → Decisions needed with a
  recommended default. BUILD runs against a local/stubbed relay regardless; staging release waits on it. (Voice
  identity is RESOLVED by choosing the Live direction; specific voice/persona-audio tuning is an external-demo
  call. Persona / rights / tier-hedging stay settled-for-now on the M2/M3 defaults.)

## MILESTONE CHECKLIST
- [x] M0a — TDD harness bootstrapped + verified
- [x] M0b — contracts + event bus + mock source-graph feed  *(frontend)*  · critic PASS
- [x] M1  — channel-surf shell: player + rail, manual surf, official embeds only  *(frontend)*  · PO-accepted
- [x] M2  — character silent↔active + TTS + cut + client host loop  *(frontend)*  · PO-accepted
- [x] M3  — real Gemini narration: `/narrate` proxy + FE swap  *(backend → frontend)*  · PO-accepted 2026-06-02 — satisfies brief DoD #4
- [x] **LV1 — live-voice host: `gemini-3.1-flash-live-preview` over WSS (backend relay), native streaming audio (replaces Web Speech)  *(backend → frontend)*  · ✅ CONDITIONALLY PO-ACCEPTED 2026-06-03 (green bar + invariants + qa pipeline; AUDIBLE/voice-identity confirmation = navigator at demo; LV1-D1/LV2-D1/LV2-D2 closed) · staging-deploy infra-gated on ECS (RELEASE-phase, navigator)**
- [ ] **M4  — two-level ranking + "while you were gone" digest (DoD #1 — the one unmet DoD)  *(frontend)*  ← NEXT (the milestone now in flight, post-LV1) · pure-FE, no new dep · PO to write the M4 KICKOFF**
- [ ] E2E — one DoD journey  *(playwright)*
- [ ] M5  — (stretch) thin real heat

## SUGGESTED CYCLE ORDER (orchestrator — backend pure builders first, then I/O edges, then FE, then integration)
Smallest, purest seams first; the two highest-risk invariants (secrets-from-env, cost-gating) get explicit cycles.
1. **[backend] `setup`-frame builder** — pure `buildLiveSetup(...)`: prefixed model id, `responseModalities`
   EXACTLY `["AUDIO"]`, persona + no-spoiler `systemInstruction`. *(The cleanest first RED — pure function, no
   socket, no key, deterministic. **Recommended first behavior.**)*
2. **[backend] `POST /live/session` valid → token minted via injected client, key from env, never echoed**
   (+ fold in the model-id-from-env-default assertion).
3. **[backend] `POST /live/session` malformed → 400, no spend** (zod rejects; mint stub records zero calls).
4. **[backend] INVARIANT secrets-from-env** — body key ignored; env key only; nothing key-bearing in
   response/logs; ephemeral token never reaches the browser (topology b).
5. **[backend] relay attaches `Authorization: Token` + sends `setup` ONCE** (stubbed upstream socket).
6. **[backend] relay forwards `clientContent` turn + pipes `serverContent` PCM back** (stubbed upstream).
7. **[frontend] VoiceNarrator sends exactly the line wrapped in "speak only these exact words"** (injected fake
   relay WS; FE never sends `setup`).
8. **[frontend] VoiceNarrator plays returned PCM via injected `AudioContext`; resolves when playback drains.**
9. **[frontend] INVARIANT failure-silent** — fake relay/session fails → `speak` rejects → no forced audio.
10. **[frontend] INVARIANT cost-gating** — zero relay opens on construction/idle; exactly one per `speak`.
11. **[frontend] integration** — `narrating-host-loop` drives the injected `VoiceNarrator` (not Web Speech),
    zero on idle / one per surface / silent on reject; **§6 contract + loop logic unchanged**.
12. **CRITIC** (tdd-critic) every ~3–5 cycles; feed items back.
13. **ACCEPT** — qa-verifier drives the live app for the 3 qa-only bullets (audibly Gemini Live; spoken ==
    on-screen safe utterance, no pre-cut spoiler; silence budget holds); then PO sign-off vs this acceptance.
14. **RELEASE of LV1 to staging is infra-gated** (relay host — navigator); PO-accept can land on the green bar +
    qa against a local relay independently of staging.
