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
});
