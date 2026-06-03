import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Player } from "../src/components/player";
import type { Vantage } from "../src/contracts";

describe("Player", () => {
  it("appends Twitch's required parent=<hostname> while preserving the official source and channel (ADR 0008)", () => {
    // A Twitch player embed (player.twitch.tv) — Twitch REQUIRES &parent=<host>
    // naming the embedding domain, or it refuses to render ([NoParent]).
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
    const src = iframe.getAttribute("src");
    expect(src).not.toBeNull();
    const value = src ?? "";

    // The official source + channel are preserved — never rehosted or rewritten.
    expect(value).toContain("player.twitch.tv");
    expect(value).toContain("channel=EXAMPLE_A");
    // ...and the mandated parent param is now appended, naming the runtime host.
    // jsdom's window.location.hostname defaults to "localhost".
    expect(value).toContain("parent=localhost");
  });

  it("renders a non-Twitch embedUrl byte-for-byte verbatim with no parent appended", () => {
    // Kick (and YouTube/TikTok) do not need parent — they must stay untouched.
    const vantage: Vantage = {
      streamId: "EXAMPLE_JC-stream",
      platform: "kick",
      embedUrl: "https://player.kick.com/EXAMPLE_JC",
      offsetSec: 0,
      lensScore: 0.5,
    };

    render(<Player vantage={vantage} />);

    const iframe = screen.getByTitle("player");

    // Byte-for-byte verbatim: official-embeds-only — no proxy, no rehost, no
    // rewrite, and no parent param added for non-Twitch sources.
    expect(iframe).toHaveAttribute("src", vantage.embedUrl);
  });
});
