import { describe, it, expect, afterEach } from "vitest";
import {
  mapYouTubeVideosToEvents,
  createYouTubeSource,
  type YouTubeVideo,
} from "../../src/modules/sources/youtube-source.js";

// M5-P2 c1 — the YouTube Source MAPPING (ADR 0010 §3 + the YouTubeSource sketch).
//
// Based TV adds backend Source adapters that PRODUCE PerceptionEvents into the
// UNCHANGED §6 pipeline. This is the PURE mapping proof only: given NORMALIZED
// YouTube videos (the adapter has already extracted these from the Data API),
// the mapper deterministically produces contract-valid PerceptionEvents with the
// official YouTube embed. The live Data API FETCH is a separate, deferred I/O edge
// (mirroring gemini-client's `fetch` / the live mint) and is NOT exercised here —
// `mapYouTubeVideosToEvents` is pure, no network.
//
// The seam (ADR 0010 §3) requires: every produced signal in range, heatDelta
// monotonic in the platform heat proxy (viewCount), the official embed shape
// correct, and untrusted title text kept in the data-only `narrative` (never a
// rendered field — ADR 0009; the rendered-path spoiler-safety guard is a LATER
// cycle). The exact heat/novelty curves are tuning, not seam decisions — so this
// test pins ranges + monotonicity, never specific numbers.
describe("mapYouTubeVideosToEvents", () => {
  it("maps YouTube videos to contract-valid PerceptionEvents with official embeds", () => {
    // Arrange — a fixture of two NORMALIZED seeded-channel videos with distinct
    // viewCounts so monotonicity is observable. `hi` is the hotter (50000) video.
    const hi: YouTubeVideo = {
      videoId: "vidA",
      title: "NewsChan breaks down today's top headline",
      channelTitle: "NewsChan",
      publishedAt: "2026-06-04T09:00:00.000Z",
      viewCount: 50000,
    };
    const lo: YouTubeVideo = {
      videoId: "vidB",
      title: "NewsChan quiet midday update",
      channelTitle: "NewsChan",
      publishedAt: "2026-06-04T12:00:00.000Z",
      viewCount: 1000,
    };

    // Act
    const events = mapYouTubeVideosToEvents([hi, lo]);

    // Assert (1) — one event per video, in input order.
    expect(events).toHaveLength(2);
    const hiEvent = events[0]!;
    const loEvent = events[1]!;

    // (2) — official YouTube embed, verbatim, per video (ADR 0003 #5 / 0010).
    for (const [video, event] of [
      [hi, hiEvent],
      [lo, loEvent],
    ] as const) {
      const vantage = event.vantages[0]!;
      expect(event.vantages).toHaveLength(1);
      expect(vantage.embedUrl).toBe(
        `https://www.youtube.com/embed/${video.videoId}`,
      );
      expect(vantage.platform).toBe("youtube");
      expect(vantage.streamer).toBe(video.channelTitle);

      // (3) — stable, source-namespaced id so two Sources can't collide.
      expect(event.eventId).toBe(`youtube:${video.videoId}`);

      // (4) — signals in range (the seam requirement; curves are tuning).
      for (const signal of [event.heatDelta, event.novelty, event.legibility]) {
        expect(typeof signal).toBe("number");
        expect(signal).toBeGreaterThanOrEqual(0);
        expect(signal).toBeLessThanOrEqual(1);
      }
      expect([1, 2, 3, 4]).toContain(event.confidenceTier);
      expect(event.source.kind).toBe("video");

      // (6) — the UNTRUSTED title lands in the data-only `narrative` field (never
      // rendered — ADR 0009), not on any rendered/safe surface. (Spoiler-safety of
      // the rendered path is a later guard; here just pin where the title lands.)
      expect(event.narrative).toContain(video.title);
    }

    // (5) — heatDelta is monotonic in viewCount: the higher-viewCount video is at
    // least as hot, so the M4 ranker orders cross-platform events sensibly.
    expect(hiEvent.heatDelta).toBeGreaterThanOrEqual(loEvent.heatDelta);
  });
});

