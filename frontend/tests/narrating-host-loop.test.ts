import { describe, it, expect } from "vitest";
import { createNarratingHostLoop } from "../src/lib/narrating-host-loop";
import { createHostLoop } from "../src/lib/host-loop";
import type { PerceptionEvent } from "../src/contracts";
import type { NarrateInput } from "../src/lib/narrate-client";

// Reuses the valid PerceptionEvent fixture shape from host-loop.test.ts,
// extended with eventScore and a vantage carrying a `streamer`.
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
        streamer: "ExampleStreamer",
      },
    ],
    ts: 0,
    eventScore,
  };
}

describe("createNarratingHostLoop", () => {
  it("calls narrate only when an event surfaces — never on idle, exactly once per surface", async () => {
    // Spy at the I/O boundary: the injected NarrateClient. Counting its calls is
    // how the cost-gate is observed (the LLM must fire on surfaces, not the firehose).
    const calls: NarrateInput[] = [];
    const narrate = async (input: NarrateInput): Promise<string> => {
      calls.push(input);
      return "API LINE";
    };

    const nloop = createNarratingHostLoop(
      createHostLoop({ surfaceThreshold: 0.6 }),
      narrate,
    );

    // Below threshold → the loop stays idle → narrate must NOT be called.
    const below = makeRankedEvent("quiet", 0.2);
    await nloop.onEvent(below);
    expect(calls.length).toBe(0);

    // Above threshold → the loop surfaces a speak → narrate is called exactly once.
    const above = makeRankedEvent("hot", 0.9);
    await nloop.onEvent(above);
    expect(calls.length).toBe(1);
  });

  it("speaks the /narrate API result on a surface, not the canned placeholder", async () => {
    // A distinctive line the canned M2 template (`listen — eyes on …`) can't produce,
    // so the assertion proves the surfaced utterance is the API value, verbatim.
    const API_LINE = "the Major just turned — watch this";
    const narrate = async () => API_LINE;

    const nloop = createNarratingHostLoop(
      createHostLoop({ surfaceThreshold: 0.6 }),
      narrate,
    );

    const above = makeRankedEvent("hot", 0.9);
    const out = await nloop.onEvent(above);

    const speak = out.find((d) => d.action === "speak");
    expect(speak).toBeDefined();
    expect(speak?.utterance).toBe(API_LINE);
    // Prove it's the API line, not the M2 canned template.
    expect(speak?.utterance).not.toMatch(/eyes on/);
    // Spoiler-safety still holds on the surfaced directive.
    expect(speak?.spoilerSafe).toBe(true);
  });

  it("stays silent but still cuts when /narrate fails", async () => {
    // A broken/empty line is worse than silence: if the LLM call rejects (or times
    // out), the host must emit NO speak directive — yet the player may still cut to
    // the vantage, so cutTo is retained.
    const narrate = async () => {
      throw new Error("narrate down");
    };

    const nloop = createNarratingHostLoop(
      createHostLoop({ surfaceThreshold: 0.6 }),
      narrate,
    );

    const above = makeRankedEvent("hot", 0.9);
    // Must resolve, not reject: a failed narrate is handled, not propagated.
    const out = await nloop.onEvent(above);

    // No forced/empty utterance — the host stays silent.
    expect(out.find((d) => d.action === "speak")).toBeUndefined();
    // The player may still cut to the vantage.
    expect(out.find((d) => d.action === "cutTo")).toBeDefined();
  });

  it("stays silent but still cuts when /narrate returns an empty or whitespace line", async () => {
    // A 200 with an empty/whitespace utterance is the same hazard as a failure:
    // a blank "speaking" host is worse than silence (silence-budget spirit). The
    // resolved-but-empty result must drop the speak exactly like a rejection —
    // not pass through as a speak directive carrying `utterance: ''`. The player
    // may still cut to the vantage, so cutTo is retained.
    for (const blank of ["", "   "]) {
      const narrate = async () => blank;

      const nloop = createNarratingHostLoop(
        createHostLoop({ surfaceThreshold: 0.6 }),
        narrate,
      );

      const above = makeRankedEvent("hot", 0.9);
      const out = await nloop.onEvent(above);

      // No blank speak line is forced — the host stays silent.
      expect(out.find((d) => d.action === "speak")).toBeUndefined();
      // The player may still cut to the vantage.
      expect(out.find((d) => d.action === "cutTo")).toBeDefined();
    }
  });
});
