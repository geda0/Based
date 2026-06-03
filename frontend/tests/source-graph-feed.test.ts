import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createSourceGraphFeed } from "../src/lib/source-graph-feed";
import { createEventBus } from "../src/lib/event-bus";
import type { PerceptionEvent } from "../src/contracts";

function makeEvent(eventId: string, ts: number): PerceptionEvent {
  return {
    eventId,
    type: "clutch",
    narrative: "something is happening",
    heatDelta: 0.5,
    novelty: 0.5,
    legibility: 0.5,
    confidenceTier: 1,
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
    ts,
  };
}

describe("createSourceGraphFeed", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("publishes each event onto the bus at its ts offset in time order", () => {
    const first = makeEvent("first", 0);
    const second = makeEvent("second", 1000);

    const bus = createEventBus<PerceptionEvent>();
    const received: string[] = [];
    bus.subscribe((event) => {
      received.push(event.eventId);
    });

    const feed = createSourceGraphFeed([first, second], bus);
    feed.start();

    vi.advanceTimersByTime(0);
    expect(received).toEqual(["first"]);

    vi.advanceTimersByTime(1000);
    expect(received).toEqual(["first", "second"]);
  });
});
