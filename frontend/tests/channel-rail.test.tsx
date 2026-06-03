import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChannelRail } from "../src/components/channel-rail";
import type { PerceptionEvent, RankedFeed } from "../src/contracts";

function makeEvent(
  eventId: string,
  narrative: string,
  opts: { type?: PerceptionEvent["type"]; streamer?: string } = {},
): PerceptionEvent {
  return {
    eventId,
    type: opts.type ?? "clutch",
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
        ...(opts.streamer === undefined ? {} : { streamer: opts.streamer }),
      },
    ],
    ts: 0,
  };
}

describe("ChannelRail", () => {
  it("labels each channel with the spoiler-safe `type · streamer`, never the outcome-bearing narrative", () => {
    // ADR 0009 — the rail is a viewer-facing surface, so its label must come from SAFE
    // fields (`event.type` + the top vantage's `streamer`), never the outcome-bearing
    // `narrative`. The first event's narrative deliberately names an outcome ("to win the
    // round") so we can prove that token never reaches the rendered label.
    const feed: RankedFeed = {
      events: [
        {
          ...makeEvent("alpha", "1v3 retake clutch to win the round in the major semifinal", {
            type: "clutch",
            streamer: "Co-streamer A",
          }),
          eventScore: 0.92,
        },
        {
          ...makeEvent("bravo", "Speedrunner shaves four seconds off the world record", {
            type: "reveal",
            streamer: "Original runner",
          }),
          eventScore: 0.41,
        },
      ],
    };

    // The spoiler-safe label each channel should show, in feed order.
    const expectedLabels = ["clutch · Co-streamer A", "reveal · Original runner"];

    render(<ChannelRail feed={feed} />);

    // Exactly one channel per event.
    const channels = screen.getAllByRole("listitem");
    expect(channels).toHaveLength(feed.events.length);

    // Each channel shows its spoiler-safe `type · streamer` label, in feed order, and the
    // label names a surfable control (its accessible name is the new label).
    const renderedLabels = channels.map((channel) => channel.textContent ?? "");
    for (const [index, expected] of expectedLabels.entries()) {
      expect(renderedLabels[index]).toContain(expected);
      expect(screen.getByRole("button", { name: expected })).toBeInTheDocument();
    }

    // No channel renders the raw, outcome-bearing narrative.
    for (const event of feed.events) {
      expect(screen.queryByText(event.narrative)).not.toBeInTheDocument();
    }

    // No rendered label leaks the banned outcome token from the first event's narrative.
    for (const label of renderedLabels) {
      expect(label).not.toMatch(/win the round/i);
    }
  });

  it("shows a heat indicator per channel whose value tracks the event's heatDelta", () => {
    // Two events with DISTINCT heatDelta values so the indicator can't be a constant.
    const feed: RankedFeed = {
      events: [
        { ...makeEvent("alpha", "Falcons pull off the impossible reverse sweep"), heatDelta: 0.91, eventScore: 0.92 },
        { ...makeEvent("bravo", "Speedrunner shaves four seconds off the world record"), heatDelta: 0.55, eventScore: 0.41 },
      ],
    };

    render(<ChannelRail feed={feed} />);

    // One accessible heat indicator per channel, in feed order.
    const meters = screen.getAllByRole("meter");
    expect(meters).toHaveLength(feed.events.length);

    // Each indicator's reported value equals its event's heatDelta.
    for (const [index, event] of feed.events.entries()) {
      expect(meters[index]).toHaveAttribute("aria-valuenow", String(event.heatDelta));
    }
  });
});
