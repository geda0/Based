# Backlog — Based prototype (owned by product-owner)

_Prioritized features. The PO selects the top unblocked item, writes `design-notes.md`
for it, and the orchestrator runs the inner TDD loop. Status: todo | in-progress |
done | blocked. Order follows the brief's milestones (§9); any re-prioritization is
logged with a one-line rationale. Acceptance criteria are layer-tagged and tied to
the brief's Definition of Done (§12) and invariants (ADR 0003)._

## Now (in flight)
- _(none — M3 PO-accepted 2026-06-02; next milestone selected below: **LV1 · Live-voice host**.
  Orchestrator note: the `m3` RELEASE step — PM + dev-ops commit/tag `m3` + deploy to staging + verify
  health → `releases.md` — runs in parallel per the PM cadence; not a PO gate.)_

## Next (prioritized)

### LV1 · Live-voice host — `gemini-3.1-flash-live-preview` over the WebSocket Live API (native streaming audio) — `[backend]`→`[frontend]` — milestone: **post-M3 (navigator-chosen)** — priority: **NEXT, before M4** — status: **todo · SEAM-TOUCHING → architect DESIGN required**
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
- **M4 · Two-level ranking + "while you were gone" digest** — `[frontend]` — status: todo — _sequenced AFTER LV1 (navigator's call); still high-value, fallback-first if LV1's live-audio integration proves heavy_
  - Goal: event rank → `RankedFeed` desc; vantage rank picks best lens; **digest on load** (DoD #1 — the
    one DoD item still unmet; the channel is never empty even at 4am — brief §5/§9 M4).
  - Acceptance (sketch): events sorted by `eventScore` desc; best `lensScore` chosen;
    digest directive produced first; ≥2 events fire over the timeline.
  - Carry-forward risks to TEST HERE (per progress.md): `HostDirective.staging.fireAtMs` (ms) vs
    `Vantage.offsetSec` (sec) off-by-1000 trap; `RankedFeed.events` "sorted desc by `eventScore`" is a
    doc-comment the ranker must PROVE with an ordering test (M1 used a placeholder `eventScore=heatDelta`).
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
_Status (post-M3, LV1 in flight): **M3 is Done** (shipped on the §10 prompt + recommended hedging
default; model stubbed in the suite). **spoiler-across-surfaces is now RESOLVED** (rail hedged via
SPOILER-HARDENING; ADR 0009 — local + green, deploy-gated below). **One §13 wording call remains OPEN but
non-blocking — tier-aware hedging** — needed only **before a generated line is shown externally** (shapes
wording, not a seam). **Voice identity is RESOLVING via LV1:** the navigator chose the Gemini Live
streamed-audio direction, so it moves out of "settled-for-now/external-demo gate" (see below). **Persona /
rights** stay settled-for-now on the M2 defaults (re-attach at the first external demo) — kept for visibility.
**Release note:** the two staging demo-blocker fixes (EMBED-TWITCH-PARENT, SPOILER-HARDENING) are **local +
green but deploy-gated on the CI `GEMINI_MODEL`→SSM fix** — see "Deploy dependency" in the embed follow-ups._

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
- **Voice identity — what voice/engine the host speaks in.** **NOW ACTIVE → RESOLVED BY LV1.** Was
  settled-for-now on Web Speech's default voice (M2/M3, behind the abstracted `speak(text)` — swappable
  without touching callers). **Navigator decision (2026-06-02): replace Web Speech with native streamed
  audio from `gemini-3.1-flash-live-preview` over the Live API** (the **LV1 · Live-voice host** milestone
  above). That is the deliberate-voice direction the §13 call asked for; it makes the host *audibly* alive
  and lays the conversational-host foundation. Picking the *specific* voice/persona-audio settings within
  the Live API stays a tuning call for the first external demo. [resolving via LV1]
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
