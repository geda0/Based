import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "../src/App.js";
import { events } from "../src/mocks/event-graph";
describe("App", () => {
    it("mounts the channel-surf shell from the mock event-graph, showing a channel and the top event's best vantage", () => {
        // Derive expectations from the mock so this stays honest if the sample changes.
        const topEvent = events[0];
        const bestVantage = topEvent.vantages.reduce((best, v) => v.lensScore > best.lensScore ? v : best);
        render(_jsx(App, {}));
        // A channel per mock event: the top event's narrative names a surfable button.
        expect(screen.getByRole("button", { name: topEvent.narrative })).toBeInTheDocument();
        // The player loads showing the top event's max-lensScore vantage, verbatim.
        expect(screen.getByTitle("player")).toHaveAttribute("src", bestVantage.embedUrl);
    });
});
