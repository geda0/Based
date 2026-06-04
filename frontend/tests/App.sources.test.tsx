import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { App } from "../src/App.js";
import { createSourceRegistry } from "../src/lib/sources";
import type { PerceptionEvent } from "../src/contracts";

// M5-P1 c2: the App can CONSUME an injected Source registry (async) instead of
// the static mock import — routing the sourced events through the UNCHANGED
// engine (rankFeed → feed → host-loop → digest). This file is SEPARATE from
// App.test.tsx (which injects NO registry, so it keeps the static-mock path and
// stays green) so the registry-consumption seam can be pinned without disturbing
// the timing-coupled mock-path assertions there. We deliberately do NOT vi.mock
// the event-graph here: the point is that an INJECTED registry — not the static
// mock — supplies what the shell renders.
describe("App — Source registry consumption", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("consumes events from an injected source registry, not the static mock", async () => {
    // The host loop's speak side-effect defaults to window.speechSynthesis, which
    // jsdom lacks — stub the Web Speech surface (mirroring App.test.tsx) so the
    // App can construct without crashing even though we inject a `voice`.
    vi.useFakeTimers();
    vi.stubGlobal("speechSynthesis", { speak: () => {}, cancel: () => {} });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        text: string;
        constructor(t: string) {
          this.text = t;
        }
      },
    );

    // A SINGLE distinctive sourced event — its unique eventId / Twitch streamer
    // is what proves the App rendered the REGISTRY's event, not the static mock's.
    const sourcedEvent: PerceptionEvent = {
      eventId: "evt_sourced",
      type: "clutch",
      narrative: "an injected source surfaces its own breaking moment",
      heatDelta: 0.91,
      novelty: 0.8,
      legibility: 0.95,
      confidenceTier: 1,
      source: { kind: "broadcast", ref: "sourced_feed" },
      vantages: [
        {
          streamId: "vsourced_main",
          platform: "twitch",
          embedUrl: "https://player.twitch.tv/?channel=sourcedchan",
          offsetSec: 0,
          lensScore: 0.92,
          streamer: "sourcedchan",
        },
      ],
      ts: 1,
    };

    // The registry from c1: one inline source whose fetch resolves the sourced event.
    const registry = createSourceRegistry([
      { id: "test", fetch: async () => [sourcedEvent] },
    ]);

    // Render the App against the injected registry (the "real heat" / flag-on path).
    // narrate/voice are stubbed so nothing else touches the environment; voice.speak
    // never resolves because this test pins the SOURCED render, not the host's drain.
    render(
      <App
        registry={registry}
        narrate={async () => "x"}
        voice={{ speak: () => new Promise<void>(() => {}) }}
      />,
    );

    // Flush the async load: registry.fetchAll() resolves in a microtask;
    // advanceTimersByTimeAsync(0) flushes it under fake timers (never raw setTimeout).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // Load-bearing: the App rendered the REGISTRY's event, not the static mock —
    // the rail carries the sourced event's spoiler-safe `type · streamer` label...
    expect(
      screen.getByRole("button", { name: /clutch · sourcedchan/i }),
    ).toBeInTheDocument();

    // ...and the player loads the sourced event's vantage (its Twitch channel).
    const src = screen.getByTitle("player").getAttribute("src") ?? "";
    expect(src).toContain("channel=sourcedchan");
  });
});
