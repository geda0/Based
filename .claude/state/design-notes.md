# Design notes — Based prototype · M5 (re-scoped) · "Based TV — cross-platform Source abstraction" — KICKOFF

> **STATUS: M5 RE-SCOPED — the navigator's PRODUCT VISION ("Based TV").** M0–M4, LV1, WDC, WDC-D2 are all
> shipped/accepted — **the prototype is feature-complete against the brief's §12 Definition of Done** (M4 was the
> last unmet DoD; tag `m4`, pushed, deployed). M5 was originally framed as the brief's §9 "thin real heat" (one
> Twitch adapter → viewer-count `heatDelta`). The navigator delivered a vision that **reframes M5 into "Based TV":
> a nimble, events-based, multi-SOURCE platform** — many platforms (Sources) feed channels/feeds into the product,
> and the EXISTING engine (ranker → host loop → digest) operates over them, **unchanged**. The old "thin real heat"
> adapter survives — it becomes **Phase 2** (the YouTube/real-fetch Source) — but the NEW core is **Phase 1: the
> Source abstraction itself**, the seam beneath the engine.
>
> **The navigator's words, decoded:** _"Based TV is a based tv — nimble, events-based, with sources."_ Multiple
> **SOURCES** (platforms) feed **channels/feeds** into the product. Twitch = continue the live style we built.
> YouTube = seeded DIFFERENTLY, "as a TV" (channels / feeds / shorts / **follow-leads**, NOT "top live now").
> **NEWS = the default of the whole platform.** **Cross-platform feeds** = a person/topic aggregated across
> platforms (e.g. Asmongold's *news* on Twitch AND YouTube). **"We are NOT replacing what we built"** — the
> ranking + host commentary + the digest now operate over the channels/feeds in our TV; the engine is **unchanged**;
> sources + channels/feeds are the **new layer beneath it**.
>
> **M5 is PHASED — each phase is independently shippable** (this is bigger than a thin adapter):
> - **P1 — the Source seam + Twitch as a Source** (buildable NOW, no new creds): refactor the static mock into a
>   **Source** producing channels/feeds → `PerceptionEvent`s; the existing Twitch channels become the first real
>   Source. Proves the abstraction end-to-end against the UNCHANGED engine. **← P1 is the IN-FLIGHT phase; its first
>   RED is below.**
> - **P2 — the YouTube Source (channels/feeds/shorts)** (needs a YouTube Data API key, navigator-provisioned,
>   server-side like `GEMINI_API_KEY`): fetch SEEDED YouTube channels' recent videos/shorts via the Data API
>   (`channels.list` / `playlistItems`, NOT the unreliable "search top-live"). This is where the old "thin real
>   heat" adapter work lands — re-pointed at YouTube + behind the P1 Source seam.
> - **P3 — news-default + cross-platform feeds** (needs a news-channel seed, navigator-named or PO-recommended):
>   seed NEWS channels/feeds as the platform default; aggregate a lead/topic across Sources (Asmongold-style — the
>   same person's *news* surfaced from both the Twitch Source and the YouTube Source as ONE cross-platform feed).
>
> **M5 is SEAM-TOUCHING → architect DESIGN + an ADR are REQUIRED (a new §6 PRODUCER pattern — the Source seam).**
> The architect is designing IN PARALLEL; an ADR is coming. **P1 is buildable NOW** (no creds — it re-expresses the
> existing mock as a Source) **but should not start the inner loop until the architect confirms the Source seam
> shape** (the producer interface + the registry topology) so the first RED targets the right contract. **P2
> carries a BLOCKING §13 navigator decision — the YouTube Data API key.** **P3 carries a navigator decision — the
> news-channel seed.** Both are surfaced below + in `backlog.md` → Decisions needed.
>
> **THE ENGINE IS UNCHANGED.** This is the SOURCE / CHANNEL / FEED layer **beneath** the engine. Do NOT reshape the
> §6 `PerceptionEvent` / `RankedFeed` / `HostDirective` contracts, `lib/ranker.ts` (M4), `lib/source-graph-feed.ts`,
> the host loop, or the `/narrate` + live-voice transport. M5 adds Sources that **produce** `PerceptionEvent`s into
> the SAME pipeline.
>
> _(The shipped M4 KICKOFF — two-level ranking + the "while you were gone" digest — is a historical pointer at the
> bottom; its full accept record lives in `backlog.md` under the M4 entry. The PRIOR "thin real heat" M5 KICKOFF is
> SUPERSEDED by this re-scope; its adapter acceptance is re-homed under P2 below.)_

---

## M5 — WHY THIS FEATURE (Based TV — the platform shape beneath the host)

The prototype proved the thesis — **the character earning its interruptions (silent ↔ active)** — against a
**single static, hand-authored** event graph (`frontend/src/mocks/event-graph.ts`). The host is real and
watchable, but everything it watches comes from **one scripted fixture**. The navigator's vision names the next
honest shape: **Based is a TV with many SOURCES.** Twitch is one Source (live streams). YouTube is another, seeded
*as a TV* (channels / feeds / shorts / follow-leads). News is the **default** Source. A person or topic can be a
**cross-platform feed** — the same Source-agnostic event aggregated from multiple platforms.

The engine we built — rank the events, let the host narrate the top one spoiler-safe, deliver the catch-up digest
— is exactly right and stays exactly as it is. What's missing is the **layer beneath it**: a clean **Source
abstraction** so platforms plug in nimbly, each producing channels/feeds that become `PerceptionEvent`s the
existing engine already consumes. That is the seam the brief's §6 promised ("swap mock for real without touching
the UI") — generalized from "one mock producer" to "**many Source producers behind one registry**."

M5 (Based TV) delivers that abstraction and lights it up across three platforms, phased so each step ships:

1. **P1 proves the seam** — re-express the existing mock as a **Source**, have the App consume a **Source
   registry**, and route Twitch through it as the first real Source. Buildable now, no creds. The engine is
   provably unchanged because the SAME `PerceptionEvent[]` flows through it — just produced by a Source instead of
   imported as a fixture.
2. **P2 adds a real cross-platform Source** — YouTube, seeded *as a TV* (recent videos/shorts of SEEDED channels
   via the Data API), the old "thin real heat" fetch re-homed behind the P1 seam.
3. **P3 makes news the default + conquers cross-platform feeds** — seed news as the platform default and aggregate
   a lead/topic (Asmongold-style) across the Twitch + YouTube Sources into ONE feed.

This makes the brief's §1 claim ("an AI host who watches all of live streaming, across Twitch, YouTube, Kick,
TikTok") *demonstrably multi-platform* — and it does it without touching the engine that already works.

## M5 — DONE vs WHAT THIS FEATURE ADDS

**DONE + shipped (the ENGINE M5 feeds, UNCHANGED — do NOT touch):** the §6 contracts (`PerceptionEvent →
RankedFeed → HostDirective`), the REAL two-level ranker (`lib/ranker.ts` — M4), the in-time source-graph feed
scheduler (`lib/source-graph-feed.ts`), the host loop (silent↔active, spoiler-safe + silence-budget + cost-gated),
the live Gemini voice + `/narrate` proxy (the **secrets-from-env template** a real Source mirrors —
`backend/src/modules/narrate/` + LV1's mint `backend/src/modules/live/`), the channel-surf shell + rail + player
(official embeds verbatim + ADR 0008 `parent`), the digest-on-load. **The MISS:** there is exactly ONE producer of
events — a static hand-authored fixture imported directly by `App.tsx`. There is no Source abstraction, no Source
registry, no second platform, and no concept of news-as-default or a cross-platform feed.

**M5 adds the SOURCE / CHANNEL / FEED layer beneath the engine, phased:**
- **P1:** a **Source** producer interface + a **Source registry** the App consumes; the existing mock
  re-expressed as a `Source`; Twitch routed through it as the first real Source. (No creds; engine unchanged.)
- **P2:** a **YouTube Source** — seeded channels' recent videos/shorts via the Data API → `PerceptionEvent`s
  (real, cross-platform; the old "thin real heat" fetch, re-homed). (Needs a YouTube Data API key.)
- **P3:** **news as the default Source** + a **cross-platform feed** aggregating a lead/topic across Sources.
  (Needs a news-channel seed.)

## M5 — FEATURE

Introduce a **SOURCE abstraction** for Based TV: each platform is a **Source** that produces channels/feeds →
`PerceptionEvent`s into the **EXISTING** engine (ranker → host loop → digest → channel-surf UI), unchanged. A
**Source registry** aggregates Sources; the App consumes the registry instead of importing a static fixture.
**Nimble** — Sources plug in. Ship it in three independently-demoable phases: **P1** the seam + Twitch-as-a-Source
(no creds); **P2** the YouTube Source (channels/feeds/shorts via the Data API — needs a server-side key); **P3**
news-as-default + cross-platform feeds. On every new path that produces events the host narrates, the Based
invariants ride: **secrets-from-env** (YouTube/Twitch creds server-side only), **cost-gating** (cached fetches, no
storm), **official-embeds-only** (`player.twitch.tv` / `youtube.com/embed` verbatim + ADR 0008 `parent`),
**spoiler-safety** (untrusted real/news titles never rendered/narrated unsafely — the rail stays
`` `${type} · ${streamer}` ``). The existing mock remains a valid Source so the suite stays hermetic and a
no-network demo still works.

## M5 — ACCEPTANCE CRITERIA (layer-tagged, observable; grouped by phase; each → one or a few red→green cycles)

> _Tags: **[backend]** / **[frontend]** / **[e2e]** = the layer; **[TDD]** = a hermetic unit/component cycle drives
> it; **[qa/visual]** = qa-verifier / navigator confirms on the running app (the hermetic suite can't judge "a real
> YouTube short actually plays"). Any REAL platform HTTP call (P2/P3) is the **untested I/O edge** — STUB it in the
> suite (exactly like M3's `gemini-client` `fetch` and LV1's mint): tests assert on the **Source contract**, the
> **mapping** (a fixed fixture API response → valid `PerceptionEvent`s), the **secrets-from-env** guard, the
> **cost-gating / caching** guard, the **registry aggregation**, the **fallback** behavior, and the
> **spoiler-safety of produced events** — never on live API data. **The exact YouTube/Twitch field names assume the
> Data APIs noted; the architect re-points them at DESIGN — the SHAPE of the bullets is Source-agnostic.**_
>
> **The FIRST RED is P1#1 (the Source contract — the existing mock re-expressed as a Source). Buildable NOW.**

### PHASE 1 — the Source seam + Twitch as a Source (buildable NOW, no creds; proves the abstraction end-to-end)

#### P1#1 — The Source contract: the existing mock is re-expressed as a Source (the FIRST RED) — `[frontend]` **[TDD]**
- **[ ] [frontend] A `Source` produces the same `PerceptionEvent[]` the static mock holds today — so the engine
  consumes a Source, not a fixture.** Given a new `Source` producer abstraction (the architect sets the exact
  shape — e.g. `interface Source { id: string; channels(): PerceptionEvent[] }` or an async
  `channels(): Promise<PerceptionEvent[]>`; a registry-friendly shape) and the existing §11 demo graph wrapped as a
  Source (e.g. `createMockSource()` / `twitchMockSource` returning the current `events`), when its
  channels/feed method runs, then it returns the **same contract-valid `PerceptionEvent[]`** the static mock holds
  today (every event still passes the §6 shape — ids, `type`, `heatDelta∈[0..1]`, vantages with first-party
  `embedUrl`, etc.), with **no change to the events themselves**. _(TDD: the load-bearing FIRST RED — it pins the
  Source PRODUCER contract by re-expressing what already works as a Source, with ZERO behavior change to the events.
  Pure, deterministic, no network. This is the seam's foundation; everything else plugs into it.)_

#### P1#2 — A Source registry aggregates Sources into one event stream — `[frontend]` **[TDD]**
- **[ ] [frontend] A Source registry aggregates one-or-more Sources into a single `PerceptionEvent[]` the engine
  consumes.** Given a registry (the architect's shape — e.g. `createSourceRegistry([sourceA, sourceB])` exposing
  `allChannels(): PerceptionEvent[]`) and two fixture Sources, when it aggregates, then it returns the **union** of
  their events (every event contract-valid; stable/deterministic ordering the ranker then re-sorts; ids stay unique
  or are namespaced per Source so two Sources can't collide). With a SINGLE Source (the Twitch mock), the registry
  yields exactly that Source's events — so P1 is a behavior-preserving wrap. _(TDD: pins that the registry is the
  pluggable seam — N Sources → one stream → the existing `rankFeed` / `createSourceGraphFeed`. The union + id-safety
  is what makes P2/P3 additive: a new Source is just another registry entry.)_

#### P1#3 — The App consumes the Source registry (Twitch as the first real Source) — `[frontend]` **[TDD]**
- **[ ] [frontend] The App sources its events from the Source registry (Twitch-mock Source) and feeds them through
  the UNCHANGED `rankFeed` → `createSourceGraphFeed` → host loop → shell/rail path — no engine change.** Given
  `<App/>`, when it mounts, then it builds its events from the **registry** (the Twitch-mock Source) rather than
  importing the static `events` fixture directly, and those events flow through the **SAME** ranker / feed / host
  loop / UI (ranked by the SAME ranker, narrated by the SAME host loop, the digest unchanged) — the M4
  ranking/digest/cost-gating coverage stays green. The existing `vi.mock`'d `App.test.tsx` fixture is adapted so
  the App's behavior (gesture-gating, surface→speak, drain-revert, cost-gating tripwire, digest-first) is pinned
  **through the registry seam**, independent of which Source supplies the events. _(TDD: cross-wiring step — the App
  consumes a registry, not a fixture; the engine is provably untouched because the SAME `RankedFeed`/`HostDirective`
  drive the UI. This is the swap that makes "Twitch is a Source" real and lets P2/P3 add Sources without touching
  `App.tsx` again. Do NOT re-couple the App tests to the live mock — inject the registry/Source.)_

#### P1#4 — Invariants RE-ASSERTED on the Source seam (no regression) — `[frontend]` **[TDD]**
- **[ ] [frontend] The events produced via the Source/registry still satisfy the Based invariants — proven on the
  new producer path.** Given the registry's aggregated events run through the existing rail/digest/host surfaces,
  then: **spoiler-safety** holds (the rail still labels `` `${type} · ${streamer}` ``, no raw `narrative` rendered —
  ADR 0009; every directive `spoilerSafe: true`), **official-embeds-only** holds (each vantage `embedUrl` is the
  first-party host verbatim + ADR 0008 `parent`, no rehost), **cost-gating** holds (the registry is read a bounded
  number of times — once at load, not per-render/timer; the host-loop cost-gating tripwire still green), and the
  **silence budget** is untouched (the host loop is the SAME). _(TDD: P1 changes the PRODUCER of events, so the four
  data-path invariants are re-asserted on the new path — but since the events are unchanged and the engine is
  untouched, these are re-assertions, not net-new proofs. **Note:** P1 adds NO new credential path — so
  secrets-from-env has no new surface in P1; it becomes load-bearing in P2.)_

### PHASE 2 — the YouTube Source (channels/feeds/shorts — seeded AS A TV, not "top live now") · NEEDS a YouTube Data API key

> _P2 re-homes the prior "thin real heat" adapter work behind the P1 Source seam, re-pointed at YouTube and seeded
> AS A TV (the navigator: YouTube is seeded DIFFERENTLY — channels / feeds / shorts / follow-leads, NOT "top live
> now"). **Buildable only once the navigator provisions a YouTube Data API key** (server-side, like
> `GEMINI_API_KEY`). The architect designs the backend endpoint + cache + mapping at DESIGN._

#### P2#1 — A YouTube Source maps seeded-channel videos/shorts → valid `PerceptionEvent`s (the mapping proof) — `[backend]` **[TDD]**
- **[ ] [backend] A pure adapter maps a fixture YouTube Data API response (SEEDED channels' recent videos/shorts)
  into valid `PerceptionEvent`s, each with a first-party `youtube.com/embed` vantage.** Given a new pure mapping
  function (e.g. `mapYouTubeToEvents(apiResponse): PerceptionEvent[]` in a new backend YouTube-source module) and a
  **fixed fixture** of a realistic YouTube Data API response for SEEDED channels (recent uploads/shorts via
  `channels.list` → `uploads` playlist → `playlistItems`, fields like `videoId` / `channelTitle` / `title` /
  `statistics`), when it runs, then it returns one contract-valid `PerceptionEvent` per video/short — each with a
  stable `eventId`, a safe `type`, sane `heatDelta`/`novelty`/`legibility`/`confidenceTier` defaults, a `source`,
  and exactly one `vantage` whose `platform: 'youtube'` + `embedUrl` is the **official embed**
  (`https://www.youtube.com/embed/<videoId>` — first-party, verbatim), `streamer` = the channel title,
  `offsetSec: 0`, a sane `lensScore`. _(TDD: the YouTube MAPPING PROOF — real Data API fields → a contract-valid
  event, deterministically, with NO network. Seeded AS A TV: the input is SEEDED channels' recent content, NOT a
  "search top-live" query (which is unreliable + quota-heavy — the navigator explicitly rejected it). The
  `heatDelta` curve — if derived from view/like statistics — is the implementer's, kept pure + clamped to `[0..1]`
  + documented.)_

#### P2#2 — Secrets-from-env: the YouTube Data API key is server-side only — `[backend]` **[TDD]**
- **[ ] [backend] The YouTube Source client reads its Data API key from `process.env` ONLY; the key is never
  accepted from the request body, never returned to the client, and never logged.** Given the YouTube client (the
  untested I/O edge, mirroring `createGeminiClient` / `createLiveTokenClient`), when it is built without the key env
  var, then it **does not call the API** (no-key → no-spend; fails to a safe empty/fallback result, NOT a crash that
  leaks); and when the key IS present, a test proves the key is **never** placed in the endpoint's HTTP response
  body and **never** logged (mirror the `/narrate` + `/live/session` route-secrets tripwires). _(TDD: **the
  load-bearing P2 invariant.** A browser-side YouTube fetch would leak the key; the fetch lives **server-side** —
  a backend endpoint the FE calls (e.g. `GET /sources/youtube`), exactly like `/narrate`. The browser receives only
  the already-mapped, public `PerceptionEvent`s — no key. Assert: env-only sourcing, no-key→no-spend,
  key-never-in-body, key-never-logged.)_

#### P2#3 — Cost-gating: YouTube Data API calls are bounded/cached, not a poll storm — `[backend]` **[TDD]**
- **[ ] [backend] The YouTube Source endpoint makes a bounded number of upstream Data API calls — one per cold
  request (or fewer, via a short TTL cache), never a per-render/timer storm.** Given the endpoint/client with the
  upstream call STUBBED + call-counted, when the FE (or N rapid requests within the cache window) asks for the
  YouTube feed, then the upstream API is hit a **bounded** number of times (e.g. exactly once per cold request,
  **zero** additional inside a short TTL the architect sets), **not** per render and **not** on a continuous poll.
  _(TDD: the call-count tripwire mirroring M3-D1's "/narrate storm" + LV1's session cost-gating. **YouTube quota is
  the real risk** — the Data API has a daily quota; cached, seeded reads keep us well under it. Brief §3/§14: Loop 1
  = wide & cheap.)_

#### P2#4 — Spoiler-safety on UNTRUSTED YouTube text — `[backend]`/`[frontend]` **[TDD]**
- **[ ] [backend]/[frontend] A YouTube-derived `PerceptionEvent` carries no outcome-bearing text on any rendered or
  narrated surface.** Given a fixture whose video `title`/`description` could contain an outcome/spoiler, when the
  YouTube Source maps it, then the produced event's rendered/narrated surfaces stay spoiler-safe: the rail still
  labels `` `${type} · ${streamer}` `` (ADR 0009), the digest/host utterance derive only from **safe fields**
  (type/streamer), and untrusted real free-text is kept **data-only** in `narrative` (never rendered — ADR 0009) OR
  set to a safe neutral value. _(TDD: YouTube titles are UNTRUSTED — a real title can name a result/spoiler. Re-prove
  spoiler-safety on the real path: banned-outcome-token assertion on a real-text fixture; the architect/PO confirm
  the safe mapping at DESIGN. Same posture as the prior "thin real heat" plan, re-pointed at YouTube.)_

#### P2#5 — Official-embeds-only: YouTube videos → first-party `youtube.com/embed`, verbatim — `[backend]`/`[frontend]` **[TDD]**
- **[ ] [backend]/[frontend] Each YouTube event's vantage `embedUrl` is the official first-party YouTube embed for
  that video, rendered verbatim.** Given the adapter mapping a real video (`videoId: "abc123"`), when it builds the
  vantage, then `platform: 'youtube'` + `embedUrl: https://www.youtube.com/embed/abc123` (first-party, **no rehost
  / no rewrite**), and the Player renders it verbatim. _(TDD: re-asserts **official-embeds-only** on the YouTube
  path — the load-bearing Rights/ToS invariant (brief §5/§13; ADR 0003 #5). Note: the ADR 0008 `parent` is
  Twitch-only; the architect confirms YouTube needs no rehost and renders verbatim. URL-shape tripwire.)_

#### P2#6 — The registry now serves Twitch + YouTube; the App fetches the YouTube Source behind a flag, mock-fallback — `[frontend]` **[TDD]**
- **[ ] [frontend] The Source registry includes the YouTube Source (via the backend endpoint) when the P2 flag is
  on, alongside the Twitch Source — and falls back so the suite/offline stay green.** Given the registry, when the
  P2 flag is **off** (test/default), then it serves only the Twitch-mock Source (the suite stays hermetic — no
  network; P1 coverage untouched); when the flag is **on** and the YouTube endpoint returns events, then the
  registry's union includes YouTube-derived events that flow through the **same** `rankFeed` → feed → host loop →
  UI (no engine change); and when the flag is on but the YouTube fetch **fails/empties**, then the registry still
  serves the Twitch Source (the channel is never empty — degrade-to-known-Source). _(TDD: extend the registry +
  `App.test.tsx` — flag-off = Twitch-only (existing behavior intact), flag-on routes YouTube-derived events through
  the UNCHANGED engine, fetch-fail → Twitch fallback. **Do NOT hit a real network** — inject/mock the YouTube
  Source. Proves a second Source is purely additive behind the P1 registry seam.)_

#### P2#7 — A real YouTube channel/short actually plays from the YouTube Source (DoD — the cross-platform experience) — `[frontend]` **[qa/visual]**
- **[ ] [qa/visual] With the P2 flag on, opening the app shows at least one genuinely-seeded YouTube video/short
  (fetched via the Data API) surfaced by the host alongside Twitch, spoiler-safe.** _(qa-only / navigator: with the
  flag on against the real Data API, open staging → confirm a real SEEDED YouTube video/short renders + plays
  (official `youtube.com/embed`), the host surfaces/narrates it spoiler-safe (no outcome named), and Based TV is now
  visibly **cross-platform** (Twitch + YouTube channels in the same surf). Confirm the YouTube key is NOT in the
  page/network the browser sees. The hermetic suite can't judge a real embed playing — pairs with the navigator's
  watch-through.)_

### PHASE 3 — news-as-default + cross-platform feeds (Asmongold-style) · NEEDS a news-channel seed

> _P3 makes NEWS the platform default (the navigator: "news is the default of the whole platform") and conquers
> **cross-platform feeds** — a person/topic aggregated across Sources (e.g. the same streamer's *news* surfaced
> from BOTH the Twitch Source and the YouTube Source as ONE feed). Built on the P1 registry + the P2 YouTube Source.
> **Needs the navigator to name the news-channel seed (or accept the PO's recommended reputable set).**_

#### P3#1 — News is the default Source/feed of Based TV — `[frontend]` **[TDD]**
- **[ ] [frontend] On load, the default channel/feed Based TV surfaces is NEWS** (the seeded news Source), not an
  arbitrary Source. Given the registry seeded with a NEWS Source (news streamers/channels on Twitch + news channels
  on YouTube — the navigator's seed) and the App, when it mounts with no explicit Source selection, then the
  default feed the host catches the user up on / surfaces first is the **news** feed (news is the platform default),
  with the existing digest + ranking applied to it. _(TDD: pins "news = the default of the whole platform." The
  default-Source selection is a registry/App concern; the engine still ranks + narrates it unchanged. The exact news
  seed is the navigator's content call — see Decisions needed; the test asserts the DEFAULT-selection behavior
  against a seeded fixture, not the specific channels.)_

#### P3#2 — A cross-platform feed aggregates one lead/topic across Sources (Asmongold-style) — `[frontend]` **[TDD]**
- **[ ] [frontend] A single feed can aggregate the SAME lead/topic across multiple Sources** — e.g. a person's
  *news* surfaced from both the Twitch Source and the YouTube Source appears as ONE cross-platform feed with
  multiple vantages, not two unrelated events. Given two Sources each producing a vantage for the same
  lead/person/topic (a Twitch live vantage + a YouTube video vantage of the same subject), when the registry/feed
  aggregates, then they collapse into **one `PerceptionEvent`** (the brief's §2 "one event, many vantages" — now
  ACROSS platforms) whose `vantages[]` carries both the Twitch and the YouTube lens, ranked by the existing
  vantage-rank (`topVantage` / `lensScore`). _(TDD: this is "conquering cross-platform feeds" — the brief's
  source-graph provenance idea (§2), realized at the SOURCE-registry layer: a cross-platform key (person/topic/
  source-ref) groups vantages from different Sources into one event. The engine then ranks event + vantage exactly
  as today. The aggregation is the new logic; the ranker/host are unchanged. Keep it deterministic against a
  fixture — no network.)_

#### P3#3 — Invariants RE-PROVEN on the cross-platform/news path — `[backend]`/`[frontend]` **[TDD]**
- **[ ] [backend]/[frontend] News + cross-platform-aggregated events satisfy the Based invariants.** Given the
  news-default feed + a cross-platform-aggregated event run through the existing surfaces, then **spoiler-safety**
  holds on UNTRUSTED NEWS text (news titles are the HIGHEST spoiler/misinformation risk — brief §4.4 tiers 2–3;
  rail stays `` `${type} · ${streamer}` ``, no raw news headline rendered/narrated; tier-aware hedging applies),
  **official-embeds-only** holds (every vantage — Twitch AND YouTube — is a first-party embed verbatim),
  **cost-gating** holds (the news/cross-platform reads are bounded/cached), **secrets-from-env** holds (any
  news-source key server-side). _(TDD: news is the riskiest content for spoilers/misinfo — re-prove spoiler-safety
  hardest here; the cross-platform event still narrates spoiler-safe. Brief §4.4 confidence tiers + §13 tier-aware
  hedging are most load-bearing on news/IRL.)_

#### P3#4 — Based TV surfaces news + a cross-platform feed on the running app (DoD — the platform experience) — `[frontend]` **[qa/visual]**
- **[ ] [qa/visual] Opening Based TV shows NEWS as the default feed, and a cross-platform feed surfaces the same
  lead from both Twitch and YouTube — spoiler-safe.** _(qa-only / navigator: open staging → confirm news is the
  default feed the host catches you up on; confirm at least one cross-platform feed where the same person/topic's
  *news* is surfaced from both a Twitch vantage and a YouTube vantage as ONE event the host can cut between; confirm
  it all narrates spoiler-safe (no news outcome named). This is the Based TV vision realized — the hermetic suite
  can't judge the live cross-platform surf.)_

### (watch-out, all phases) — IF a Source emits predictive-staging timing: `fireAtMs`(ms) ← `offsetSec`(sec) ×1000 — `[frontend]` **[TDD]** (conditional)
- **[ ] [frontend] (only if a `staging.fireAtMs` is produced) the ms←sec ×1000 conversion is proven by a test.**
  _(The off-by-1000 trap, carried from `progress.md`. Sources set `offsetSec: 0` on their vantages (one lens per
  channel; cross-platform aggregation in P3 carries each vantage's own `offsetSec` but the THIN feed doesn't emit
  predictive `staging`), so predictive staging is **not** required. **Only add this cycle if the work emits a
  `staging` field**; otherwise it's a documented landmine to avoid, not a required cycle.)_

## M5 — TDD-vs-QA SPLIT (so the team executes consistently)
- **[TDD] (the inner loop — RED→GREEN; any upstream API STUBBED):**
  - **P1 (no creds — buildable NOW):** P1#1 Source contract (FIRST — pure, the mock as a Source) · P1#2 registry
    aggregation · P1#3 App consumes the registry · P1#4 invariants re-asserted on the seam. **~4 cycles.**
  - **P2 (needs the YouTube key):** P2#1 YouTube mapping proof · P2#2 secrets-from-env · P2#3 cost-gating · P2#4
    spoiler-safety on YouTube text · P2#5 official-embeds (`youtube.com/embed`) · P2#6 registry+App flag/fallback.
    **~6 cycles.**
  - **P3 (needs the news seed):** P3#1 news-as-default · P3#2 cross-platform aggregation · P3#3 invariants on the
    news/cross-platform path. **~3 cycles.**
  - **conditional:** ms←sec ×1000 only if a `staging` field appears.
- **[qa/visual] (ACCEPT, per phase):** P2#7 (a real YouTube channel/short plays cross-platform) · P3#4 (news default
  + a cross-platform feed surfaces from both platforms, spoiler-safe). P1's accept is the engine-unchanged proof +
  the existing surf still working (qa confirms Twitch-as-a-Source surf is identical to today).

## M5 — SUGGESTED CYCLE ORDER (orchestrator — P1 first; purest/highest-value; the seam before the platforms)
**P1 — the Source seam (buildable NOW, no creds; do this phase first):**
1. **[frontend] [TDD] P1#1 — the Source contract (FIRST RED):** a `Source` produces the SAME `PerceptionEvent[]`
   the static mock holds today (the mock re-expressed as a Source — zero event change). *(Purest first RED — pure,
   deterministic, no network; gives the engine a Source producer instead of a fixture.)*
2. **[frontend] [TDD] P1#2 — registry aggregation:** N Sources → one contract-valid `PerceptionEvent[]` union,
   ids unique/namespaced; single-Source case = behavior-preserving.
3. **[frontend] [TDD] P1#3 — the App consumes the registry:** events flow from the registry (Twitch-mock Source)
   through the UNCHANGED ranker/feed/host loop/UI; the `vi.mock`'d App tests pin behavior through the seam.
4. **[frontend] [TDD] P1#4 — invariants re-asserted on the seam:** spoiler-safety / official-embeds / cost-gating /
   silence-budget hold on the new producer path (re-assertions — events + engine unchanged).
5. **CRITIC** (tdd-critic) after P1; feed items back. **→ P1 is independently shippable + accept-able here.**

**P2 — the YouTube Source (start when the navigator provisions the YouTube Data API key; architect DESIGN first):**
6. **[backend] [TDD] P2#1 — YouTube mapping proof:** fixture Data API response (SEEDED channels' recent
   videos/shorts) → contract-valid `PerceptionEvent`s with first-party `youtube.com/embed` vantages.
7. **[backend] [TDD] P2#2 — secrets-from-env:** key from `process.env` only; no-key → no-spend; never in
   body/log. *(The load-bearing P2 invariant.)*
8. **[backend] [TDD] P2#3 — cost-gating:** bounded/cached Data API calls (quota-safe); call-count tripwire.
9. **[backend]/[frontend] [TDD] P2#4 — spoiler-safety on YouTube text:** untrusted titles never rendered/narrated;
   banned-outcome-token on a real-text fixture.
10. **[backend]/[frontend] [TDD] P2#5 — official-embeds-only:** `youtube.com/embed/<videoId>` verbatim.
11. **[frontend] [TDD] P2#6 — registry+App flag/fallback:** the registry serves Twitch + YouTube behind the P2
    flag; flag-off = Twitch-only (hermetic); fetch-fail → Twitch fallback.
12. **CRITIC**; then **ACCEPT P2#7** (qa/navigator: a real seeded YouTube short plays cross-platform, spoiler-safe,
    key not browser-visible). **→ P2 is independently shippable.**

**P3 — news-default + cross-platform feeds (start when the navigator names/accepts the news seed):**
13. **[frontend] [TDD] P3#1 — news as the default feed.**
14. **[frontend] [TDD] P3#2 — cross-platform aggregation** (one lead, vantages from both Sources → one event).
15. **[backend]/[frontend] [TDD] P3#3 — invariants on the news/cross-platform path** (spoiler-safety hardest on
    news; official-embeds across both platforms; cost-gating; secrets-from-env).
16. **CRITIC**; then **ACCEPT P3#4** (qa/navigator: news default + a cross-platform feed from both platforms,
    spoiler-safe). **→ P3 completes Based TV.**
17. **(conditional)** ms←sec ×1000 only if any Source emits a `staging` field.
18. **PO sign-off** per phase vs this acceptance + the Based TV vision (the engine provably unchanged; Sources plug
    in; cross-platform feeds conquered).

## M5 — DEFINITION OF DONE (per phase — each phase is independently shippable)
**P1 (the Source seam + Twitch as a Source):**
1. **`pnpm verify` = 0** — the Source contract + registry aggregation + App-consumes-registry + invariants-on-the-
   seam; the **engine (ranker / host loop / digest / §6 contracts) UNCHANGED**; the suite stays hermetic (no
   network — the mock-as-Source is in-process).
2. **tdd-critic = PASS** on the P1 cycles.
3. **qa-verifier / navigator confirm** the Twitch-as-a-Source surf is **identical** to today's demo (the engine is
   provably unchanged — same ranked surf, same host, same digest — now sourced via the registry).
4. **PO sign-off** vs this acceptance — the Source abstraction proven end-to-end; the existing demo unchanged.

**P2 (the YouTube Source):**
1. **`pnpm verify` = 0** — the YouTube mapping proof + secrets-from-env + cost-gating + spoiler-safety + official-
   embeds + registry/App flag-fallback; the **engine UNCHANGED**; the real Data API call STUBBED (hermetic suite).
2. **tdd-critic = PASS** on the P2 cycles.
3. **qa-verifier / navigator confirm** (P2#7): flag on against the real Data API → a real seeded YouTube video/short
   renders + plays cross-platform alongside Twitch; the host surfaces it spoiler-safe; the key is not browser-visible.
4. **PO sign-off** vs this acceptance — Based TV is cross-platform (Twitch + YouTube); the engine unchanged on real
   YouTube data.
5. **Invariants RE-PROVEN on the YouTube path** — secrets-from-env (the load-bearing P2 invariant), cost-gating,
   official-embeds-only, spoiler-safety.

**P3 (news-default + cross-platform feeds):**
1. **`pnpm verify` = 0** — news-as-default + cross-platform aggregation + invariants on that path; the **engine
   UNCHANGED**; hermetic.
2. **tdd-critic = PASS** on the P3 cycles.
3. **qa-verifier / navigator confirm** (P3#4): news is the default feed; a cross-platform feed surfaces the same
   lead from Twitch + YouTube; all spoiler-safe.
4. **PO sign-off** vs this acceptance + the Based TV vision — news is the platform default; cross-platform feeds
   conquered.
5. **Invariants RE-PROVEN** — spoiler-safety hardest on untrusted news text; official-embeds across both platforms.

## M5 — BASED INVARIANTS (this feature adds NEW producer paths that feed events the host narrates → the four data-path invariants RE-PROVEN with tests on each new path — ADR 0003)
1. **Secrets-from-env — PROVEN on each real-Source path (load-bearing in P2/P3).** Any platform API credential
   (the **YouTube Data API key** in P2; any Twitch app cred if Twitch becomes a *real-fetch* Source; any news-source
   key in P3) is **server-side, env-only** — read from `process.env`, **never** in the browser/bundle, **never** in
   the endpoint's HTTP response, **never** logged. The browser receives only already-mapped **public**
   `PerceptionEvent`s (channel names, public stats, official embed URLs — no credential). A browser-side fetch would
   leak the secret, so the fetch lives **server-side** behind a backend endpoint (mirroring `/narrate`'s
   `GEMINI_API_KEY` + `/live/session`'s mint). _Proven by:_ P2#2 (and P3#3 for any news-source key). **NOTE: P1 adds
   NO credential path** (the mock-as-Source is in-process) — secrets-from-env has no new surface in P1; it becomes
   load-bearing the moment a real-fetch Source lands (P2).
2. **Cost-gating — PROVEN on each real-Source path.** Each Source endpoint/client makes **bounded** upstream calls —
   one per cold request (or fewer, via a short TTL cache), **never** a per-render/continuous-poll storm; any
   required token mint is cached/reused. **YouTube quota** makes this real in P2 (cached, seeded reads). Brief §3/§14
   (Loop 1 = wide & cheap). _Proven by:_ P2#3 (+ P3#3 for news/cross-platform reads); P1's registry-read is bounded
   (P1#4).
3. **Official-embeds-only — PROVEN on each Source path.** Every Source's vantages surface via **first-party official
   embeds**, rendered **verbatim** — Twitch `player.twitch.tv/?channel=<login>` (+ ADR 0008 `parent`), YouTube
   `www.youtube.com/embed/<videoId>` (no `parent` needed; architect confirms). **No rehost, no rewrite.** Brief
   §5/§13; ADR 0003 #5. _Proven by:_ P1#4 (Twitch), P2#5 (YouTube), P3#3 (both, cross-platform) + the existing
   Player verbatim/parent tests (unchanged).
4. **Spoiler-safety — PROVEN on each real-Source path (HARDEST on news).** Real platform text (YouTube titles, news
   headlines) is **untrusted** — it can contain an outcome/spoiler/misinformation. Every produced event, run through
   the existing rail/digest/host surfaces, names **no outcome token** (ADR 0006/0009): the rail stays
   `` `${type} · ${streamer}` ``, the host utterance derives from **safe fields**, untrusted free-text stays
   data-only in `narrative` (never rendered) or is set neutral; tier-aware hedging applies (news/IRL = tiers 2–3,
   highest risk — brief §4.4/§13). Every `HostDirective` stays compiler-enforced `spoilerSafe: true`. _Proven by:_
   P2#4 (YouTube text), P3#3 (news text — the hardest) + the unchanged rail/host-loop spoiler tests; P1#4
   re-asserts it on the seam.
5. **Silence budget — KEPT (logic unchanged).** M5 changes/adds **producers** of events, not the host loop; the
   silence-budget logic + default are **untouched** (events from any Source surface through the SAME loop, which
   still rate-limits + earns each interruption). _Carried by:_ the unchanged `host-loop.test.ts`.
6. **Contracts-as-seam — ENFORCED, additive (NEW producers, the SAME contract).** **No §6 contract shape change.**
   Every Source produces the **already-specified** `PerceptionEvent[]` the existing `createSourceGraphFeed` +
   `rankFeed` consume; the UI still consumes only `RankedFeed` + `HostDirective`. M5 adds a **Source producer
   pattern + a registry** behind the existing `PerceptionEvent` seam — it does not reshape the seam. **The ONE
   genuinely new abstraction is the `Source` producer interface + the registry (above the engine, below the App)** —
   the architect owns its shape + an ADR. _(If a Source genuinely needs a NEW `PerceptionEvent`/`Vantage` field —
   e.g. a cross-platform group key the contract can't carry, or a `ts`/freshness shape — STOP and bring in the
   architect for the contract change + an ADR. Not expected for P1/P2; P3's cross-platform grouping may want a
   grouping key — the architect decides whether it's derived (no contract change) or a new field.)_

## M5 — ARCHITECT-NEEDED VERDICT: **YES — architect DESIGN + an ADR are REQUIRED (a new §6 PRODUCER pattern — the Source seam). Designing in parallel; an ADR is coming.**
- **Verdict: M5 introduces a NEW abstraction (the `Source` producer + the registry) and, in P2/P3, new external data
  sources crossing the backend↔frontend boundary → it MUST go through the architect** (per CLAUDE.md outer-loop step
  2: architect when "the feature adds/changes a contract or crosses a layer" / a new seam). The Source seam is a new
  **§6 producer pattern** — the architect owns it.
- **What the architect must DESIGN + record (the open seam questions):**
  1. **The `Source` producer interface (P1, blocks the first RED's exact shape).** Sync vs async; `channels()` /
     `feed()` return shape; how a Source identifies itself (`id`); how it namespaces event ids so two Sources can't
     collide. STRONG default: a minimal `Source` returning `PerceptionEvent[]` (or `Promise<PerceptionEvent[]>` once
     a real fetch lands), with the existing mock as the first implementation.
  2. **The Source registry (P1).** How Sources aggregate into one stream the engine consumes (`allChannels()` /
     union); deterministic ordering (the ranker re-sorts); id-collision safety.
  3. **Where real-Source fetches live — backend endpoint vs FE (P2/P3).** STRONG default: a **backend endpoint per
     real Source** (e.g. `GET /sources/youtube`) the FE calls, mirroring `/narrate` — the credential MUST stay
     server-side. The browser never fetches the platform directly.
  4. **Auth / key flow (P2 — YouTube).** The YouTube Data API key → `Authorization`/`key=` server-side; where it's
     read (env-only) + how the long-lived key stays server-side (re-prove secrets-from-env).
  5. **Caching (P2/P3).** A short TTL cache per Source so repeated FE loads don't storm the API (YouTube quota).
  6. **Spoiler-safety of untrusted real text (P2/P3).** The safe-field mapping (real text → data-only `narrative`
     never rendered, or neutral; on-screen/spoken from safe `type`/`streamer`) — hardest on news.
  7. **The flag + fallback topology (P2/P3).** How each real Source is flagged on/off and how the registry falls
     back to the Twitch-mock Source so the suite stays hermetic + a no-network demo works.
  8. **Cross-platform grouping (P3).** Whether grouping one lead/topic across Sources is **derived** (a key computed
     from `source.ref`/person/topic — no contract change) or needs a NEW contract field (the STOP condition).
- **The STOP condition (when the architect must also do a CONTRACT change):** if a Source genuinely needs a **new
  `PerceptionEvent`/`Vantage` field** the current §6 contract can't carry (not expected for P1/P2; possibly a P3
  cross-platform group key), the architect extends the contract + records it. The default is the **existing**
  contract, new producers behind it.

## M5 — DECISIONS TO SURFACE TO THE NAVIGATOR (§13: rights / API / secrets / content — in `backlog.md` → Decisions needed)
**Two navigator calls (the team cannot pick the source-creds or the news seed for them). The PO frames each with a
recommended default.**

1. **⛔ The YouTube Data API key (P2 — BLOCKING the P2 BUILD; P1 needs nothing).** P2 (the YouTube Source) fetches
   SEEDED YouTube channels' recent videos/shorts via the **YouTube Data API v3** (`channels.list` → uploads playlist
   → `playlistItems` — NOT the unreliable/quota-heavy "search top-live"). **Needs the navigator to provision a
   YouTube Data API key** (created free in the Google Cloud console; enable "YouTube Data API v3"), stored EXACTLY
   like `GEMINI_API_KEY` — `backend/.env` (gitignored) + an SSM SecureString for staging — **never** in the client
   bundle. The backend reads it from env + calls the Data API server-side; the browser gets only mapped public
   events. **This is the navigator's (a §13 rights/API call requiring a provisioned secret) and is BLOCKING for P2 —
   but P1 (the Source seam + Twitch-as-a-Source) is fully buildable NOW with no creds, and the architect DESIGN can
   proceed in parallel.** _Recommended default to unblock P2 fast: provision the YouTube Data API key._

2. **The news-channel seed (P3 — needed before the P3 BUILD; recommend or name).** P3 makes NEWS the platform
   default + aggregates it cross-platform. It needs a **seed of reputable cross-platform news channels** — a few
   news streamers/channels live on Twitch + news channels on YouTube. **PO RECOMMENDATION:** seed a small set of
   reputable, embeddable news sources spanning both platforms — e.g. a couple of established news/24-7-news YouTube
   channels (official-embed-clean) + one or two news-oriented Twitch channels — chosen for being **reliably live /
   recently active**, **official-embed-compliant** (Rights/ToS — official embeds only), and **reputable** (news =
   highest misinformation/spoiler risk, brief §4.4/§14). **OR the navigator names the specific channels.** _(The
   exact channels are a content/curation call; the P3 tests assert the DEFAULT-selection + cross-platform-grouping
   BEHAVIOR against a seeded fixture, not the specific channels — so the seed can be finalized at P3 build/demo time
   without reshaping the seam.)_ _Recommended default: PO seeds a reputable cross-platform news set; navigator
   confirms or substitutes._

## M5 — CONSTRAINTS / NON-GOALS
- **THE ENGINE IS UNCHANGED — this is the Source/channel/feed layer beneath it.** Do **NOT** change
  `frontend/src/contracts/` shapes, `lib/ranker.ts` (M4), `lib/source-graph-feed.ts`, `host-loop.ts` /
  `narrating-host-loop.ts`, or the live-voice/`/narrate` transport. M5 adds a `Source` producer + a registry +
  (P2/P3) backend Source endpoints + App wiring **above** the unchanged contracts/ranker/loop. Every Source's events
  flow through the SAME `rankFeed` → feed → loop → UI.
- **"We are NOT replacing what we built."** The existing mock stays a valid Source (the Twitch-mock Source), the
  fallback, and the hermetic-suite/no-network demo path. The ranking + host commentary + digest are reused, not
  rebuilt.
- **PHASED — each phase independently shippable; P1 first (no creds).** P1 (the seam + Twitch-as-a-Source) is
  buildable NOW. P2 (YouTube) gates on the YouTube key. P3 (news + cross-platform) gates on the news seed + builds
  on P1/P2. Do not let P2/P3 scope block P1 from shipping.
- **YouTube is seeded AS A TV, NOT "top live now."** Use the Data API on SEEDED channels (channels/feeds/shorts/
  follow-leads). The navigator explicitly rejected the unreliable "search top-live" query — don't use it.
- **Secrets-from-env is load-bearing the moment a real-fetch Source lands (P2).** The browser never holds the
  YouTube key (or any platform secret). The fetch is server-side behind a backend endpoint; the browser gets only
  public mapped events.
- **Spoiler-safety on UNTRUSTED real/news text — hardest on news.** Real titles/headlines can say anything — never
  let untrusted real free-text reach a rendered/narrated surface. Keep it data-only (`narrative`, never rendered) or
  neutral; on-screen/spoken from safe `type`/`streamer`. News = highest spoiler/misinformation risk (tier-aware
  hedging, brief §4.4/§13).
- **Official-embeds-only across ALL Sources.** Twitch → `player.twitch.tv` (+ ADR 0008 `parent`); YouTube →
  `www.youtube.com/embed` verbatim. No rehost on any Source.
- **The suite stays hermetic — Sources' real HTTP is the untested I/O edge → STUBBED.** Tests assert on the Source
  contract / mapping / secrets / cost-gating / registry / fallback / spoiler-safety, **never** on live API data. P1
  is fully in-process (mock-as-Source). No test hits a real network/API.
- **Predictive staging is NOT required.** Sources set `offsetSec: 0` on vantages (one lens per channel; P3
  cross-platform vantages each carry their own `offsetSec` but no predictive `staging` is emitted). Only touch
  `staging.fireAtMs` if the work happens to emit it — then convert ms←sec ×1000 explicitly + test it.
- **OUT of scope for M5 (deferred — named so they aren't lost):**
  - **Real event/clip detection, source-graph clustering from live video, multimodal understanding, ML heat** — the
    brief's §15 deferred real-perception work; **M6+**. (P3's cross-platform aggregation is a SEEDED/keyed grouping,
    NOT live perceptual clustering.)
  - **TikTok / Kick real Sources** — M5 lands Twitch (Source) + YouTube (real fetch) + news. Kick/TikTok Sources are
    later (the `Source` seam makes them additive — that's the point).
  - **A true rate-of-change `heatDelta`** — any real `heatDelta` (P2 from YouTube stats) is a crude proxy; a real
    delta (view velocity, chat rate) is a later refinement.
  - **LV1-D2** (the ~10–12s per-line live-voice wake latency) — carried polish, not M5's target.
- **Decision posture:** M5 carries **two navigator calls** — (1) the **YouTube Data API key** (P2, BLOCKING P2 only)
  and (2) the **news-channel seed** (P3, recommend-or-name). **P1 is unblocked NOW.** It rides on the settled
  defaults (persona = one host; voice = accepted Gemini Live; rights/ToS = official embeds only — now **extended to
  YouTube + news platforms' ToS**). The `Source` interface shape, the cache TTL, the heat normalization, and the
  per-Source channel counts are **tuning/design** (architect/implementer/navigator adjust), not blockers for P1.

## M5 — MILESTONE CHECKLIST
- [x] M0a — TDD harness bootstrapped + verified
- [x] M0b — contracts + event bus + mock source-graph feed  *(frontend)*  · critic PASS
- [x] M1  — channel-surf shell: player + rail, manual surf, official embeds only  *(frontend)*  · PO-accepted
- [x] M2  — character silent↔active + TTS + cut + client host loop  *(frontend)*  · PO-accepted
- [x] M3  — real Gemini narration: `/narrate` proxy + FE swap  *(backend → frontend)*  · PO-accepted · DoD #4
- [x] LV1 — live-voice host: `gemini-3.1-flash-live-preview`, browser-direct (ADR 0007 Amendment C)  *(backend → frontend)*  · ✅ accepted + shipped
- [x] WDC — "Watchable demo cut": real Twitch streams + Start-watching gesture + product look + graceful embeds  *(frontend)*  · ✅ navigator-accepted on staging
- [x] WDC-D2 — demo pacing: 7-event graph + 12s silence budget (livelier cadence)  *(frontend)*  · ✅ accepted
- [x] M4  — two-level ranking + "while you were gone" digest (brief DoD #1 — the LAST brief DoD)  *(frontend)*  · ✅ build-accepted + deployed + tagged `m4`
- [ ] **M5 — Based TV — cross-platform Source abstraction  ← RE-SCOPED, IN FLIGHT** *(KICKOFF written; architect designing the Source seam in parallel + an ADR is coming)*
  - [ ] **P1 — the Source seam + Twitch as a Source** *(frontend)* — **buildable NOW (no creds); ← the IN-FLIGHT phase; first RED = P1#1 the Source contract.** Start the inner loop once the architect confirms the `Source` interface shape.
  - [ ] **P2 — the YouTube Source (channels/feeds/shorts via the Data API)** *(backend → frontend)* — ⛔ gated on the navigator provisioning the **YouTube Data API key** + the architect's Source-endpoint design.
  - [ ] **P3 — news-as-default + cross-platform feeds (Asmongold-style)** *(frontend)* — gated on the **news-channel seed** + built on P1/P2.
- [ ] E2E — one DoD journey  *(playwright)*  · deferred (queued follow-up)

---

# Design notes — prior KICKOFFs (condensed to historical pointers)

**M5 "thin real heat" (SUPERSEDED by this re-scope).** The prior M5 KICKOFF framed M5 as a single Twitch Helix
`GET /streams` adapter mapping viewer counts → `heatDelta` for one real event. The navigator's "Based TV" vision
**re-scopes** that into the multi-Source abstraction above: the single-adapter mapping work **survives, re-homed as
P2** (re-pointed from Twitch-Helix-top-live to the **YouTube Source seeded AS A TV** — the navigator explicitly
chose YouTube-as-a-TV over "top live now"), and the NEW core is **P1 (the Source seam itself)**. The prior plan's
invariant proofs (secrets-from-env, cost-gating, spoiler-safety on untrusted real text, official-embeds-only) carry
forward onto the P2 YouTube path. The blocking §13 "DATA SOURCE + creds" decision is **superseded** by the two
new calls (the YouTube Data API key for P2; the news seed for P3) — see Decisions needed.

**M4 (SHIPPED + ACCEPTED).** The full M4 KICKOFF (two-level ranking — a real `eventScore` ranker blending
heatDelta/novelty/legibility/confidenceTier, replacing the M1 placeholder — + the "while you were gone" digest in
the host's voice on load, brief §12 DoD #1) is **shipped, build-accepted, committed (`c699a1e`), pushed, tagged
`m4`, and deployed.** With it the prototype is **feature-complete against the brief's §12 DoD**. M4's full accept
record lives in `.claude/state/backlog.md` under the M4 entry. **Key carry-forwards relevant to M5:** the App tests
are decoupled from the demo mock via `vi.mock` (`frontend/tests/App.test.tsx`) so M5 can extend that fixture for the
registry + Source-flag + fallback cases; the real two-level ranker (`lib/ranker.ts`) + the in-time feed
(`lib/source-graph-feed.ts`) + the host loop + the §6 `PerceptionEvent`/`RankedFeed`/`HostDirective` contracts are
the **unchanged engine** M5's Sources produce events INTO; the secrets-from-env template a real Source mirrors is
`backend/src/modules/narrate/` (the injectable `GeminiClient` reading `GEMINI_API_KEY` from `process.env` only,
behind a Fastify route in `app.ts`) + LV1's mint-once posture (`backend/src/modules/live/`).
