# Design notes — Based prototype · WDC · "Watchable demo cut" — KICKOFF

> **STATUS: WDC KICKOFF — ready for the inner TDD loop.** Navigator-prioritized ahead of M4
> (the navigator looked at the deployed staging app and chose **"quickest watchable cut first"**).
> **LV1 is SHIPPED** (browser-direct live Gemini voice, deployed + verified on staging 2026-06-03 —
> `backlog.md` → "Recently accepted — LV1"); its KICKOFF is replaced here by WDC. This file turns the
> navigator's brief into layer-tagged, observable acceptance bullets the orchestrator picks behaviors
> from. **Scope is the SMALLEST gap from "dev scaffold" to "open the link and watch."**
>
> _(A prior WDC attempt hit a transient error before this file was written — this is the retry; same scope.)_

---

## WHY THIS CUT (the navigator's read of the deployed app)

The engine works and the voice works — but the deployed Based app **reads as a dev scaffold**, not a
product. Concretely, on staging:
- **FAKE embeds** (`EXAMPLE_*` channel ids) render "offline" / 404 / crash the third-party player — there is
  no real video to watch.
- The UI is **bare**: the host is the literal text `"idle"`, the layout is a player + an unstyled rail + (with
  live voice on) console noise; there is no "product with a face."
- A **console flood** — most loudly `"The AudioContext was not allowed to start"` (the feed/audio kick off on
  mount, with no user gesture).

The brief's §1 is the thesis this cut serves: **"The product is the character, not the grid... a product with a
face."** LV1 gave the host a real voice; WDC closes the smallest gap so a navigator can **open the link, click
once, and watch** the host wake, speak, and cut between **real live streams**. It is NOT a redesign and adds no
new behavior — it is a **data swap + one gating gesture + presentational polish + a degradation guard**, all
behind the unchanged host loop / §6 contracts / cost-gating / live-voice path.

## DONE vs WHAT THIS CUT ADDS
**DONE + shipped to staging:** the host loop (silent↔active), the spoiler-safe **live Gemini voice**
(browser-direct, ADR 0007 Amendment C), the §6 contracts (`frontend/src/contracts/`), the channel-surf shell
(player + rail + manual surf), the deploy (App Runner mint + S3/CloudFront FE, `VITE_LIVE_VOICE=1`). **The MISS:**
it was all built on the §11 **mock data** (`EXAMPLE_*` placeholders) behind a **functional-not-polished** UI — the
watchable *experience* was deferred. **WDC adds exactly four things** (below), each the smallest move toward
"watchable."

## FEATURE
Make the deployed Based app **watchable in one click** — real live video, a host with a visible face, no broken
player or console flood. Four tight, layer-tagged moves; nothing behind the host loop or the §6 seam changes.

The navigator is concurrently sourcing **reliably-live real Twitch channels** (rifftrax, 247jynxzi, caedrel247,
lirik_247, jynxzi — 24/7, research-confirmed) for bullet 1's data swap. The host loop, cost-gating, silence
budget, spoiler-safety, and the live-voice transport are **UNCHANGED** — WDC swaps **WHAT plays** and **WHEN the
experience starts**, and **how it looks/degrades**, never **WHEN/WHETHER a line is voiced**.

## ACCEPTANCE CRITERIA (each → one or more red→green cycles where TDD-able; layer-tagged, observable)

