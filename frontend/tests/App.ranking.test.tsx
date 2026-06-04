import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "../src/App.js";

// M4: the App must rank its feed with the REAL ranker (rankFeed), not the M2
// `eventScore = heatDelta` placeholder. We pin a REORDERING fixture of two
// events whose blended rank inverts their raw-heat order, so the choice of
// ranker is observable in the player: the player loads the top-RANKED event's
// vantage.
//
//   X (evt_heat):  heatDelta 0.90, novelty 0.05, legibility 0.05, tier 4
//                  → highest raw heat, weakest blend.
//   Y (evt_blend): heatDelta 0.70, novelty 0.98, legibility 0.98, tier 1
//                  → lower heat, maxed blend.
//
// rankFeed's weights (heat .40, novelty .25, legibility .20, confidence .15;
// confidenceFactor(tier) = (5 − tier)/4):
//   eventScore(X) = .40·0.90 + .25·0.05 + .20·0.05 + .15·0.25 = 0.4200
//   eventScore(Y) = .40·0.70 + .25·0.98 + .20·0.98 + .15·1.00 = 0.8710
// → the real ranker ranks Y FIRST; the heatDelta placeholder ranks X first.
//
// `vi.mock` is hoisted, so this fixture is defined INLINE inside the factory —
// it cannot reference outer variables. Its narratives carry no outcome tokens,
// keeping the on-screen surface spoiler-safe (ADR 0006). A separate file from
// App.test.tsx so this fixture is independent of that one's demo mock.
vi.mock("../src/mocks/event-graph", () => {
  const digest =
    "Two streams are heating up — a clutch round is building in a Valorant major, and a speedrunner is lining up a big trick.";

  const events = [
    {
      eventId: "evt_heat",
      type: "clutch",
      narrative: "A tense retake is building in the Valorant major semifinal",
      heatDelta: 0.9,
      novelty: 0.05,
      legibility: 0.05,
      confidenceTier: 4,
      source: { kind: "broadcast", ref: "valorant_official_feed" },
      vantages: [
        {
          streamId: "vheat_main",
          platform: "twitch",
          embedUrl: "https://player.twitch.tv/?channel=rifftrax",
          offsetSec: 0,
          lensScore: 0.9,
          streamer: "rifftrax",
        },
      ],
      ts: 1,
    },
    {
      eventId: "evt_blend",
      type: "reveal",
      narrative: "A speedrunner is lining up the final trick of the run",
      heatDelta: 0.7,
      novelty: 0.98,
      legibility: 0.98,
      confidenceTier: 1,
      source: { kind: "original" },
      vantages: [
        {
          streamId: "vblend_main",
          platform: "twitch",
          embedUrl: "https://player.twitch.tv/?channel=caedrel247",
          offsetSec: 0,
          lensScore: 0.88,
          streamer: "caedrel247",
        },
      ],
      ts: 45000,
    },
  ];

  return { digest, events };
});

describe("App ranking", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("ranks its feed by the real ranker, not raw heatDelta (the player shows the blend-top, not the heat-top)", () => {
    // The shell renders the player on mount — no Start-watching gesture needed.
    render(<App />);

    const playerSrc = screen.getByTitle("player").getAttribute("src") ?? "";

    // The player loads the top-RANKED event's vantage. By the blend, Y (caedrel247)
    // outranks X despite X's higher raw heat, so the player must show Y.
    expect(playerSrc).toContain("channel=caedrel247");
    // …and NOT the raw-heat top, X (rifftrax) — the placeholder would pick this one.
    expect(playerSrc).not.toContain("channel=rifftrax");

    // The rail's first channel button also names the blend-top's streamer,
    // strengthening "ranked order" (index 0 = top-ranked event; `!` narrows away
    // noUncheckedIndexedAccess' undefined).
    const railButtons = screen.getAllByRole("button", { name: /·/ });
    const firstRailButton = railButtons[0]!;
    expect(firstRailButton).toHaveAccessibleName(/caedrel247/);
  });
});