// M5-P2 R1a — the YouTube Source's secrets-from-env / no-spend INVARIANT
// (project-invariants.md #4; ADR 0010). The live Data API fetch is the deferred
// I/O edge; `createYouTubeSource` is the adapter that wraps it. Its key is read
// from `opts.apiKey ?? process.env.YOUTUBE_API_KEY` ONLY — never from a request
// body, never hardcoded. The HIGHEST-RISK face here mirrors gemini-client's and
// live-token-client's no-key→no-spend rule: with NO key there is nothing to call
// the API WITH, so `fetch()` must short-circuit to `[]` and NEVER touch the
// network (an unkeyed request would "spend" against an absent key / leak intent).
describe("createYouTubeSource", () => {
  // Save/restore the env knob this Source reads so no value leaks across tests.
  const previousApiKey = process.env.YOUTUBE_API_KEY;
  afterEach(() => {
    if (previousApiKey === undefined) {
      delete process.env.YOUTUBE_API_KEY;
    } else {
      process.env.YOUTUBE_API_KEY = previousApiKey;
    }
  });

  it("returns [] without calling the YouTube API when no key is set (no key, no spend)", async () => {
    // Arrange — no key anywhere: not on opts, not in the env.
    delete process.env.YOUTUBE_API_KEY;

    // A call-counting fetch stub: if the Source touches the network at all, this
    // increments — proving zero spend when there is no key.
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return { ok: true, json: async () => ({}) } as Response;
    }) as typeof fetch;

    const src = createYouTubeSource({
      channelIds: ["UC16niRr50-MSBwiO3YDb3RA"],
      fetchImpl,
    });

    // Act
    const events = await src.fetch();

    // Assert — empty result, zero network calls (no key ⇒ no spend), stable id.
    expect(events).toEqual([]);
    expect(calls).toBe(0);
    expect(src.id).toBe("youtube");
  });

  // M5-P2 R1-fetch — the WITH-KEY fetch path (ADR 0010 §3; m5-youtube-reference.md
  // "Fetch path"). With a key, `fetch()` per seeded channel derives the uploads
  // playlist (UC→UU), calls playlistItems.list (recent uploads → videoId/title/
  // channelTitle/publishedAt), then videos.list (the videoIds → viewCount),
  // normalizes to YouTubeVideo[] and maps via the existing mapYouTubeVideosToEvents.
  // All HTTP goes through the injected fetchImpl. This pins the OBSERVABLE contract
  // of fetch() — the contract-valid events it yields — not the call mechanics; the
  // heat assertion stays a RANGE + monotonicity (curves are tuning, not seam).
  it("with a key, fetches seeded channels and maps their videos to events", async () => {
    // Arrange — a fetchImpl that branches on the YouTube Data API endpoint in the
    // URL: playlistItems.list returns two recent uploads, videos.list returns their
    // statistics (distinct viewCounts so monotonicity is observable). Shapes mirror
    // the real Data API responses the adapter must read.
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("playlistItems")) {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                snippet: {
                  title: "Headline A",
                  channelTitle: "BBC News",
                  publishedAt: "2026-06-04T10:00:00Z",
                },
                contentDetails: {
                  videoId: "vidA",
                  videoPublishedAt: "2026-06-04T10:00:00Z",
                },
              },
              {
                snippet: {
                  title: "Headline B",
                  channelTitle: "BBC News",
                  publishedAt: "2026-06-04T09:00:00Z",
                },
                contentDetails: {
                  videoId: "vidB",
                  videoPublishedAt: "2026-06-04T09:00:00Z",
                },
              },
            ],
          }),
        } as unknown as Response;
      }
      if (url.includes("videos")) {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                id: "vidA",
                statistics: { viewCount: "50000" },
                status: { embeddable: true },
                contentDetails: { duration: "PT2M" },
              },
              {
                id: "vidB",
                statistics: { viewCount: "1000" },
                status: { embeddable: true },
                contentDetails: { duration: "PT3M" },
              },
            ],
          }),
        } as unknown as Response;
      }
      throw new Error(`unexpected YouTube API call: ${url}`);
    }) as typeof fetch;

    const src = createYouTubeSource({
      apiKey: "test-key",
      channelIds: ["UC16niRr50-MSBwiO3YDb3RA"],
      fetchImpl,
    });

    // Act
    const events = await src.fetch();

    // Assert — one event per fetched upload, mapped to contract-valid events.
    expect(events).toHaveLength(2);
    const vidAEvent = events.find((e) => e.eventId === "youtube:vidA")!;
    const vidBEvent = events.find((e) => e.eventId === "youtube:vidB")!;

    // The vidA event carries the official embed + channel + untrusted title (data-only).
    const vidAVantage = vidAEvent.vantages[0]!;
    expect(vidAVantage.embedUrl).toBe("https://www.youtube.com/embed/vidA");
    expect(vidAVantage.platform).toBe("youtube");
    expect(vidAVantage.streamer).toBe("BBC News");
    expect(vidAEvent.eventId).toBe("youtube:vidA");
    expect(vidAEvent.narrative).toContain("Headline A");

    // Both events' heat in range, and monotonic in viewCount: vidA (50000) ≥ vidB (1000).
    for (const event of [vidAEvent, vidBEvent]) {
      expect(event.heatDelta).toBeGreaterThanOrEqual(0);
      expect(event.heatDelta).toBeLessThanOrEqual(1);
    }
    expect(vidAEvent.heatDelta).toBeGreaterThanOrEqual(vidBEvent.heatDelta);
  });

  // M5-P2 R1-guards — the official-embeds-only INVARIANT on the fetch path
  // (project-invariants.md #5; ADR 0010; m5-youtube-reference.md "Guards"). A
  // video that won't play in an anonymous YouTube embed must be SKIPPED before it
  // becomes an event — never surfaced as a dead/blocked iframe. Two faces, both
  // read off the videos.list item:
  //   - `status.embeddable === false` (owner disabled embedding), OR
  //   - age-restricted: `contentDetails.contentRating.ytRating === 'ytAgeRestricted'`
  //     (won't play anonymously).
  // Only playable uploads survive. This pins the OBSERVABLE contract — the events
  // fetch() yields — not the filter mechanics.
  it("skips non-embeddable and age-restricted videos", async () => {
    // Arrange — three recent uploads; the videos.list response makes one
    // non-embeddable and one age-restricted. Same URL-branching fetchImpl as the
    // with-key fetch test (playlistItems → uploads, videos → playability).
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("playlistItems")) {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                snippet: {
                  title: "Playable headline",
                  channelTitle: "BBC News",
                  publishedAt: "2026-06-04T10:00:00Z",
                },
                contentDetails: { videoId: "vidGood" },
              },
              {
                snippet: {
                  title: "Embedding disabled by owner",
                  channelTitle: "BBC News",
                  publishedAt: "2026-06-04T09:30:00Z",
                },
                contentDetails: { videoId: "vidNoEmbed" },
              },
              {
                snippet: {
                  title: "Age-restricted clip",
                  channelTitle: "BBC News",
                  publishedAt: "2026-06-04T09:00:00Z",
                },
                contentDetails: { videoId: "vidAge" },
              },
            ],
          }),
        } as unknown as Response;
      }
      if (url.includes("videos")) {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                id: "vidGood",
                statistics: { viewCount: "5000" },
                status: { embeddable: true },
                contentDetails: { duration: "PT2M" },
              },
              {
                id: "vidNoEmbed",
                statistics: { viewCount: "9000" },
                status: { embeddable: false },
                contentDetails: { duration: "PT2M" },
              },
              {
                id: "vidAge",
                statistics: { viewCount: "9000" },
                status: { embeddable: true },
                contentDetails: {
                  duration: "PT2M",
                  contentRating: { ytRating: "ytAgeRestricted" },
                },
              },
            ],
          }),
        } as unknown as Response;
      }
      throw new Error(`unexpected YouTube API call: ${url}`);
    }) as typeof fetch;

    // Act
    const events = await createYouTubeSource({
      apiKey: "k",
      channelIds: ["UC16niRr50-MSBwiO3YDb3RA"],
      fetchImpl,
    }).fetch();

    // Assert — only the playable upload survives; the two unplayable ones are gone.
    expect(events).toHaveLength(1);
    const eventIds = events.map((e) => e.eventId);
    expect(eventIds).toContain("youtube:vidGood");
    expect(eventIds).not.toContain("youtube:vidNoEmbed");
    expect(eventIds).not.toContain("youtube:vidAge");
  });

  // M5-P2 R1-cache — the COST-GATING invariant on the YouTube Source's fetch path
  // (project-invariants.md #3; ADR 0010). The Data API has a bounded daily quota, so
  // repeated `fetch()` calls inside a short window must NOT re-hit the API — a poll
  // storm would burn quota for no new signal. The Source takes a per-source TTL cache:
  // within `ttlMs` of the last successful fetch, `fetch()` returns the cached events
  // WITHOUT calling fetchImpl again; once the window elapses it re-fetches. Time is
  // injected via `now` so the test controls the clock (mirrors gemini-client's clock
  // seam). This pins the OBSERVABLE effect — no re-spend within the window, re-spend
  // after it — via the call count of the injected fetchImpl (the only "spend" face).
  it("caches results within the TTL window — no re-spend", async () => {
    // Arrange — a controllable clock and a call-counting fetchImpl. Each fetch() that
    // actually hits the API makes 2 calls (playlistItems then videos). A single
    // channel + single embeddable upload (vid1) keeps the fixture minimal.
    let clock = 0;
    const now = () => clock;
    let calls = 0;
    const fetchImpl = (async (input: RequestInfo | URL) => {
      calls += 1;
      const url = String(input);
      if (url.includes("playlistItems")) {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                snippet: {
                  title: "Headline one",
                  channelTitle: "BBC News",
                  publishedAt: "2026-06-04T10:00:00Z",
                },
                contentDetails: { videoId: "vid1" },
              },
            ],
          }),
        } as unknown as Response;
      }
      if (url.includes("videos")) {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                id: "vid1",
                statistics: { viewCount: "1000" },
                status: { embeddable: true },
                contentDetails: { duration: "PT2M" },
              },
            ],
          }),
        } as unknown as Response;
      }
      throw new Error(`unexpected YouTube API call: ${url}`);
    }) as typeof fetch;

    const src = createYouTubeSource({
      apiKey: "k",
      channelIds: ["UC16niRr50-MSBwiO3YDb3RA"],
      fetchImpl,
      ttlMs: 60000,
      now,
    });

    // Act + Assert (1) — first fetch hits the API: playlistItems + videos = 2 calls.
    const first = await src.fetch();
    expect(calls).toBe(2);
    expect(first).toHaveLength(1);
    expect(first[0]!.eventId).toBe("youtube:vid1");

    // Act + Assert (2) — 30s later, still inside the 60s window: served from cache,
    // so NO new API calls (no re-spend) — and the cached events are still returned.
    clock = 30000;
    const cached = await src.fetch();
    expect(calls).toBe(2); // unchanged — this is what fails today (no cache ⇒ 4)
    expect(cached).toHaveLength(1);
    expect(cached[0]!.eventId).toBe("youtube:vid1");

    // Act + Assert (3) — 70s in, past the window: cache expired, fetch() re-hits the
    // API, adding another playlistItems + videos pair (2 → 4 calls).
    clock = 70000;
    await src.fetch();
    expect(calls).toBe(4);
  });

  // M5-P2 H1 — the FAILURE-SILENT invariant on the fetch path (project-invariants.md
  // #2; ADR 0010). Upstream I/O is unreliable: a thrown fetch (DNS, timeout, 5xx that
  // rejects) must degrade the whole fetch() to [], never propagate — a Source outage
  // can't take down the §6 pipeline or force noise. Guarded by the per-channel
  // try/catch in fetch(); this pins the OBSERVABLE contract (resolves [], not rejects).
  it("fetch() degrades to [] when the upstream fetch throws (failure-silent)", async () => {
    // Arrange — a key (so the no-key short-circuit doesn't pre-empt the throw path)
    // and a fetchImpl that always throws, simulating a hard network failure.
    const fetchImpl = (async () => {
      throw new Error("network down");
    }) as typeof fetch;

    // Act + Assert — the throw is swallowed per channel; fetch() resolves to []
    // rather than rejecting. (Remove the try/catch ⇒ this rejects ⇒ fails.)
    await expect(
      createYouTubeSource({
        apiKey: "k",
        channelIds: ["UC16niRr50-MSBwiO3YDb3RA"],
        fetchImpl,
      }).fetch(),
    ).resolves.toEqual([]);
  });

  // M5-P2 H2 — the SPOILER-SAFETY tripwire on the mapper (project-invariants.md #1;
  // ADR 0009). The untrusted video title can name an outcome ("Lakers WIN…"). It may
  // ride through ONLY as data-only `narrative`; it must NEVER reach a rendered/safe
  // field (the discriminated `type`, or any vantage label the UI shows). Mirrors the
  // host-loop loud-token + not.toMatch house pattern. Uses the pure mapper for
  // directness — the leak surface is the mapping, not the fetch.
  it("keeps an outcome-bearing title data-only — never on a rendered/safe field", () => {
    // Arrange — one video whose title shouts the outcome (loud tokens WIN / OVER).
    const [event] = mapYouTubeVideosToEvents([
      {
        videoId: "vidX",
        title: "Lakers WIN 120-100, series OVER",
        channelTitle: "ESPN",
        publishedAt: "2026-06-04T10:00:00Z",
        viewCount: 5000,
      },
    ]);

    // Assert (1) — the outcome rode through AS DATA: it's present in `narrative`.
    expect(event!.narrative).toContain("Lakers WIN");

    // (2) — but NOT on the discriminated/rendered `type` (hardcoded neutral today).
    expect(event!.type).not.toMatch(/win|over/i);

    // (3) — and NOT on any field of any vantage the UI would render/label.
    expect(event!.vantages[0]!.embedUrl).not.toMatch(/win|over/i);
    expect(event!.vantages[0]!.streamer).not.toMatch(/win|over/i);
    expect(event!.vantages[0]!.streamId).not.toMatch(/win|over/i);
  });

  // M5-P2 M3a — the SECRETS-FROM-ENV invariant's fallback face (project-invariants.md
  // #4; ADR 0010). The key is `opts.apiKey ?? process.env.YOUTUBE_API_KEY` — so with
  // opts.apiKey OMITTED, the Source must still source the key from the backend env
  // (how staging injects it via SSM → env), fetch, and produce events. (Drop the
  // `?? process.env...` ⇒ key undefined ⇒ no-spend [] ⇒ fails.) The existing afterEach
  // restores/deletes YOUTUBE_API_KEY, so this env write doesn't leak across tests.
  it("sources the API key from process.env when opts.apiKey is omitted", async () => {
    // Arrange — the key lives ONLY in the env, never on opts.
    process.env.YOUTUBE_API_KEY = "env-key";

    // Same happy-path fixture as the R1-fetch test, trimmed to one upload (vid1).
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("playlistItems")) {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                snippet: {
                  title: "Headline one",
                  channelTitle: "BBC News",
                  publishedAt: "2026-06-04T10:00:00Z",
                },
                contentDetails: { videoId: "vid1" },
              },
            ],
          }),
        } as unknown as Response;
      }
      if (url.includes("videos")) {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                id: "vid1",
                statistics: { viewCount: "1000" },
                status: { embeddable: true },
                contentDetails: { duration: "PT2M" },
              },
            ],
          }),
        } as unknown as Response;
      }
      throw new Error(`unexpected YouTube API call: ${url}`);
    }) as typeof fetch;

    // Act — NO apiKey in opts: the key must come from process.env.
    const events = await createYouTubeSource({
      channelIds: ["UC16niRr50-MSBwiO3YDb3RA"],
      fetchImpl,
    }).fetch();

    // Assert — it found the env key, fetched, and mapped the upload to one event.
    expect(events).toHaveLength(1);
    expect(events.map((e) => e.eventId)).toContain("youtube:vid1");
  });
});