_Each bullet is tagged **[TDD]** (a hermetic unit/component cycle drives it) or **[qa/visual]** (qa-verifier
confirms on the running app — not hermetically unit-testable). Where a bullet emits a `HostDirective`/narration or
renders an embed, the **Based invariants** ride along (re-asserted, not re-proven from scratch — the loop is
unchanged). Suggested first RED is the **"Start watching" gesture** (#2) — cleanest, purely our code, highest
console/UX payoff._

### 1 — Real streams (data swap; in progress — navigator sourcing ids)  — `[frontend]` **[TDD]** (the data assertion) + **[qa/visual]** (it actually plays)
- **[ ] [frontend] The mock event-graph references REAL, reliably-live Twitch channels via official
  `player.twitch.tv` embeds — no `EXAMPLE_*` placeholders remain.** Given the §11 mock (`frontend/src/mocks/event-graph.ts`),
  when its vantages are read, then every Twitch `embedUrl` is a `https://player.twitch.tv/?channel=<real-id>` for a
  research-confirmed 24/7 channel (rifftrax / 247jynxzi / caedrel247 / lirik_247 / jynxzi) — and **no `embedUrl`
  contains the substring `EXAMPLE_`**. _(TDD: a cheap data/guard test asserts no `EXAMPLE_` substring survives in
  any vantage `embedUrl`, and that Twitch vantages match the `player.twitch.tv/?channel=` shape — a tripwire so a
  future edit can't silently reintroduce a placeholder. **Invariant #5 official-embeds-only holds by construction**
  — these are first-party `player.twitch.tv` embeds rendered verbatim + the runtime `parent` the Player already
  appends (ADR 0008); no rehost.)_
- **[ ] [qa/visual] The real streams actually render live video on staging.** _(qa-only: open staging, confirm the
  player shows a live Twitch stream, not "offline"/404. Hermetic suite can't load a third-party iframe; this is the
  experience proof for the data swap.)_
- _Non-Twitch (YouTube/Kick) vantages: the Kick `EXAMPLE_JC` placeholder is the known crash/404 source (Kick's
  third-party player throws on a fake id). **Simplest watchable move: retarget the non-Twitch vantages to real
  reliably-live ids too, OR (if no reliable Kick/YouTube 24/7 id is confirmed) point those vantages at a real
  Twitch channel so every surfaced vantage is live.** Record at BUILD which; the bar is "every vantage that can be
  surfaced plays." Kick-platform variety is explicitly a deferred follow-up (below) — don't block WDC on sourcing a
  live Kick id._

### 2 — "Start watching" gesture (the cleanest first RED)  — `[frontend]` **[TDD]**
- **[ ] [frontend] Before the user clicks "Start watching", the feed/host/audio have NOT started; the app shows a
  clean start state.** Given the App on first mount, when nothing has been clicked, then the source feed is **not
  started**, no `HostDirective` has fired, and the UI shows a single clear **"▶ Start watching"** control (not a
  live player surfing on its own). _(TDD: assert the feed scheduler is **not** started on mount — e.g. the injected
  feed/`start` is not called — and that the start control is present. This is the move that **unblocks the
  `AudioContext` on a user gesture**, killing the `"AudioContext was not allowed to start"` flood: the host/audio
  path can only run after a real click. **The first-RED recommendation.**)_
- **[ ] [frontend] Clicking "Start watching" starts the feed and the host wakes on the click (not before).** Given
  the clean start state, when the user clicks "▶ Start watching", then the source feed **starts** (the scheduler is
  invoked) and the host/live-voice path begins — so the host wakes **on the click**, never on mount. _(TDD: click
  the control; assert the injected feed `start` is now called exactly once and the surfacing path is wired. The
  **AudioContext is created/resumed inside this user-gesture handler** so browser autoplay policy is satisfied —
  the load-bearing reason for the gesture. **Invariants ride unchanged:** cost-gating + silence budget are the same
  host-loop logic, now simply gated behind one click; the live-voice narrator still opens zero sessions until a
  line surfaces.)_

### 3 — Light UI polish (reads as a product with a face — brief §1)  — `[frontend]` **[qa/visual]** (look) + **[TDD]** (the host's idle/speaking state stays legible)
- **[ ] [frontend] The host is a VISIBLE PRESENCE whose idle vs speaking state is legible (not bare text).** Given a
  surfaced speak directive vs idle, when the host renders, then there is a **visible character presence** (an avatar/
  figure/styled host element) that **legibly distinguishes `idle` from `speaking`** — not the literal words
  `"idle"`/`"speaking"` alone. _(TDD-able at the state level: keep/extend the existing `role="status"` +
  `aria-label` assertion (`host speaking`/`host idle` in `character.tsx`) so the silent↔active signal stays
  test-pinned through the visual change — DoD #2 must not regress. The **visual quality** of the presence is
  qa/visual.)_
- **[ ] [qa/visual] The page reads as a product, not a dev tool — a real player + rail + host layout, styled rail.**
  Given the running app, when the navigator looks at it, then it presents as a deliberate **player + rail + host**
  layout with a **styled rail** (the spoiler-safe `type · streamer` labels from SPOILER-HARDENING/ADR 0009, legibly
  styled) — "lean-back channel-surfing" (brief §1), **NOT a redesign**, just "not a dev tool." _(qa/visual: the
  experience judgment. No new contract, no host-loop change — additive presentation on the existing
  `ChannelSurfShell`/`ChannelRail`/`Character`.)_

### 4 — Graceful embeds (offline/unavailable embeds don't crash/flood OUR app)  — `[frontend]` **[TDD]** (where it's our code) + **[qa/visual]**
- **[ ] [frontend] An offline/unavailable embed degrades quietly in OUR app — no crash, no app-level flood; the
  rail still works.** Given a vantage whose stream is offline/unavailable, when the player renders it, then **our
  app does not crash and does not emit an app-level error flood** — the player shows the platform's own "offline"
  state (acceptable) while the rest of the experience (rail, manual surf, host) keeps working. _(TDD where it's our
  code: e.g. a component test that an unavailable/empty vantage renders without throwing and the rail/surf path
  stays interactive. **Out of our control + out of scope:** third-party iframe console logs (Kick/Twitch's own
  player chatter) — we degrade **our** surface, not theirs.)_
- **[ ] [qa/visual] On staging, a non-live embed reads as "offline" — not a broken/blank crash.** _(qa-only: confirm
  the degraded case looks intentional, not broken. Pairs with bullet 1's qa proof. Note: this is mitigated, not
  eliminated, by static 24/7 ids — a robust always-live fix is the deferred "dynamic current-top-live fetch" below.)_

## WDC DEFINITION OF DONE
**The navigator opens staging, clicks "▶ Start watching," and sees:**
1. **Real video** — a live Twitch stream plays (no broken player, no "offline"/404 on the surfaced vantage).
2. The host **wakes, speaks (Gemini Live), and cuts** between streams over the timeline (DoD #2/#3/#4/#5 carried —
   silent→active, cut to vantage, LLM-generated live line, no spoiler before the cut).
3. **No app crash and no console flood from OUR app** (the `AudioContext`-not-allowed warnings are gone — audio is
   unblocked by the click).
4. It **looks like a product with a face** — a visible host, a real player+rail+host layout, a styled rail (brief §1).

Plus the engineering bar:
5. **`pnpm verify` = 0** across backend + frontend (the **[TDD]** bullets are green; the hermetic suite stays
   hermetic — no real iframe, no real socket, no real audio in the suite).
6. **tdd-critic = PASS** on the WDC cycles.
7. **qa-verifier confirms** the **[qa/visual]** bullets on the running app (real video plays; host wakes/speaks/cuts;
   no app-level flood/crash; reads as a product).
8. **PO sign-off** against this acceptance + product intent (§1 "a product with a face"; the four DoD watch-points).

**Which bullets are [TDD] vs [qa/visual]:**
- **[TDD] (the inner loop builds these):** the **"Start watching" gesture** (#2, both bullets — feed-not-started-
  on-mount, click-starts-feed/host) · the **real-streams data guard** (#1 — no `EXAMPLE_` survives; Twitch shape) ·
  the **host idle/speaking state stays legible** (#3 — the `role=status`/`aria-label` pin) · **graceful-embed where
  it's our code** (#4 — unavailable vantage renders without throwing, rail/surf stays interactive). **5 cycles' worth.**
- **[qa/visual] (qa-verifier at ACCEPT):** real video actually renders live (#1) · the page reads as a product /
  styled layout (#3) · offline reads as "offline" not "broken" (#4). These assert the **experience** the hermetic
  suite can't (it loads no third-party iframe and renders no pixels for judgment).

## SUGGESTED CYCLE ORDER (orchestrator — smallest/purest, highest-payoff first)
1. **[frontend] "Start watching" — feed NOT started on mount + clean start control present** *(the cleanest first
   RED — purely our code, deterministic with an injected feed, and it directly kills the `AudioContext` console
   flood. **Recommended first behavior.**)*
2. **[frontend] "Start watching" — click starts the feed (scheduler invoked once) + wires the host/audio path**
   (AudioContext created/resumed inside the gesture handler — record the exact wiring at BUILD).
3. **[frontend] Real-streams data guard** — no `EXAMPLE_` substring in any vantage `embedUrl`; Twitch vantages match
   `player.twitch.tv/?channel=` (a tripwire; the actual id values are the navigator's data, swapped in the mock).
4. **[frontend] Host idle/speaking stays legible** — keep/extend the `role=status` + `aria-label` (`host speaking`/
   `host idle`) assertion through the visual presence change, so DoD #2 can't silently regress.
5. **[frontend] Graceful embed (our code)** — an unavailable/empty vantage renders without throwing; rail + manual
   surf stay interactive.
6. **CRITIC** (tdd-critic) after the ~5 cycles; feed items back.
7. **ACCEPT** — qa-verifier drives staging for the [qa/visual] bullets (real video plays; host wakes/speaks/cuts;
   no app-level flood/crash; reads as a product with a face); then PO sign-off vs this acceptance.

## BASED INVARIANTS (carried — re-ASSERTED, not re-proven from scratch; the host loop / §6 seam are UNCHANGED — ADR 0003)
WDC adds no new narration path and does not reshape the host loop, so the invariants ride on the unchanged logic;
where a WDC bullet touches an invariant-bearing path it must keep the existing assertion green:
1. **Spoiler-safety — KEPT, by construction.** No new text is generated; the host still speaks the already-safe
   `HostDirective.utterance` (LV1/ADR 0006), and the **rail still shows the spoiler-safe `type · streamer`** label,
   never the outcome-bearing `narrative` (SPOILER-HARDENING / ADR 0009). The UI-polish bullet must **not** reintroduce
   `narrative` onto the page. _Pinned by:_ the existing rail spoiler tests (unchanged) + the host-legibility cycle.
2. **Silence budget — KEPT.** Idle is still the default; the host still earns its interruptions. WDC only gates the
   *start* of the experience behind one click — it does **not** change the silence budget or add any new speak.
   _Carried by:_ the unchanged host-loop tests; the "Start watching" cycles assert the feed only runs after the click.
3. **Cost-gating — KEPT.** The live-voice narrator still opens **zero** sessions until a line surfaces (LV1), and
   `/narrate` still fires only on a surfacing event. Gating the feed behind a click can only **reduce** spend, never
   increase it (no feed until the user opts in). _Carried by:_ the unchanged LV1 cost-gating + narrate cost-gating
   tests; the "click starts the feed" cycle asserts exactly one feed start.
4. **Official embeds only — KEPT, the load-bearing WDC invariant.** The real-streams swap uses **first-party
   `player.twitch.tv` embeds rendered verbatim** + the runtime `parent` the Player already appends (ADR 0008); no
   rehosting, no restreaming — the embed `src` is still the official URL. _Pinned by:_ the real-streams data guard
   (no `EXAMPLE_`; `player.twitch.tv/?channel=` shape) + the existing Player verbatim/parent tests (unchanged).
5. **Secrets-from-env — KEPT, untouched.** WDC is pure FE (data + gesture + presentation + degradation); it touches
   no key/credential path. `GEMINI_API_KEY` stays server-side (M3/LV1); the FE holds only `VITE_API_BASE_URL` +
   `VITE_LIVE_VOICE`. _No new test needed; not on this path._
6. **Contracts-as-seam — ENFORCED.** No §6 contract changes. The FE still trades only `RankedFeed` + `HostDirective`
   (+ the `VoiceNarrator` behind the speak seam). WDC is a data swap + a gating control + presentation + a render
   guard **above** the contracts — the character/player/host-loop wiring is otherwise unchanged.

## CONSTRAINTS / NON-GOALS
- **NOT a redesign and NOT a new behavior.** WDC = **data swap (real ids)** + **one gating gesture (Start watching)**
  + **light presentational polish** + **a graceful-degradation guard**. Do **NOT** reshape `frontend/src/contracts/`,
  `host-loop.ts` / `narrating-host-loop.ts`, the live-voice transport (`live-narrator.ts` / `live-relay-client.ts` /
  `audio-sink.ts`), or the cut (`cutToVantage.embedUrl` stays rendered verbatim + the ADR 0008 `parent`). The
  silence budget / cost-gating / spoiler-safety logic are **untouched** — only **gated behind one click** and
  **fed real ids**.
- **Real ids are the navigator's data (in progress).** The implementer swaps the confirmed ids into
  `frontend/src/mocks/event-graph.ts`; the **[TDD]** cycle proves the **shape/guard** (no `EXAMPLE_`,
  `player.twitch.tv/?channel=`), not the specific channel names (those are content). Use the navigator-confirmed
  24/7 ids: rifftrax, 247jynxzi, caedrel247, lirik_247, jynxzi.
- **The hermetic suite stays hermetic.** No test loads a real third-party iframe, opens a real socket, or plays real
  audio. The feed scheduler, the live-voice edges, and (for the graceful-embed cycle) the player's render are
  asserted via component/unit tests + injected fakes — never against a live stream. The "it actually plays" / "looks
  like a product" / "offline reads as offline" proofs are **qa-verifier on staging**.
- **AudioContext autoplay is a real browser constraint — satisfy it in the gesture handler.** The
  `"AudioContext was not allowed to start"` flood is because audio is touched before any user gesture. The
  **"Start watching" click is the gesture** that creates/resumes the `AudioContext`; record at BUILD exactly where
  (likely in the click handler that also starts the feed) so the unblock is real, not incidental.
- **Third-party iframe console logs are out of our control.** Bullet 4 degrades **our** app's behavior (no crash, no
  *app-level* flood, rail keeps working); it does **not** promise to silence Kick/Twitch's own player console output.
  qa judges "does OUR app stay clean + intentional," not "is the iframe silent."
- **OUT of scope for WDC (deferred follow-ups — named so they aren't lost):**
  - **The "while you were gone" digest on load (DoD #1)** — that's **M4** (the one unmet brief DoD), queued
    immediately after WDC. WDC does **not** add the digest.
  - **Deep visual design / a real design system** — WDC is "not a dev tool," not a polished UI. A real visual pass is
    a later, separate item.
  - **Dynamic "current top live channel" fetch** — the robust always-live fix (query a platform API for a currently-
    live channel so a *shared* staging link is always live). Static research-confirmed 24/7 ids are the WDC
    expedient; they can still go offline, hence bullet 4's graceful degrade + this deferred robust fix. Filed as a
    follow-up behind M4.
  - **Real two-level ranking** — M4 (event rank → `RankedFeed` desc + best-lens vantage rank). WDC keeps the M1
    placeholder `eventScore = heatDelta`.
  - **Kick-platform variety** — sourcing a reliably-live Kick (or YouTube) 24/7 id for embed-platform diversity.
    WDC may retarget the non-Twitch vantages onto a real Twitch id rather than block on a live Kick id; real
    Kick/YouTube variety is a deferred follow-up.
- **Decision posture:** WDC introduces **no new §13 escalation**. It rides on settled-for-now defaults (persona =
  one host; voice = the shipped Gemini Live, with the **audible/voice-identity confirmation still the navigator's ear
  at demo** — carried from LV1, see `backlog.md` → Decisions needed); rights/ToS for the real ids = **official Twitch
  embeds only** (the existing settled invariant — these are first-party `player.twitch.tv` embeds, no rehost). The
  tier-aware-hedging wording stays the M3 default (non-blocking; pre-external-demo). If the navigator dislikes the
  voice at the WDC watch-through, that's the **existing** LV1 voice-config defect, not a WDC change.

## MILESTONE CHECKLIST
- [x] M0a — TDD harness bootstrapped + verified
- [x] M0b — contracts + event bus + mock source-graph feed  *(frontend)*  · critic PASS
- [x] M1  — channel-surf shell: player + rail, manual surf, official embeds only  *(frontend)*  · PO-accepted
- [x] M2  — character silent↔active + TTS + cut + client host loop  *(frontend)*  · PO-accepted
- [x] M3  — real Gemini narration: `/narrate` proxy + FE swap  *(backend → frontend)*  · PO-accepted · DoD #4
- [x] LV1 — live-voice host: `gemini-3.1-flash-live-preview`, browser-direct (ADR 0007 Amendment C), native streaming audio  *(backend → frontend)*  · ✅ RE-ACCEPTED + SHIPPED to staging 2026-06-03 (audible/voice confirmation = navigator at demo)
- [ ] **WDC — "Watchable demo cut": real Twitch streams + "Start watching" gesture + light UI polish + graceful embeds  *(frontend)*  ← IN FLIGHT (navigator-prioritized ahead of M4 — "quickest watchable cut first")**
- [ ] M4  — two-level ranking + "while you were gone" digest (DoD #1 — the one unmet DoD)  *(frontend)*  ← NEXT after WDC · pure-FE, no new dep
- [ ] E2E — one DoD journey  *(playwright)*
- [ ] M5  — (stretch) thin real heat
