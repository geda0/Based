# 0010 — "Based TV": the Source abstraction (a producer layer beneath §6)

## Status
Accepted (prototype phase). Extends ADR 0003 (boundaries + invariants) and the §6
seam (ADR 0004); supersedes the **single-Twitch-source** framing of M5 in
`design-notes.md`/`backlog.md` (M5 is re-scoped as the first phase of Based TV — see
"Relation to the prior M5"). Append-only. **Does NOT change the §6 types in
`frontend/src/contracts/`** — Based TV adds a new **producer layer** *beneath* the
existing `PerceptionEvent` contract; `PerceptionEvent → RankedFeed → HostDirective`
are unchanged.

## Context
The navigator reframed M5 from "thin real heat" (one Twitch feed) into **"Based TV"**
— a nimble, cross-platform, events-based TV: multiple **sources** (platforms) →
channels/feeds → the **existing** pipeline (`PerceptionEvent → RankedFeed →
HostDirective`, the M4 ranker + host loop + digest), **unchanged**. Explicitly:
> "we are NOT replacing what we built" — the engine stays; sources are a new
> **producer** layer beneath the existing `PerceptionEvent` contract.

Concrete asks:
- **Sources:** Twitch (live streams — what we built), YouTube (channels/feeds/
  shorts/follow-leads — **seeded**, fetched via the Data API, **not** "search
  top-live"). **Default = news.**
- **Cross-platform feeds:** a topic/person (e.g. Asmongold) aggregated across
  sources — a "lead" that spans platforms but still emits plain `PerceptionEvent`s.
- **Nimble:** adding a source must be additive — register an adapter, nothing
  downstream changes.

This is a seam decision: it introduces N external producers crossing the BE↔FE
boundary, each with its own creds, fetch shape, and signal mapping. The risk the
architect guards against is **producer detail leaking upward** — platform field
names, raw API payloads, untrusted free-text, or per-source coupling reaching the
ranker, the host loop, or the UI. The contract already absorbs all of it: every
source's only job is to **emit `PerceptionEvent[]`**. Nothing above the seam learns
that a second (or third) platform exists.

Two existing patterns are the template (this ADR reuses, doesn't reinvent):
- **`/narrate`** (ADR 0006) — a backend endpoint the FE calls; the long-lived key
  (`GEMINI_API_KEY`) is read from `process.env` only, validated with a backend-local
  zod schema, never on the wire, never logged. The Source endpoints mirror this.
- **The live mint** (`createLiveTokenClient`, ADR 0007) — a long-lived secret minting
  a short-lived, **cached/reused** token. The Twitch app-access-token mirrors this
  mint-once posture exactly.

## Decision

### 1. A new producer layer, NOT a contract change
Based TV is built **entirely beneath** the §6 `PerceptionEvent` seam. A **Source** is
a platform adapter whose sole output is `PerceptionEvent[]`. A **SourceRegistry**
merges N sources into one event stream that feeds the **existing** `rankFeed` →
`createSourceGraphFeed` → host loop → digest → UI, all unchanged. **No `PerceptionEvent`,
`Vantage`, `RankedFeed`, or `HostDirective` field is added or changed.** (Confirmed
field-by-field in "Why `PerceptionEvent` does not change" below.)

This keeps **contracts-as-seam** (ADR 0003 #3) intact and makes it *structurally*
impossible for a source to widen the seam: the registry's output type is
`PerceptionEvent[]`, so anything platform-specific a source knows is erased at the
boundary by the type itself.

### 2. The `Source` interface
A Source is a small async producer. It declares the channels/feeds it covers and,
when polled, returns contract-valid `PerceptionEvent`s for them. The interface lives
**backend-side** (the fetch is server-side — see §5); it is a backend-local type, not
a §6 contract type, and it is NOT imported by the FE (no cross-workspace runtime
coupling — ADR 0003).

```ts
// backend/src/modules/sources/source.ts  (a backend-local type, NOT a §6 contract)
//
// A platform adapter that PRODUCES PerceptionEvents. The ONLY thing a Source emits
// upward is PerceptionEvent[] — the existing §6 contract. Everything platform-
// specific (API field names, creds, raw payloads) stays inside the adapter.
export interface Source {
  /** Stable id of the platform adapter, e.g. 'twitch' | 'youtube'. */
  readonly id: string;

  /**
   * Fetch the current PerceptionEvents this source can see across the channels/
   * feeds it covers. Pull-based (the registry calls it); a Source MAY internally
   * cache/poll, but the registry-facing contract is "ask → get current events."
   * MUST resolve to a (possibly empty) PerceptionEvent[]; MUST NOT throw on an
   * upstream/credential failure — it degrades to [] (failure-silent; the channel
   * is never empty because OTHER sources + the mock fallback fill it).
   */
  fetch(): Promise<PerceptionEvent[]>;
}
```

- **How a Source declares its channels/feeds — internal, seeded.** A Source is
  constructed with its **seed** (the channels/feeds/topics it covers) and its
  creds-from-env. The seed is *not* part of the registry-facing interface — the
  registry only sees `fetch()`. This is what makes "default = news" and "seeded
  YouTube channels" a per-source construction concern, not a contract concern (§4).
- **`fetch()` over `poll()`** — pull-based, single method. The registry (or a thin
  scheduler) decides cadence; the Source owns its own internal cache/TTL. A
  push/`poll(callback)` variant was rejected: it would invert control, complicate
  cost-gating (the registry could no longer bound calls), and duplicate the
  `createSourceGraphFeed` scheduler that already times event emission. Keep the
  Source a **provider of current events**, not a scheduler.
- **Failure-silent is part of the contract.** `fetch()` resolves to `[]` on any
  upstream/credential error and never throws. This is the multi-source analogue of
  the host loop's "degrade to silent" and `/narrate`'s failure-silent: one dead
  source must never take down the feed. The registry depends on this.

### 3. The signal mapping — each platform → `eventScore`'s inputs
`eventScore` (the M4 ranker) blends `heatDelta / novelty / legibility /
confidenceTier` (ADR `ranker.ts`). Each Source maps its platform's reality onto
these **shared** signals so the existing ranker ranks cross-platform events
**uniformly** (this is the whole point — the ranker never branches per platform):

| §6 signal | What a Source must produce | Twitch (live) | YouTube (seeded Data API) |
|---|---|---|---|
| `heatDelta` 0..1 | a heat proxy, monotonic, clamped | `viewer_count` → normalized (log-scale/clamp) — the brief's named crude proxy (§9 M5) | recency × view-velocity of a seeded channel's latest upload/short (Data API stats); clamped |
| `novelty` 0..1 | "is this new?" | sane default / freshness of the stream | high for a just-published upload/short, decaying with age |
| `legibility` 0..1 | "can we describe it in a line?" | sane default | title/category present → higher; bare → lower |
| `confidenceTier` 1..4 | source-of-truth tier (§4.4) | live restream vantage → tier 2–3 | a channel's own upload (original) → tier 1; an aggregated cross-source lead → tier 2–3 |
| `source.kind` | `'video'\|'broadcast'\|'realworld'\|'original'` | `'broadcast'` / `'original'` | `'video'` (a published video) / `'original'` |
| `vantages[].platform` + `embedUrl` | the official embed | `twitch` + `player.twitch.tv/?channel=<login>` | `youtube` + `youtube.com/embed/<videoId>` |

The **exact curves are tuning** (implementer's choice to satisfy the property tests),
**not seam decisions** — the seam only requires: every produced signal is in range,
`heatDelta` is monotonic in the platform's heat proxy, and the official embed shape
is correct. The mapping table is the contract expectation; the math is free.

### 4. Multi-source aggregation — the registry
A `SourceRegistry` holds N sources and merges them into one `PerceptionEvent[]` the
existing pipeline consumes:

```ts
// backend/src/modules/sources/source-registry.ts  (backend-local)
export interface SourceRegistry {
  /** Fetch + merge events from every registered source into one stream. */
  fetchAll(): Promise<PerceptionEvent[]>;
}

export function createSourceRegistry(sources: Source[]): SourceRegistry {
  return {
    async fetchAll() {
      // Each source is failure-silent (resolves to []), so one dead source can't
      // sink the merge. Promise.all over fetch() bounds upstream calls (cost-gating
      // §6): N sources → at most N cold upstream round-trips per cold fetchAll,
      // each source's own TTL cache absorbing repeats.
      const batches = await Promise.all(sources.map((s) => s.fetch()));
      return batches.flat();
    },
  };
}
```

- **Adding a source is additive** (the nimble requirement): construct the adapter,
  pass it in the `sources[]` array at registration. Nothing in the registry, the
  ranker, the host loop, the digest, or the UI changes. The registry is the single
  fan-in point; the §6 contract is the single fan-out type.
- **The registry merges; the ranker ranks; the feed times.** Responsibilities stay
  separated: `fetchAll()` produces the merged event set → `rankFeed()` (M4,
  unchanged) orders it → `createSourceGraphFeed()` (unchanged) times emission onto
  the bus → host loop → UI. The registry does **no** ranking and **no** scheduling.

### 5. Topology — where the fetch lives
**Server-side, behind a backend endpoint the FE calls** — the same shape as
`/narrate`. The FE never holds a platform credential and never calls a platform API
directly.

- **The endpoint:** a backend route (recommended `GET /sources/events`) that calls
  `registry.fetchAll()` and returns the merged `PerceptionEvent[]` as JSON. The FE
  fetches this once on load (Based TV is pull-on-load like the current mock graph; a
  slow refresh interval is a later option, never a tight poll). The browser receives
  only **public, already-mapped** `PerceptionEvent`s (public channel names, viewer
  counts, official embed URLs) — **no credential ever reaches the browser**.
- **Creds from env, per source.** Each Source reads its own secret from
  `process.env` only (Twitch: `TWITCH_CLIENT_ID` + `TWITCH_CLIENT_SECRET`; YouTube:
  `YOUTUBE_API_KEY`), exactly like `GEMINI_API_KEY`. Documented (empty) in
  `.env.example`; delivered via SSM SecureString on staging. A source with no
  creds → `fetch()` resolves `[]` (no-cred → no-spend, no crash).
- **Caching for cost-gating.** Each Source owns a **short TTL cache** of its last
  result so repeated FE loads / the registry's repeats inside the window do **not**
  storm the upstream API. Any minted app-token (Twitch) is **cached/reused** across
  fetches (mint-once, mirroring `createLiveTokenClient`), never re-minted per call.
  The registry bounds calls to N-sources-per-cold-fetch; the per-source TTL bounds
  the rest. (TTL values are tuning.)
- **The flag + mock-fallback (keeps the suite hermetic + offline working).** Based TV
  is gated behind a flag (e.g. `VITE_SOURCES=1` on the FE / the App choosing the real
  feed). **Flag off (default, and every test):** the App uses the **existing mock
  `events`** exactly as today — the hermetic suite never hits a network, the real
  platform HTTP calls are the **untested I/O edge** (STUBBED in tests, like
  `gemini-client`'s `fetch`). **Flag on but the endpoint fails/empties:** the App
  **falls back to the mock** (the channel is never empty). The mock is therefore both
  the offline demo path and the test fixture; the real sources are additive above it.

### 6. News-default + cross-platform feeds (the model)
- **"News" is the default seed.** It is a **seed**, not a new contract field or a new
  source kind. Concretely: the registry is constructed with a default seed set whose
  topic is news (e.g. a seeded news YouTube channel / a news-tagged Twitch query),
  so an unconfigured Based TV opens on news rather than empty. This lives entirely
  inside source **construction** (§2's "seed") — the produced events are plain
  `PerceptionEvent`s; nothing downstream knows "news" is special.
- **A FEED = a topic/person that spans sources (the lead/aggregation concept).** A
  cross-platform feed (e.g. "Asmongold across Twitch + YouTube") is modeled as a
  **seed shared by multiple sources**, OR a thin aggregating source that fans the
  topic out to several platform adapters and merges their results. Either way the
  output is **plain `PerceptionEvent[]`** — the "feed" is an *input grouping*
  (which channels/topics each source watches), never a new output type. The §4.4
  source-of-truth tier expresses the lead's confidence (an aggregated cross-source
  consensus → tier 2–3; a single original channel → tier 1). **The contract does not
  grow to represent feeds** — they are a producer-side seed concept that resolves to
  the existing event shape. (If a future need genuinely requires grouping metadata on
  the *output* — e.g. the UI wants to show "this event appears on 3 platforms" — that
  is a deliberate, separate contract change + ADR; it is **not** in Based TV's P1–P3
  and is **not** assumed here. Resist the speculative field.)

### Why `PerceptionEvent` does not change (field-by-field confirmation)
The flag the navigator raised — "flag any place this forces a `PerceptionEvent`
contract change (it shouldn't)" — checks out:
- `eventId` — a Source mints a stable id (e.g. `twitch:<login>` / `youtube:<videoId>`).
- `type` — a Source picks a safe enum member (a live stream with no classifier →
  `'other'`; never derived from untrusted free-text). Already sufficient.
- `narrative` — outcome-bearing **data-only** field, **never rendered** (ADR 0009).
  Untrusted real free-text (a stream title) either stays here (never shown) or is
  replaced with a neutral value; on-screen/spoken surfaces use safe fields. No new
  field needed for spoiler-safety — the existing rule already covers it.
- `heatDelta / novelty / legibility` — the Source maps its platform onto these
  (§3). All already 0..1.
- `confidenceTier` — the Source picks 1..4 by §4.4. Already sufficient.
- `source.kind / ref` — already a union covering `video|broadcast|realworld|original`
  + a free `ref`. Every platform fits; `ref` carries any provenance string.
- `vantages[]` — `Vantage.platform` is already `'twitch'|'youtube'|'kick'|'tiktok'`
  (covers Twitch + YouTube); `embedUrl` carries the official embed verbatim;
  `streamer` credits the channel; `offsetSec`/`lensScore` already present.
- `ts` — "ms offset from feed start" (ADR 0004). A Source assigns offsets for
  scheduling exactly as the mock does. No timestamp-shape change.

Every Based TV need maps onto an existing field. **`frontend/src/contracts/` is
untouched.** If — against expectation — a concrete source needs a field the contract
cannot carry, that is a **STOP**: bring it back to the architect for a contract change
+ a new ADR. The default is the existing contract, new producers behind it.

### Sketches (NOT implemented here — the implementer codes these against the seam)
- **`TwitchSource`** — reads `TWITCH_CLIENT_ID`/`TWITCH_CLIENT_SECRET` from env →
  mints + **caches** an app-access-token (OAuth client-credentials, mirroring
  `createLiveTokenClient`) → `GET https://api.twitch.tv/helix/streams?first=N` with
  `Client-Id` + `Authorization: Bearer` → maps each stream to a `PerceptionEvent`
  (one vantage: `twitch` + `player.twitch.tv/?channel=<user_login>`, the Player
  appends `parent` per ADR 0008; `viewer_count` → `heatDelta`; `user_name` →
  `streamer`; title → data-only `narrative` or a neutral value). This is the **P1
  refactor target**: the current mock becomes one Source among many.
- **`YouTubeSource`** — reads `YOUTUBE_API_KEY` from env → for each **seeded**
  channel, Data API `channels.list` → uploads playlist → `playlistItems.list` (recent
  videos/shorts) → maps each to a `PerceptionEvent` (one vantage: `youtube` +
  `https://www.youtube.com/embed/<videoId>`; stats → heat/novelty; published-at →
  novelty/`ts`; title → data-only `narrative` or neutral). **Seeded, not search-
  top-live** (the navigator's explicit constraint) — the channels are the seed.
- **Official embeds (unchanged):** Twitch `player.twitch.tv/?channel=<login>` + the
  ADR 0008 runtime `parent`; YouTube `https://www.youtube.com/embed/<videoId>`. The
  Player renders `embedUrl` verbatim (ADR 0003 #5 / 0008) — no rehost, no rewrite.

## How the seam upholds the invariants (re-asserted on the new producer path)
Structure first, so violating an invariant is hard; the implementer then proves each
with a test on each new source path (ADR 0003 — any path emitting a `HostDirective`/
narration re-proves them):
- **Contracts-as-seam (ADR 0003 #3) — ENFORCED, additive.** The registry's output
  type is `PerceptionEvent[]`; a source *cannot* emit anything else. No §6 shape
  change. The UI still consumes only `RankedFeed` + `HostDirective`.
- **Secrets-from-env (ADR 0003 #6).** Every source reads its secret from
  `process.env` only; the fetch + any token-mint are **server-side**; the browser
  receives only public mapped events. No secret is a request field, in a response
  body, or logged (mirror the `/narrate` + `/live/session` route-secrets tripwires).
  No-cred → `fetch()` → `[]` (no-spend, no crash).
- **Cost-gating (ADR 0003 #4).** Per-source **TTL cache** + cached app-token + the
  registry bounding calls to N-per-cold-fetch + FE fetch-on-load (not a tight poll) →
  bounded upstream reads, never a firehose (brief §3/§14: Loop 1 is "wide & cheap").
- **Official-embeds-only (ADR 0003 #5 / 0008).** Each source builds a **first-party**
  `embedUrl` (Twitch `player.twitch.tv`, YouTube `youtube.com/embed`); the Player
  renders it verbatim + the ADR 0008 `parent`. No rehost/rewrite. A tripwire asserts
  the constructed URL is the first-party host for the channel.
- **Spoiler-safety (ADR 0003 #1 / 0009).** Real source data is **untrusted** (a title
  can name an outcome). Untrusted free-text **never reaches a rendered/narrated
  surface**: it stays data-only in `narrative` (never rendered — ADR 0009) or is set
  neutral; the rail stays `` `${type} · ${streamer}` ``; the digest/host utterance
  derive from safe fields only; every `HostDirective` stays compile-time
  `spoilerSafe: true` (ADR 0004). Banned-outcome-token assertion on a real-text
  fixture per source.
- **Silence budget (ADR 0003 #2) — KEPT, logic unchanged.** Based TV changes the
  **producer** of events, not the host loop; the loop still rate-limits and earns each
  interruption. More/different sources surface *different* events, not more-frequent
  speaking.

## Phasing (the build starts on P1)
- **P1 — the Source abstraction + Twitch-as-a-Source.** Introduce the `Source`
  interface + `SourceRegistry` (+ the `GET /sources/events` endpoint and the FE
  source-client + the flag/mock-fallback wiring). **Refactor the existing mock /
  current Twitch live work into a `TwitchSource`** — **no new creds beyond what M5
  already needs** (or a `MockSource` wrapping the existing `events` as the canonical
  fallback). The seam is proven end-to-end with **one** real producer; the registry
  is exercised with one (or one real + the mock). This is where the contract-stability
  claim is locked: the existing pipeline consumes the registry's output unchanged.
- **P2 — the YouTube Source.** Add `YouTubeSource` (seeded channels, Data API,
  `YOUTUBE_API_KEY` from env). **Purely additive** — register it in the `sources[]`
  array; nothing downstream changes. Re-prove the four data-path invariants on the
  YouTube path (its own secret, its own TTL cache, its own official embed, its own
  untrusted-text spoiler-safety).
- **P3 — news-default + cross-platform feeds.** Wire the default **news** seed and the
  **cross-platform feed** (topic/person across sources) as seed/aggregation concepts
  (§6) — still emitting plain `PerceptionEvent[]`, still no contract change.

Each phase is independently demoable and additive; P2/P3 never reshape P1's seam.

## Consequences
- The implementer has a fixed target: a backend `Source` interface + `SourceRegistry`
  + a `GET /sources/events` endpoint (mirroring `/narrate`'s injectable-client +
  zod-validated + secret-from-env shape) + an FE source-client behind the flag with
  mock-fallback. Each concrete source is an additive adapter.
- **`frontend/src/contracts/` is unchanged** — Based TV is a producer layer, not a
  contract revision. The "no §6 change" claim is the load-bearing structural
  guarantee; the registry's `PerceptionEvent[]` output type enforces it.
- The two-restatements cost (the FE source-client shape vs the backend response)
  stays the accepted no-cross-workspace-coupling cost (ADR 0003), same as `/narrate`.
- Adding platforms is O(1) work above the seam: a new adapter + its env secret + its
  invariant tests. The ranker/host loop/digest/UI never change again for "another
  platform."
- `news` and `feeds` are **seed/input concepts**, not output types — the contract
  does not learn about them, so they can evolve as product decisions without a seam
  change. (Output-side grouping metadata, if ever needed, is a separate future ADR.)

## Relation to the prior M5 ("thin real heat")
The prior `design-notes.md`/`backlog.md` M5 scoped a **single** Twitch `GET
/live-streams` endpoint + a single `mapLiveStreamsToEvents` adapter. Based TV
**generalizes that into the Source abstraction**: that single adapter becomes the P1
`TwitchSource`, the single endpoint becomes `GET /sources/events` over a registry, and
the same invariants (secrets-from-env, cost-gating, official-embeds-only, spoiler-
safety) are re-proven per source instead of once. The PO re-scopes M5's acceptance
bullets onto the Source seam (the SHAPE of those bullets — mapping proof, heat-signal
property, secrets/cost/spoiler/embeds guards, flag+fallback integration — is
source-agnostic and carries directly; the architect re-points the endpoint/types at
the registry). The **navigator's data-source + creds §13 decision still gates BUILD**
(Twitch creds for P1; YouTube key for P2).

## Alternatives considered
- **Amend `PerceptionEvent` to carry source/feed/platform-grouping metadata.**
  Speculative contract growth for fields nothing above the seam consumes; widens the
  surface that must be proven spoiler-safe/secret-free; breaks the "engine unchanged"
  promise. Rejected — sources erase platform detail at the boundary; the existing
  fields already carry everything (field-by-field above).
- **A push/`poll(callback)` Source interface.** Inverts control, makes cost-gating
  the registry can no longer bound, and duplicates `createSourceGraphFeed`'s
  scheduling. Rejected — Sources are pull-based providers of *current* events; the
  existing feed times emission.
- **Fetch on the FE per platform (client-side adapters).** Puts every platform
  credential in the browser bundle — an immediate secrets-from-env violation (the
  reason `/narrate` and the live mint are server-side). Rejected — all fetch +
  token-mint is server-side behind the endpoint; the browser gets only public mapped
  events.
- **One God-source / per-platform branching in the ranker or host loop.** Couples the
  engine to the set of platforms, defeats "nimble / additive," and leaks producer
  detail upward. Rejected — N independent adapters behind a registry; the engine
  stays platform-agnostic because its input type is `PerceptionEvent[]`.
- **YouTube via "search top-live."** The navigator's explicit constraint is **seeded**
  channels via the Data API (`channels.list`/`playlistItems`), not a live-search.
  Rejected as out of scope by direction (also heavier quota); the seed model (§6)
  carries the YouTube case.
