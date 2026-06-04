import { describe, it, expect } from "vitest";
import { digest, events } from "../src/mocks/event-graph";

describe("mock event-graph", () => {
  it("is a demo-valid graph: has a digest line and enough embeddable, well-formed events to drive the experience", () => {
    // A non-empty "while you were gone" digest line for the host to open with.
    expect(typeof digest).toBe("string");
    expect(digest.trim().length).toBeGreaterThan(0);

    // The DoD requires at least two events to fire over the window.
    expect(events.length).toBeGreaterThanOrEqual(2);

    for (const event of events) {
      // Every event must offer the player at least one vantage to embed...
      expect(event.vantages.length).toBeGreaterThanOrEqual(1);
      for (const vantage of event.vantages) {
        expect(typeof vantage.embedUrl).toBe("string");
        expect(vantage.embedUrl.trim().length).toBeGreaterThan(0);
      }

      // ...and a finite, non-negative ms offset from feed start.
      expect(Number.isFinite(event.ts)).toBe(true);
      expect(event.ts).toBeGreaterThanOrEqual(0);
    }

    // Event ids must be unique so the feed can address each event distinctly.
    const eventIds = events.map((event) => event.eventId);
    expect(new Set(eventIds).size).toBe(eventIds.length);
  });

  it("is dense + hot enough for a lively host cadence: enough surfacing events, no dead-air gaps, prompt first beat", () => {
    // Enough events to keep the host busy over the window.
    expect(events.length).toBeGreaterThanOrEqual(6);

    // Every event must clear the host-loop surfaceThreshold (0.6) so none is a
    // dead event that never narrates.
    for (const event of events) {
      expect(event.heatDelta).toBeGreaterThanOrEqual(0.6);
    }

    // No dead-air: ordered by ts, the first beat fires promptly and every
    // consecutive gap is at most 25s — a lively ~15-25s narration cadence.
    const tsAscending = events.map((event) => event.ts).sort((a, b) => a - b);
    expect(tsAscending[0]!).toBeLessThanOrEqual(3000);
    for (let i = 1; i < tsAscending.length; i++) {
      const prev = tsAscending[i - 1]!;
      const cur = tsAscending[i]!;
      expect(cur - prev).toBeLessThanOrEqual(25000);
    }

    // Official embeds only: every vantage points at a real Twitch player channel
    // URL with no leftover EXAMPLE_ placeholder.
    for (const event of events) {
      for (const vantage of event.vantages) {
        expect(vantage.embedUrl).toMatch(/^https:\/\/player\.twitch\.tv\/\?channel=/);
        expect(vantage.embedUrl).not.toContain("EXAMPLE_");
      }
    }
  });
});
