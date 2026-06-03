import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { App } from "../src/App.js";
import { events } from "../src/mocks/event-graph";

describe("App", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("mounts the channel-surf shell from the mock event-graph, showing a channel and the top event's best vantage", () => {
    // Derive expectations from the mock so this stays honest if the sample changes.
    const topEvent = events[0]!;
    const bestVantage = topEvent.vantages.reduce((best, v) =>
      v.lensScore > best.lensScore ? v : best,
    );

    render(<App />);

    // A channel per mock event: the top event's spoiler-safe `type · streamer` label
    // (ADR 0009) names a surfable button — NOT its outcome-bearing narrative. The mock
    // top event is `clutch` with top-vantage streamer "Co-streamer A".
    expect(
      screen.getByRole("button", { name: `${topEvent.type} · ${bestVantage.streamer}` }),
    ).toBeInTheDocument();

    // Spoiler-leak closed across the whole surface: no rail label on screen leaks a
    // banned outcome token from the mock narratives ("…to win the round", "…world record").
    expect(document.body).not.toHaveTextContent(/to win the round/i);
    expect(document.body).not.toHaveTextContent(/world record/i);

    // The player loads showing the top event's max-lensScore vantage. That vantage
    // is a Twitch embed (player.twitch.tv), so the Player preserves the official
    // source + channel and appends Twitch's mandated parent=<host> (ADR 0008).
    // Derive the channel from the mock so this stays honest if the sample changes;
    // jsdom's window.location.hostname defaults to "localhost".
    const channel = new URL(bestVantage.embedUrl).searchParams.get("channel");
    expect(channel).not.toBeNull();
    const src = screen.getByTitle("player").getAttribute("src") ?? "";
    expect(src).toContain("player.twitch.tv");
    expect(src).toContain(`channel=${channel}`);
    expect(src).toContain("parent=localhost");
  });

  it("routes the surfacing event through the injected narrate client and wakes the host into the speaking state", async () => {
    // The host loop's speak side-effect defaults to window.speechSynthesis, which
    // jsdom lacks — stub the Web Speech surface so the character can speak without
    // crashing the environment.
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

    // M3: the host's utterance must come from the /narrate client, not a canned line.
    // Inject a stub that records calls (proving cost-gated narration fired) and
    // resolves a known line for the character to speak.
    const narrateCalls: unknown[] = [];
    const narrate = async (i: unknown) => {
      narrateCalls.push(i);
      return "the Major just turned — watch this";
    };

    render(<App narrate={narrate} />);

    // The first mock event (heatDelta 0.91) clears the default surfaceThreshold and
    // fires at ts: 1. Advance fake time past it; the async narrate resolves within
    // the flush (no waitFor under fake timers).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    // M3 load-bearing assertion: a surfacing event routed through the /narrate client
    // (cost-gated — only fires because the loop surfaced, not on the idle firehose).
    expect(narrateCalls.length).toBeGreaterThanOrEqual(1);

    // The host woke: the hot event drove a `speak` directive — now on the narrated
    // line — into the character.
    expect(screen.getByRole("status")).toHaveTextContent(/speaking/i);
  });

  it("keeps /narrate calls bounded on the default client path, never storming on re-render (cost-gating)", async () => {
    // D1 regression: <App/> with NO narrate prop must use the real default
    // createNarrateClient() — the production path. The cost-gating invariant has
    // to hold there too: a surfacing event spends ONE LLM call, never a storm.
    // (The existing cost-gating unit test injects a STABLE client, so it never
    // exercised the default-client identity churn that drives the storm.)
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

    // Stub global fetch so the default client's /narrate POST records each call
    // and resolves a valid { utterance } the character can speak.
    const narrateCalls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      if (String(url).includes("/narrate")) narrateCalls.push(String(url));
      return {
        ok: true,
        json: async () => ({ utterance: "a short test line" }),
      } as Response;
    });

    // No narrate prop → the real default createNarrateClient() (the buggy path).
    render(<App />);

    // Advance ~3s of feed time across several flush turns. Only the first mock
    // event (ts: 1, heatDelta 0.91) surfaces in this window — events 2/3 fire at
    // ts 45000/90000. Each turn pumps the render cascade; no waitFor under fake
    // timers. Separate turns matter: D1's storm escalates per render turn (the
    // effect re-subscribes the bus + re-arms the feed every re-render), so a
    // single advanceTimersByTimeAsync would collapse the window and mask it.
    for (let i = 0; i < 30; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
    }

    // Cost-gating: one surfacing event in 3s = at most one /narrate call (+1
    // headroom). The D1 storm re-fires the ts:1 feed timer on every re-render,
    // driving this far higher (one call per render turn).
    expect(narrateCalls.length).toBeLessThanOrEqual(2);
  });
});
