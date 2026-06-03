import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Player } from "../src/components/player";
import type { Vantage } from "../src/contracts";

describe("Player", () => {
  it("renders the vantage embedUrl verbatim as the iframe src (never rehosts or rewrites)", () => {
    // A recognizable OFFICIAL embed URL — exactly what the platform would hand us.
    const vantage: Vantage = {
      streamId: "EXAMPLE_A-stream",
      platform: "twitch",
      embedUrl: "https://player.twitch.tv/?channel=EXAMPLE_A",
      offsetSec: 0,
      lensScore: 0.5,
    };

    render(<Player vantage={vantage} />);

    // Locate the player iframe accessibly, by its title.
    const iframe = screen.getByTitle("player");

    // The src must equal the official embedUrl byte-for-byte: no proxy, no rehost,
    // no rewrite — this is the official-embeds-only invariant.
    expect(iframe).toHaveAttribute("src", vantage.embedUrl);
  });
});
