import { describe, it, expect } from "vitest";
import {
  createMockSource,
  createRemoteSource,
  createSourceRegistry,
  resolveRegistry,
} from "../src/lib/sources";
import type { Source } from "../src/lib/sources";
import { events } from "../src/mocks/event-graph";
import type { PerceptionEvent } from "../src/contracts";

describe("Based TV — Source abstraction", () => {
  it("aggregates multiple sources into one merged event stream", async () => {
    // Arrange: a second source contributing ONE contract-valid event, distinct
    // from every mock event by its eventId, with an official Twitch vantage.
    const extraEvent: PerceptionEvent = {
      eventId: "evt_extra",
      type: "reveal",
      narrative: "a second platform surfaces its own breaking moment",
      heatDelta: 0.7,
      novelty: 0.7,
      legibility: 0.7,
      confidenceTier: 2,
      source: { kind: "video" },
      vantages: [
        {
          streamId: "vextra_main",
          platform: "twitch",
          embedUrl: "https://player.twitch.tv/?channel=extrachannel",
          offsetSec: 0,
          lensScore: 0.7,
        },
      ],
      ts: 120000,
    };
    const extraSource: Source = {
      id: "extra",
      fetch: async () => [extraEvent],
    };

    const registry = createSourceRegistry([createMockSource(), extraSource]);

    // Act: the registry awaits every source and flattens their events into one stream.
    const result = await registry.fetchAll();

    // Assert: the merged stream is the mock graph plus the one extra event...
    expect(result.length).toBe(events.length + 1);

    // ...every merged item is a well-formed PerceptionEvent...
    for (const event of result) {
      expect(typeof event.eventId).toBe("string");
      expect(event.vantages.length).toBeGreaterThan(0);
    }

    // ...and the set includes BOTH the extra source's event and the mock's first event,
    // proving sources plug in and the registry merges them.
    expect(result.some((event) => event.eventId === "evt_extra")).toBe(true);
    const mockFirst = events[0];
    expect(mockFirst).toBeDefined();
    expect(result.some((event) => event.eventId === mockFirst!.eventId)).toBe(true);
  });

  it("createRemoteSource fetches the events endpoint and returns its events", async () => {
    // Arrange: ONE contract-valid event the backend endpoint would return, with an
    // official youtube vantage and a distinct eventId, plus a fetch stub that records
    // the URL it was called with and returns that event as the endpoint's JSON body.
    const remoteEvent: PerceptionEvent = {
      eventId: "remote:1",
      type: "reveal",
      narrative: "the remote backend endpoint surfaces a breaking moment",
      heatDelta: 0.7,
      novelty: 0.7,
      legibility: 0.7,
      confidenceTier: 2,
      source: { kind: "video" },
      vantages: [
        {
          streamId: "vremote_main",
          platform: "youtube",
          embedUrl: "https://www.youtube.com/embed/r1",
          offsetSec: 0,
          lensScore: 0.7,
          streamer: "remotestreamer",
        },
      ],
      ts: 130000,
    };
    let calledUrl: string | undefined;
    const fetchImpl = (async (u: string) => {
      calledUrl = u;
      return { ok: true, json: async () => [remoteEvent] };
    }) as unknown as typeof fetch;

    const src = createRemoteSource({ url: "/sources/events", fetchImpl });

    // Act: the source fetches its configured endpoint and parses the JSON body.
    const events = await src.fetch();

    // Assert: a stable id, the endpoint's event flows through verbatim, and the
    // configured URL is the one the source fetched.
    expect(src.id).toBe("remote");
    expect(events.length).toBe(1);
    expect(events.map((e) => e.eventId)).toContain("remote:1");
    expect(calledUrl).toBe("/sources/events");
  });

  it("createRemoteSource is failure-silent — resolves [] on fetch error or non-ok response", async () => {
    // Failure-silent is part of the Source contract (ADR 0010 §2): fetch() never
    // throws on an upstream/credential failure; it degrades to [] so one dead source
    // can never sink the merged feed. Both upstream failure modes degrade to [].

    // Arrange: a fetch that throws (a raw network error).
    const throwing = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;

    // Arrange: a fetch that resolves a non-ok response (e.g. the endpoint 500s).
    const notOk = (async () => ({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("no body");
      },
    })) as unknown as typeof fetch;

    // Act + Assert: each failure mode resolves to an empty event list, never rejects.
    await expect(
      createRemoteSource({ url: "/sources/events", fetchImpl: throwing }).fetch(),
    ).resolves.toEqual([]);
    await expect(
      createRemoteSource({ url: "/sources/events", fetchImpl: notOk }).fetch(),
    ).resolves.toEqual([]);
  });

  it("resolveRegistry returns a remote registry when the flag is on, undefined when off", async () => {
    // OFF: with the remote flag off, the factory yields undefined so the App falls
    // back to its built-in mock event-graph.
    expect(resolveRegistry({ useRemote: false })).toBeUndefined();

    // ON (hermetic): inject a fetch stub recording the URL it was called with and
    // returning ONE contract-valid event as the endpoint's JSON body — an official
    // youtube vantage with a distinct eventId, matching this file's literal style.
    const remoteEvent: PerceptionEvent = {
      eventId: "remote:1",
      type: "reveal",
      narrative: "the remote backend endpoint surfaces a breaking moment",
      heatDelta: 0.7,
      novelty: 0.7,
      legibility: 0.7,
      confidenceTier: 2,
      source: { kind: "video" },
      vantages: [
        {
          streamId: "vremote_main",
          platform: "youtube",
          embedUrl: "https://www.youtube.com/embed/r1",
          offsetSec: 0,
          lensScore: 0.7,
          streamer: "remotestreamer",
        },
      ],
      ts: 130000,
    };
    let calledUrl: string | undefined;
    const fetchImpl = (async (u: string) => {
      calledUrl = u;
      return { ok: true, json: async () => [remoteEvent] };
    }) as unknown as typeof fetch;

    // Act: with the flag on + a base URL, the factory composes a registry wired to
    // the backend's canonical events path.
    const reg = resolveRegistry({
      useRemote: true,
      baseUrl: "http://api.test",
      fetchImpl,
    });

    // Assert: a registry exists, its merged feed carries the endpoint's event, and
    // the source was fetched against `${baseUrl}/sources/events`.
    expect(reg).toBeDefined();
    const result = await reg!.fetchAll();
    expect(result.length).toBe(1);
    expect(result.map((e) => e.eventId)).toContain("remote:1");
    expect(calledUrl).toBe("http://api.test/sources/events");
  });
});
