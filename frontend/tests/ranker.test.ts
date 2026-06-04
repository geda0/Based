import { describe, it, expect } from "vitest";
import { rankFeed } from "../src/lib/ranker";
import type { PerceptionEvent } from "../src/contracts";

function makeEvent(
  eventId: string,
  signals: Pick<
    PerceptionEvent,
    "heatDelta" | "novelty" | "legibility" | "confidenceTier"
  >,
): PerceptionEvent {
  return {
    eventId,
    type: "clutch",
    narrative: "something is happening",
    heatDelta: signals.heatDelta,
    novelty: signals.novelty,
    legibility: signals.legibility,
    confidenceTier: signals.confidenceTier,
    source: { kind: "video" },
    vantages: [
      {
        streamId: `${eventId}-stream`,
        platform: "twitch",
        embedUrl: "https://player.twitch.tv/?channel=example",
        offsetSec: 0,
        lensScore: 0.5,
      },
    ],
    ts: 0,
  };
}

describe("rankFeed", () => {
  it("blends signals and reorders vs raw heatDelta (not a heatDelta no-op)", () => {
    // A: a tiny heat edge, but otherwise weak and least-confident (tier 4).
    const a = makeEvent("event-a", {
      heatDelta: 0.75,
      novelty: 0.05,
      legibility: 0.05,
      confidenceTier: 4,
    });
    // B: slightly lower heat, but maxed novelty/legibility + top confidence (tier 1).
    const b = makeEvent("event-b", {
      heatDelta: 0.7,
      novelty: 0.98,
      legibility: 0.98,
      confidenceTier: 1,
    });

    const ranked = rankFeed([a, b]);

    // 1. The blend lifts B above A despite A's higher raw heatDelta.
    expect(ranked.events[0]!.eventId).toBe("event-b");

    // 2. The order is NOT the raw-heatDelta-descending order — proving it is not a no-op.
    const heatDescOrder = [a, b]
      .slice()
      .sort((x, y) => y.heatDelta - x.heatDelta)
      .map((e) => e.eventId);
    const rankedOrder = ranked.events.map((e) => e.eventId);
    expect(rankedOrder).not.toEqual(heatDescOrder);

    // 3. eventScore is computed, numeric, and B outscores A.
    for (const event of ranked.events) {
      expect(typeof event.eventScore).toBe("number");
      expect(Number.isFinite(event.eventScore)).toBe(true);
    }
    const scoreOf = (id: string) =>
      ranked.events.find((e) => e.eventId === id)!.eventScore;
    expect(scoreOf("event-b")).toBeGreaterThan(scoreOf("event-a"));
  });
});
