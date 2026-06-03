import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChannelSurfShell } from "../src/components/channel-surf-shell";
function makeEvent(eventId, vantages) {
    return {
        eventId,
        type: "clutch",
        narrative: `${eventId} narrative`,
        heatDelta: 0.5,
        novelty: 0.5,
        legibility: 0.5,
        confidenceTier: 1,
        source: { kind: "video" },
        vantages,
        ts: 0,
    };
}
describe("ChannelSurfShell", () => {
    it("shows the top-ranked event's highest-lensScore vantage on load with no channel chosen", () => {
        // The top event carries TWO official vantages with DISTINCT lensScores and embedUrls.
        // The higher-lensScore vantage is placed SECOND in the array so a naive vantages[0]
        // pick would choose the wrong one — selection must be by max lensScore, not position.
        const topVantageLowerScore = {
            streamId: "alpha-low",
            platform: "twitch",
            embedUrl: "https://player.twitch.tv/?channel=ALPHA_LOWER_LENS",
            offsetSec: 0,
            lensScore: 0.7,
        };
        const topVantageHigherScore = {
            streamId: "alpha-high",
            platform: "youtube",
            embedUrl: "https://www.youtube.com/embed/ALPHA_HIGHER_LENS",
            offsetSec: 0,
            lensScore: 0.92,
        };
        const secondEventVantage = {
            streamId: "bravo-only",
            platform: "kick",
            embedUrl: "https://player.kick.com/BRAVO",
            offsetSec: 0,
            lensScore: 0.88,
        };
        // Two events, in eventScore-desc order; the top event's best vantage is the target.
        const feed = {
            events: [
                { ...makeEvent("alpha", [topVantageLowerScore, topVantageHigherScore]), eventScore: 0.93 },
                { ...makeEvent("bravo", [secondEventVantage]), eventScore: 0.41 },
            ],
        };
        render(_jsx(ChannelSurfShell, { feed: feed }));
        // On load the player must already show the top event's MAX-lensScore vantage,
        // verbatim — never empty, never the lower-lensScore vantage, never another event.
        const iframe = screen.getByTitle("player");
        expect(iframe).toHaveAttribute("src", topVantageHigherScore.embedUrl);
    });
    it("switches the player to a channel's top vantage on click and follows each selection back and forth", async () => {
        // Two events with DISTINCT narratives and DISTINCT top-vantage embedUrls.
        // Each event gets one clearly-max-lensScore vantage so the chosen vantage is unambiguous.
        const URL_A = "https://www.youtube.com/embed/ALPHA_TOP";
        const URL_B = "https://player.kick.com/BRAVO_TOP";
        const alphaTop = {
            streamId: "alpha-top",
            platform: "youtube",
            embedUrl: URL_A,
            offsetSec: 0,
            lensScore: 0.95,
        };
        const alphaSecondary = {
            streamId: "alpha-secondary",
            platform: "twitch",
            embedUrl: "https://player.twitch.tv/?channel=ALPHA_SECONDARY",
            offsetSec: 0,
            lensScore: 0.4,
        };
        const bravoTop = {
            streamId: "bravo-top",
            platform: "kick",
            embedUrl: URL_B,
            offsetSec: 0,
            lensScore: 0.91,
        };
        const bravoSecondary = {
            streamId: "bravo-secondary",
            platform: "twitch",
            embedUrl: "https://player.twitch.tv/?channel=BRAVO_SECONDARY",
            offsetSec: 0,
            lensScore: 0.3,
        };
        // eventScore-desc: Alpha is the top event (loads first), Bravo is second.
        const feed = {
            events: [
                {
                    ...makeEvent("alpha", [alphaTop, alphaSecondary]),
                    narrative: "Alpha event narrative",
                    eventScore: 0.9,
                },
                {
                    ...makeEvent("bravo", [bravoTop, bravoSecondary]),
                    narrative: "Bravo event narrative",
                    eventScore: 0.5,
                },
            ],
        };
        const user = userEvent.setup();
        render(_jsx(ChannelSurfShell, { feed: feed }));
        // Sanity: starts on the top event's max-lensScore vantage.
        const iframe = screen.getByTitle("player");
        expect(iframe).toHaveAttribute("src", URL_A);
        // Surf to the second channel: the player must follow to Bravo's top vantage.
        await user.click(screen.getByRole("button", { name: /Bravo/ }));
        expect(iframe).toHaveAttribute("src", URL_B);
        // Surf back to the first channel: selection is the only thing that moves the player.
        await user.click(screen.getByRole("button", { name: /Alpha/ }));
        expect(iframe).toHaveAttribute("src", URL_A);
    });
});
