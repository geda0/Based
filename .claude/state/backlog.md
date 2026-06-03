# Backlog — Based prototype (owned by product-owner)

_Prioritized features. The PO selects the top unblocked item, writes `design-notes.md`
for it, and the orchestrator runs the inner TDD loop. Status: todo | in-progress |
done | blocked. Order follows the brief's milestones (§9); any re-prioritization is
logged with a one-line rationale. Acceptance criteria are layer-tagged and tied to
the brief's Definition of Done (§12) and invariants (ADR 0003)._

## Now (in flight)
_None. LV1 RE-ACCEPTED on the browser-direct transport (below); M4 is next — see Next._

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

### M4 · Two-level ranking + "while you were gone" digest — `[frontend]` — milestone: **M4** — priority: **NEXT (the milestone now in flight, post-LV1)** — status: **todo — UNBLOCKED (LV1 conditionally accepted)**
  - **Why now:** LV1 is conditionally accepted, so M4 is the next milestone and the **one unmet brief DoD** —
    **DoD #1** ("a useful digest of what you missed loads on entry; the channel is never empty even at 4am").
    M4 is pure-FE, no new external dep — a clean next feature (this was always the fallback-first item, and is now
    simply the next item). _(PO will write the M4 KICKOFF into `design-notes.md` when the orchestrator opens M4;
    DESIGN: additive-on-existing-contracts ranking + a digest directive — confirm with the architect whether the
    digest needs any §6 shape change or fits the existing `HostDirective`/`RankedFeed`.)_
  - **Goal:** event rank → `RankedFeed` desc; vantage rank picks best lens; **digest on load** (DoD #1 — the
    channel is never empty even at 4am; brief §5/§9 M4).
  - **Acceptance (sketch — finalize at the M4 KICKOFF):** events sorted by `eventScore` desc; best `lensScore`
    chosen; a **digest directive produced FIRST on load** (before any timeline event); ≥2 events fire over the
    timeline. **On any path that emits a `HostDirective`/narration (incl. the digest), re-assert the Based
    invariants** — the digest line must be **spoiler-safe** (anticipation-only, no leaked outcome, every directive
    `spoilerSafe: true`), within the **silence budget**, and **cost-gated** (no storm on load).
  - **Carry-forward risks to TEST HERE (per `progress.md`):** `HostDirective.staging.fireAtMs` (ms) vs
    `Vantage.offsetSec` (sec) off-by-1000 trap — convert explicitly + test; `RankedFeed.events` "sorted desc by
    `eventScore`" is a doc-comment the ranker must **PROVE** with an ordering test (M1 used a placeholder
    `eventScore = heatDelta`).
  - **Depends on:** M0b contracts ✓, M1 shell ✓. UX-affecting → qa-verifier on green.

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
struck entry below). **One escalation remains for the LV1 RELEASE/demo:** the audible/voice confirmation above.
**Persona / rights** stay settled-for-now on the M2 defaults (re-attach at the first external demo). **Release
note:** the embed/spoiler staging fixes are now DEPLOYED (CI `GEMINI_MODEL`→SSM gap CLOSED on `ce194e7`) — so
model-id-changing releases (incl. LV1's `gemini-3.1-flash-live-preview`) are CI-safe; **the LV1 staging release is
now a plain App-Runner-mint + S3/CloudFront-FE deploy** (NO relay, NO ECS)._

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
- **Voice identity / audible confirmation — does the Gemini Live voice SOUND right?** **⏳ ACTIVE — the LV1
  accept condition; needs the navigator's EAR (escalated 2026-06-03).** The **engine is resolved** (navigator
  chose `gemini-3.1-flash-live-preview` streamed audio over Web Speech, 2026-06-02; LV1 is built + conditionally
  accepted). But LV1's **one qa-only bullet that no agent can close** is whether the streamed voice is **AUDIBLY**
  right: qa proved the **pipeline executes** end-to-end (37 PCM frames → `audio.play()` → 24 kHz AudioContext →
  `speak()` resolves on drain → WS closes) and the line is spoiler-safe, but whether it **sounds**
  audible / intelligible / like the host we want is a **human-ear judgment**. _PO recommendation / default:_
  **accept the current default Live voice for the prototype demo as-is** (the pipeline is proven; the line is
  spoiler-safe and matches on screen) — the specific voice/persona-audio config is a low-risk **tuning knob**,
  not a seam, so it can be adjusted without reshaping anything if the navigator dislikes it. **Action for the
  navigator:** at demo, listen — if the voice is inaudible/wrong, file an LV1 voice-config defect (output-audio /
  voice-selection tuning); otherwise this §13 call closes. **Needed by:** the LV1 demo. [ACTIVE — navigator's ear
  at demo; recommended default above]
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
