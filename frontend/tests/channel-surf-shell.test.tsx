import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChannelSurfShell } from "../src/components/channel-surf-shell";
import type { HostDirective, PerceptionEvent, RankedFeed, Vantage } from "../src/contracts";

function makeEvent(eventId: string, vantages: Vantage[]): PerceptionEvent {
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
    const topVantageLowerScore: Vantage = {
      streamId: "alpha-low",
      platform: "twitch",
      embedUrl: "https://player.twitch.tv/?channel=ALPHA_LOWER_LENS",
      offsetSec: 0,
      lensScore: 0.7,
    };
    const topVantageHigherScore: Vantage = {
      streamId: "alpha-high",
      platform: "youtube",
      embedUrl: "https://www.youtube.com/embed/ALPHA_HIGHER_LENS",
      offsetSec: 0,
      lensScore: 0.92,
    };
    const secondEventVantage: Vantage = {
      streamId: "bravo-only",
      platform: "kick",
      embedUrl: "https://player.kick.com/BRAVO",
      offsetSec: 0,
      lensScore: 0.88,
    };

    // Two events, in eventScore-desc order; the top event's best vantage is the target.
    const feed: RankedFeed = {
      events: [
        { ...makeEvent("alpha", [topVantageLowerScore, topVantageHigherScore]), eventScore: 0.93 },
        { ...makeEvent("bravo", [secondEventVantage]), eventScore: 0.41 },
      ],
    };

    render(<ChannelSurfShell feed={feed} />);

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

    const alphaTop: Vantage = {
      streamId: "alpha-top",
      platform: "youtube",
      embedUrl: URL_A,
      offsetSec: 0,
      lensScore: 0.95,
    };
    const alphaSecondary: Vantage = {
      streamId: "alpha-secondary",
      platform: "twitch",
      embedUrl: "https://player.twitch.tv/?channel=ALPHA_SECONDARY",
      offsetSec: 0,
      lensScore: 0.4,
    };
    const bravoTop: Vantage = {
      streamId: "bravo-top",
      platform: "kick",
      embedUrl: URL_B,
      offsetSec: 0,
      lensScore: 0.91,
    };
    const bravoSecondary: Vantage = {
      streamId: "bravo-secondary",
      platform: "twitch",
      embedUrl: "https://player.twitch.tv/?channel=BRAVO_SECONDARY",
      offsetSec: 0,
      lensScore: 0.3,
    };

    // eventScore-desc: Alpha is the top event (loads first), Bravo is second.
    const feed: RankedFeed = {
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
    render(<ChannelSurfShell feed={feed} />);

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

  it("cuts the player to the directive's target vantage when a cutTo directive arrives", () => {
    // The default-on-load vantage is the top event's max-lensScore vantage. The cutTo
    // target deliberately is NOT that vantage: it belongs to the SECOND event and is even
    // that event's LOWER-lensScore vantage — so neither the load default nor any naive
    // "top vantage" pick can produce TARGET_URL. Only honoring the directive can.
    const DEFAULT_TOP_URL = "https://www.youtube.com/embed/ALPHA_DEFAULT_TOP";
    const TARGET_URL = "https://player.kick.com/TARGET";

    const alphaTop: Vantage = {
      streamId: "alpha-top",
      platform: "youtube",
      embedUrl: DEFAULT_TOP_URL,
      offsetSec: 0,
      lensScore: 0.95,
    };
    const bravoTop: Vantage = {
      streamId: "bravo-top",
      platform: "twitch",
      embedUrl: "https://player.twitch.tv/?channel=BRAVO_TOP",
      offsetSec: 0,
      lensScore: 0.82,
    };
    const target: Vantage = {
      streamId: "v_target",
      platform: "kick",
      embedUrl: TARGET_URL,
      offsetSec: 0,
      lensScore: 0.3,
    };

    // eventScore-desc: Alpha is the top event (load default), Bravo holds the target vantage.
    const feed: RankedFeed = {
      events: [
        { ...makeEvent("alpha", [alphaTop]), eventScore: 0.9 },
        { ...makeEvent("bravo", [bravoTop, target]), eventScore: 0.5 },
      ],
    };

    // Object literal with the spoilerSafe invariant; points at an existing feed vantage.
    const cutDirective: HostDirective = {
      action: "cutTo",
      cutToVantage: { streamId: "v_target", embedUrl: TARGET_URL },
      spoilerSafe: true,
    };

    render(<ChannelSurfShell feed={feed} directive={cutDirective} />);

    // The directive overrides the load default: the player shows the target vantage verbatim.
    const iframe = screen.getByTitle("player");
    expect(iframe).toHaveAttribute("src", TARGET_URL);
  });

  it("follows the user's channel click even after the host has cut the player to a vantage", async () => {
    // §12.6 — the host must never trap the user. A cutTo directive parks the player on
    // Bravo's vantage; the user then clicks the OTHER event (Alpha). Alpha's top-vantage
    // URL is distinct from BOTH the load default and the cut target, so the only way the
    // player can show ALPHA_TOP_URL is if the manual selection overrides the prior host cut.
    const ALPHA_TOP_URL = "https://www.youtube.com/embed/ALPHA_TOP";
    const CUT_TARGET_URL = "https://player.kick.com/BRAVO_CUT_TARGET";

    const alphaTop: Vantage = {
      streamId: "alpha-top",
      platform: "youtube",
      embedUrl: ALPHA_TOP_URL,
      offsetSec: 0,
      lensScore: 0.95,
    };
    const bravoTop: Vantage = {
      streamId: "bravo-top",
      platform: "twitch",
      embedUrl: "https://player.twitch.tv/?channel=BRAVO_TOP",
      offsetSec: 0,
      lensScore: 0.82,
    };
    const bravoCutTarget: Vantage = {
      streamId: "v_cut_target",
      platform: "kick",
      embedUrl: CUT_TARGET_URL,
      offsetSec: 0,
      lensScore: 0.3,
    };

    // eventScore-desc: Alpha is the top event, Bravo holds the cut-target vantage.
    const feed: RankedFeed = {
      events: [
        { ...makeEvent("alpha", [alphaTop]), narrative: "Alpha event narrative", eventScore: 0.9 },
        {
          ...makeEvent("bravo", [bravoTop, bravoCutTarget]),
          narrative: "Bravo event narrative",
          eventScore: 0.5,
        },
      ],
    };

    // The host cuts the player to Bravo's lower-lensScore vantage.
    const cutDirective: HostDirective = {
      action: "cutTo",
      cutToVantage: { streamId: "v_cut_target", embedUrl: CUT_TARGET_URL },
      spoilerSafe: true,
    };

    const user = userEvent.setup();
    render(<ChannelSurfShell feed={feed} directive={cutDirective} />);

    // Precondition: the directive has parked the player on the cut target (NOT the load default).
    const iframe = screen.getByTitle("player");
    expect(iframe).toHaveAttribute("src", CUT_TARGET_URL);

    // The user surfs to a DIFFERENT channel. The player must follow the user, not stay trapped.
    await user.click(screen.getByRole("button", { name: /Alpha/ }));
    expect(iframe).toHaveAttribute("src", ALPHA_TOP_URL);
  });
});
