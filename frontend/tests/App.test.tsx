import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

    // A channel per mock event: the top event's narrative names a surfable button.
    expect(
      screen.getByRole("button", { name: topEvent.narrative }),
    ).toBeInTheDocument();

    // The player loads showing the top event's max-lensScore vantage, verbatim.
    expect(screen.getByTitle("player")).toHaveAttribute(
      "src",
      bestVantage.embedUrl,
    );
  });

  it("wakes the host into the speaking state when the feed fires a hot event", async () => {
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

    render(<App />);

    // The first mock event (heatDelta 0.91) clears the default surfaceThreshold and
    // fires at ts: 1. Advance fake time past it and flush React state from the bus.
    await vi.advanceTimersByTimeAsync(100);

    // The host woke: a hot event from the feed drove the loop's `speak` directive
    // into the character.
    expect(screen.getByRole("status")).toHaveTextContent(/speaking/i);
  });
});
