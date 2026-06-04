import { describe, it, expect } from "vitest";
import { createSourceRegistry } from "../../src/modules/sources/source-registry.js";
import type {
  PerceptionEvent,
  Source,
} from "../../src/modules/sources/youtube-source.js";

// M5-P2 — SourceRegistry failure-silent merge invariant (ADR 0010 §2).
// The source layer must be failure-silent END TO END: one misbehaving source that
// REJECTS must not sink the whole feed. `createSourceRegistry(sources).fetchAll()`
// currently uses Promise.all, which propagates the first rejection — so a single
// throwing source makes the entire merge reject. This pins the OBSERVABLE contract:
// fetchAll() resolves with the healthy source's events and drops the broken one,
// regardless of where the broken source sits in the list.
describe("SourceRegistry failure-silent merge", () => {
  it("a rejecting source does not sink the healthy ones", async () => {
    // Arrange — one contract-valid PerceptionEvent (copied from the known-valid §6
    // literal the mapper produces) behind a healthy source, and a source that throws.
    const eventA: PerceptionEvent = {
      eventId: "ok:1",
      type: "other",
      narrative: "healthy source headline",
      heatDelta: 0.5,
      novelty: 0.7,
      legibility: 0.8,
      confidenceTier: 1,
      source: { kind: "video", ref: "ok" },
      vantages: [
        {
          streamId: "ok:1",
          platform: "youtube",
          embedUrl: "https://www.youtube.com/embed/ok1",
          offsetSec: 0,
          lensScore: 0.9,
          streamer: "Channel OK",
        },
      ],
      ts: 0,
    };

    const healthy: Source = { id: "ok", fetch: async () => [eventA] };
    const broken: Source = {
      id: "bad",
      fetch: async () => {
        throw new Error("upstream down");
      },
    };

    // Act + Assert — the broken source's rejection is swallowed; only the healthy
    // event survives. Healthy-first ordering.
    await expect(
      createSourceRegistry([healthy, broken]).fetchAll()
    ).resolves.toHaveLength(1);
    const healthyFirst = await createSourceRegistry([healthy, broken]).fetchAll();
    expect(healthyFirst.map((e) => e.eventId)).toContain("ok:1");

    // Position-independent: flipping the order (broken first) still resolves to the
    // healthy event — proving the resilience is not order-dependent.
    await expect(
      createSourceRegistry([broken, healthy]).fetchAll()
    ).resolves.toHaveLength(1);
    const brokenFirst = await createSourceRegistry([broken, healthy]).fetchAll();
    expect(brokenFirst.map((e) => e.eventId)).toContain("ok:1");
  });
});
