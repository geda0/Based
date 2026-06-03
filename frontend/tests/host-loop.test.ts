import { describe, it, expect } from "vitest";
import { createHostLoop } from "../src/lib/host-loop";
import type { PerceptionEvent } from "../src/contracts";

function makeRankedEvent(
  eventId: string,
  eventScore: number,
): PerceptionEvent & { eventScore: number } {
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
    ts: 0,
    eventScore,
  };
}

describe("createHostLoop", () => {
  it("stays silent when an event does not clear the surface threshold", () => {
    const loop = createHostLoop({ surfaceThreshold: 0.6 });

    const belowThresholdEvent = makeRankedEvent("quiet", 0.2);
    const out = loop.onEvent(belowThresholdEvent);

    expect(
      out.some((d) => d.action === "speak" || d.action === "cutTo"),
    ).toBe(false);
  });

  it("surfaces an above-threshold event with a spoiler-safe, anticipation-only utterance", () => {
    const loop = createHostLoop({ surfaceThreshold: 0.6 });

    // The outcome the narrative leaks — the host must NOT voice it before the cut.
    const OUTCOME = "ACED";
    const event: PerceptionEvent & { eventScore: number } = {
      eventId: "wr-run",
      type: "clutch",
      narrative: `Speedrunner just landed the world-record trick — ${OUTCOME} the run`,
      heatDelta: 0.9,
      novelty: 0.9,
      legibility: 0.9,
      confidenceTier: 1,
      source: { kind: "video" },
      vantages: [
        {
          streamId: "wr-run-stream",
          platform: "twitch",
          embedUrl: "https://player.twitch.tv/?channel=runnerx",
          offsetSec: 0,
          lensScore: 0.9,
          streamer: "RunnerX",
        },
      ],
      ts: 0,
      eventScore: 0.95,
    };

    const out = loop.onEvent(event);

    // 1. It surfaced — a spoken line was emitted (forces surfacing logic to exist).
    expect(out.some((d) => d.action === "speak")).toBe(true);

    // 2. Every emitted directive is spoiler-safe.
    expect(out.every((d) => d.spoilerSafe === true)).toBe(true);

    // 3. Anticipation-only — the spoken utterance must not name the outcome.
    const speak = out.find((d) => d.action === "speak");
    expect(typeof speak?.utterance).toBe("string");
    expect(speak?.utterance).not.toMatch(/aced/i);
  });

  it("rate-limits a burst to a single speak, then speaks again once the silence budget elapses", () => {
    // Controllable clock so the silence budget is exercised deterministically.
    let t = 0;
    const loop = createHostLoop({
      surfaceThreshold: 0.6,
      silenceBudgetMs: 30000,
      now: () => t,
    });

    // One above-threshold event, reused across the burst.
    const event = makeRankedEvent("hot-event", 0.9);

    // BURST: 4 above-threshold events, 1s apart — well inside the 30000ms budget.
    let burstSpeakCount = 0;
    for (let i = 0; i < 4; i++) {
      const out = loop.onEvent(event);
      burstSpeakCount += out.filter((d) => d.action === "speak").length;
      t += 1000;
    }

    // Only the first event earns the interruption; the rest are silenced.
    expect(burstSpeakCount).toBe(1);

    // Once the budget window elapses, the host may speak again.
    t += 30000;
    const afterBudget = loop.onEvent(event);
    const totalSpeakCount =
      burstSpeakCount + afterBudget.filter((d) => d.action === "speak").length;

    // Proves it is a rate-limit (speaks again), not a one-shot.
    expect(totalSpeakCount).toBe(2);
  });
});
