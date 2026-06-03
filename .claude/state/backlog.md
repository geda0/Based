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

### M3 follow-ups — carried open (none gate the M3 release; address opportunistically / at M4)

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
- **POLISH · critic nits (M1 + M2 + M3)** — `[frontend|backend]` — priority: low — status: todo
  - Non-blocking tdd-critic nits; do opportunistically (e.g. alongside M4 work). No product impact.
    The M3 #3 (vantage dedup) + #4 (seam tripwire) nits are folded in here (last two entries).
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
    - **(M2-c / M3 · tdd-critic #3)** `topVantage` (max-`lensScore` vantage selection) is now **triplicated**
      across `channel-surf-shell.tsx:6` (the `topVantage` fn), `host-loop.ts:32` (inline `reduce`), **and**
      M3's `narrating-host-loop.ts` (the third copy). Extract **one** shared helper into `frontend/src/lib`
      and have all three call it (single source of truth for "best vantage"). _(M3 added the third site, so
      the dedup payoff grew; still low-priority/no-product-impact — do opportunistically, ideally folded into
      the #4 seam-tripwire pass or M4 ranking work which also touches vantage selection.)_
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
default; model stubbed in the suite). Two §13 calls remain **OPEN but non-blocking** — **tier-aware
hedging** + **spoiler-across-surfaces** — both still needed only **before a generated line / the rail
is shown externally** (they shape wording, not seams). **Voice identity is NOW ACTIVE:** LV1 (live-voice
host) is the milestone that resolves it — the navigator chose the Gemini Live streamed-audio direction,
so it moves out of "settled-for-now/external-demo gate" (see below). **Persona / rights** stay
settled-for-now on the M2 defaults (re-attach at the first external demo) — kept for visibility._

- **Tier-aware hedging — how hard to hedge confidence tiers 2–4** (esp. IRL/breaking: highest
  spoiler + misinformation risk). **OPEN (shipped in M3 on the default; non-blocking).** _Recommend:_
  tier 1 → state plainly; tiers 2–4 → hedge in register ("looks like", "chat's losing it over"), tier 4
  → explicitly *unconfirmed* (per §10/§14). M3 built the proxy + invariant tests on this default with the
  model stubbed, so the exact hedging copy is tunable without reshaping the seam; LV1 inherits the same
  prompt + default. **Needed by:** showing a generated line externally (the wording is brand- and
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
  channel ids — a content/curation call, no code change). [pending — external-demo gate]
