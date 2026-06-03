import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChannelRail } from "../src/components/channel-rail";
function makeEvent(eventId, narrative) {
    return {
        eventId,
        type: "clutch",
        narrative,
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
    };
}
describe("ChannelRail", () => {
    it("lists one channel per event in events order, each showing its narrative", () => {
        // Two events with distinct, recognizable narratives, in eventScore-desc order.
        const feed = {
            events: [
                { ...makeEvent("alpha", "Falcons pull off the impossible reverse sweep"), eventScore: 0.92 },
                { ...makeEvent("bravo", "Speedrunner shaves four seconds off the world record"), eventScore: 0.41 },
            ],
        };
        render(_jsx(ChannelRail, { feed: feed }));
        // Exactly one channel per event.
        const channels = screen.getAllByRole("listitem");
        expect(channels).toHaveLength(feed.events.length);
        // Each event's narrative is visible to the user.
        for (const event of feed.events) {
            expect(screen.getByText(event.narrative)).toBeInTheDocument();
        }
        // The narratives appear in the same order as feed.events.
        const renderedNarratives = channels.map((channel) => channel.textContent);
        for (const [index, event] of feed.events.entries()) {
            expect(renderedNarratives[index]).toContain(event.narrative);
        }
    });
    it("shows a heat indicator per channel whose value tracks the event's heatDelta", () => {
        // Two events with DISTINCT heatDelta values so the indicator can't be a constant.
        const feed = {
            events: [
                { ...makeEvent("alpha", "Falcons pull off the impossible reverse sweep"), heatDelta: 0.91, eventScore: 0.92 },
                { ...makeEvent("bravo", "Speedrunner shaves four seconds off the world record"), heatDelta: 0.55, eventScore: 0.41 },
            ],
        };
        render(_jsx(ChannelRail, { feed: feed }));
        // One accessible heat indicator per channel, in feed order.
        const meters = screen.getAllByRole("meter");
        expect(meters).toHaveLength(feed.events.length);
        // Each indicator's reported value equals its event's heatDelta.
        for (const [index, event] of feed.events.entries()) {
            expect(meters[index]).toHaveAttribute("aria-valuenow", String(event.heatDelta));
        }
    });
});
