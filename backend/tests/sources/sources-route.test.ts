import { describe, it, expect } from "vitest";
import { buildApp } from "../../src/app.js";
import type {
  PerceptionEvent,
  Source,
} from "../../src/modules/sources/youtube-source.js";

// M5-P2 R1-route — GET /sources/events serves the MERGED events from the injected
// Source registry (ADR 0010 §3). Sources are injected into `buildApp` (mirroring how
// M3 injects `gemini` and LV1 injects `liveMint`) so the suite never hits the network.
// The route's OBSERVABLE contract is: call every Source's `fetch()`, concatenate the
// PerceptionEvents they yield, and return that merged array as JSON. This pins the
// merge contract — both Sources' events appear, keyed by their source-namespaced
// eventIds — not the fetch mechanics. The stub events below are copied from a known
// contract-valid literal (the §6 PerceptionEvent shape the mapper produces) so they
// typecheck against the backend-local mirror.
describe("GET /sources/events", () => {
  it("returns the merged events from the registry's sources", async () => {
    // Arrange — two contract-valid PerceptionEvents with distinct, source-namespaced
    // eventIds, each exposed by its own stub Source.
    const eventA: PerceptionEvent = {
      eventId: "a:1",
      type: "other",
      narrative: "source A headline",
      heatDelta: 0.5,
      novelty: 0.7,
      legibility: 0.8,
      confidenceTier: 1,
      source: { kind: "video", ref: "a" },
      vantages: [
        {
          streamId: "a:1",
          platform: "youtube",
          embedUrl: "https://www.youtube.com/embed/a1",
          offsetSec: 0,
          lensScore: 0.9,
          streamer: "Channel A",
        },
      ],
      ts: 0,
    };
    const eventB: PerceptionEvent = {
      eventId: "b:1",
      type: "other",
      narrative: "source B headline",
      heatDelta: 0.4,
      novelty: 0.6,
      legibility: 0.8,
      confidenceTier: 2,
      source: { kind: "video", ref: "b" },
      vantages: [
        {
          streamId: "b:1",
          platform: "youtube",
          embedUrl: "https://www.youtube.com/embed/b1",
          offsetSec: 0,
          lensScore: 0.9,
          streamer: "Channel B",
        },
      ],
      ts: 0,
    };

    const sourceA: Source = { id: "a", fetch: async () => [eventA] };
    const sourceB: Source = { id: "b", fetch: async () => [eventB] };

    const app = buildApp({ sources: [sourceA, sourceB] });
    try {
      // Act
      const res = await app.inject({ method: "GET", url: "/sources/events" });

      // Assert — 200 with the two sources' events merged into one array.
      expect(res.statusCode).toBe(200);
      const body = res.json() as PerceptionEvent[];
      expect(body).toHaveLength(2);

      // Both source-namespaced eventIds appear (order is not part of the contract).
      const eventIds = body.map((e) => e.eventId);
      expect(eventIds).toContain("a:1");
      expect(eventIds).toContain("b:1");
    } finally {
      await app.close();
    }
  });
});
