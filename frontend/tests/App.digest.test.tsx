import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";

// M4 — the "while you were gone" DIGEST. On Start-watching, the host voices a
// one-time spoiler-safe catch-up FIRST — before the live feed surfaces any
// event — exactly once, and never before the gesture. We pin a FIXED in-test
// fixture so this stays honest if the demo mock changes. `vi.mock` is hoisted,
// so the fixture is defined INLINE inside the factory — it cannot reference
// outer variables.
//
// The digest is anticipation-only (ADR 0006/0009): a NON-EMPTY, spoiler-safe
// catch-up with NO outcome token ("a major match is live", "heating up" — never
// "won", "world record", "to win the round"). THREE surfacing events spaced ~15s
// apart (ts 1 / 16000 / 32000) each clear the App's 12s silence budget, so they
// drive THREE post-digest live lines — letting us pin the ORDER (digest → event)
// and prove the digest is voiced EXACTLY ONCE across the whole run (cost-gating),
// never re-voiced per event. Every event scores well above the 0.6 surface
// threshold (heat .9x, novelty .8, legibility .9x, tier 1).
vi.mock("../src/mocks/event-graph", () => {
  const digest =
    "Catching you up — a major semifinal is live and a speedrun attempt is heating up.";

  const events = [
    {
      eventId: "evt_major_live",
      type: "clutch",
      narrative: "A tense round is building in the Valorant major semifinal",
      heatDelta: 0.91,
      novelty: 0.8,
      legibility: 0.95,
      confidenceTier: 1,
      source: { kind: "broadcast", ref: "valorant_official_feed" },
      vantages: [
        {
          streamId: "vmajor_main",
          platform: "twitch",
          embedUrl: "https://player.twitch.tv/?channel=rifftrax",
          offsetSec: 0,
          lensScore: 0.92,
          streamer: "rifftrax",
        },
      ],
      ts: 1,
    },
    {
      eventId: "evt_speedrun_push",
      type: "drama",
      narrative: "A run is closing on a personal best in the speedrun marathon",
      heatDelta: 0.87,
      novelty: 0.82,
      legibility: 0.9,
      confidenceTier: 1,
      source: { kind: "broadcast", ref: "gdq_official_feed" },
      vantages: [
        {
          streamId: "vspeed_main",
          platform: "twitch",
          embedUrl: "https://player.twitch.tv/?channel=gamesdonequick",
          offsetSec: 0,
          lensScore: 0.9,
          streamer: "gamesdonequick",
        },
      ],
      ts: 16000,
    },
    {
      eventId: "evt_clutch_round",
      type: "clutch",
      narrative: "A 1v3 is building on the bomb site",
      heatDelta: 0.93,
      novelty: 0.78,
      legibility: 0.92,
      confidenceTier: 1,
      source: { kind: "broadcast", ref: "valorant_official_feed" },
      vantages: [
        {
          streamId: "vclutch_main",
          platform: "twitch",
          embedUrl: "https://player.twitch.tv/?channel=shroud",
          offsetSec: 0,
          lensScore: 0.91,
          streamer: "shroud",
        },
      ],
      ts: 32000,
    },
  ];

  return { digest, events };
});

import { digest } from "../src/mocks/event-graph";

describe("App digest", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("voices the 'while you were gone' digest first on Start watching, exactly once, and never before the gesture", async () => {
    // The host loop's speak side-effect defaults to window.speechSynthesis, which
    // jsdom lacks — stub the Web Speech surface so voicing can't crash the env.
    vi.useFakeTimers();
    vi.stubGlobal("speechSynthesis", { speak: () => {}, cancel: () => {} });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        text: string;
        constructor(t: string) {
          this.text = t;
        }
      },
    );

    // The /narrate client resolves a known non-empty line so the surfacing event
    // yields a real speak directive (the narrating-host-loop drops blank lines).
    const eventLine = "the major just turned — watch this";
    const narrate = async () => eventLine;

    // A recording VoiceNarrator: each speak() pushes its text in call order. The
    // DIGEST's speak is resolvable on demand (resolveDigest) so we can model it
    // playing then finishing; event speaks stay pending (we only need their
    // order/count). This pins single-active-voice: the event must voice only
    // AFTER the digest's speak resolves, never overlapping it.
    let resolveDigest: (() => void) | undefined;
    const spoken: string[] = [];
    const voice = {
      speak: (t: string) => {
        spoken.push(t);
        if (t === digest) return new Promise<void>((r) => (resolveDigest = r));
        return new Promise<void>(() => {});
      },
    };

    render(<App narrate={narrate} voice={voice} />);

    // 1. Zero on mount: the digest must wait for the Start gesture — nothing is
    //    voiced before the user opts in.
    expect(spoken.length).toBe(0);

    // 2. Digest first on Start: clicking "Start watching" voices the catch-up
    //    digest FIRST — before the feed's first event (ts:1) has fired. The 0ms
    //    flush lets the digest emit but does NOT advance past ts:1.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /start watching/i }));
      await vi.advanceTimersByTimeAsync(0);
    });
    const voicedDigest = spoken[0] ?? "";
    expect(voicedDigest).toBe(digest);
    expect(spoken.length).toBe(1);

    // 3. Single active voice — event follows the digest, never overlaps it, and
    //    the digest is voiced exactly once across everything spoken (cost-gating).
    // 3a. While the digest's speak is still in flight, advancing past ts:1 must
    //     NOT voice the event — no second concurrent voice over the digest.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(spoken.length).toBe(1); // still just the digest — event did NOT overlap it
    // 3b. Once the digest's speak resolves, the next surfacing event is voiced
    //     AFTER it, and the digest is never re-voiced (exactly once).
    await act(async () => {
      resolveDigest?.();
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(spoken[1] ?? "").toBe(eventLine);
    expect(spoken.filter((t) => t === digest).length).toBe(1);
  });

  it("voices a spoiler-safe digest on Start — non-empty and naming no outcome", async () => {
    // INVARIANT (spoiler-safety, ADR 0006/0009): the host VOICES the digest as the
    // "while you were gone" catch-up on Start, so the voiced text must meet the same
    // outcome-free bar as the on-screen rail. event-graph.test.ts guards the mock
    // STRING; this guards the App VOICING PATH — that what actually reaches the voice
    // is non-empty and leaks no outcome (mirrors the rail's banned tokens).
    vi.useFakeTimers();
    vi.stubGlobal("speechSynthesis", { speak: () => {}, cancel: () => {} });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        text: string;
        constructor(t: string) {
          this.text = t;
        }
      },
    );

    // narrate resolves a known safe line; never-resolving speak pins what is voiced.
    const narrate = async () => "the major just turned — watch this";
    const spoken: string[] = [];
    const voice = {
      speak: (t: string) => {
        spoken.push(t);
        return new Promise<void>(() => {});
      },
    };

    render(<App narrate={narrate} voice={voice} />);

    // Arrange + Act: opt in, flush only the digest (0ms — before any timeline event).
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /start watching/i }));
      await vi.advanceTimersByTimeAsync(0);
    });

    // Assert: the FIRST thing voiced is the digest — non-empty and outcome-free.
    const voicedDigest = spoken[0] ?? "";
    expect(voicedDigest.trim().length).toBeGreaterThan(0);
    expect(voicedDigest).not.toMatch(/world record/i);
    expect(voicedDigest).not.toMatch(/to win the round/i);
  });

  it("voices the digest exactly once across the whole run — never re-voiced per surfacing event", async () => {
    // INVARIANT (cost-gating, ADR 0003): the digest is a one-time catch-up on Start,
    // NOT a per-event firehose. With THREE events surfacing (ts 1 / 16000 / 32000, all
    // clearing the 12s budget), advancing past ALL of them must still show the digest
    // voiced EXACTLY ONCE — proving it is voiced on Start and never re-voiced per event.
    vi.useFakeTimers();
    vi.stubGlobal("speechSynthesis", { speak: () => {}, cancel: () => {} });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        text: string;
        constructor(t: string) {
          this.text = t;
        }
      },
    );

    // Each surfacing event resolves a non-empty line distinct from the digest.
    const narrate = async () => "watch this — eyes on the action";
    const spoken: string[] = [];
    const voice = {
      speak: (t: string) => {
        spoken.push(t);
        return new Promise<void>(() => {});
      },
    };

    render(<App narrate={narrate} voice={voice} />);

    // Before the gesture: zero digest (nothing voiced at all).
    expect(spoken.filter((t) => t === digest).length).toBe(0);

    // Act: opt in, then advance PAST all three events (40s, across flush turns so each
    // surfacing's async narrate resolves before the next timer fires).
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /start watching/i }));
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });

    // Assert: the digest is voiced exactly once across the entire run — never per event.
    expect(spoken.filter((t) => t === digest).length).toBe(1);
  });

  it("does not voice a surfacing event while the digest is still being voiced — single active voice", async () => {
    // STAGING DEFECT (overlapping voices): on Start the host voices the long
    // "while you were gone" digest fire-and-forget, then immediately starts the
    // feed. While the digest is STILL playing, the first surfacing event calls
    // voice.speak() independently — a SECOND concurrent audio stream over the
    // first. The fix is a single-active-voice guard: only one utterance audible
    // at a time; a new speak while one is in flight is dropped. We model the
    // digest as never-resolving so it stays "playing" for the whole window — so
    // if an event speaks, that is a genuine overlap, not a sequential follow-up.
    vi.useFakeTimers();
    vi.stubGlobal("speechSynthesis", { speak: () => {}, cancel: () => {} });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        text: string;
        constructor(t: string) {
          this.text = t;
        }
      },
    );

    // narrate resolves a known safe line so a surfacing event WOULD voice if
    // nothing guarded it; the recording voice NEVER resolves, so whatever speaks
    // first (the digest) stays in flight for the entire test.
    const narrate = async () => "the major just turned — watch this";
    const calls: string[] = [];
    const voice = {
      speak: (t: string) => {
        calls.push(t);
        return new Promise<void>(() => {});
      },
    };

    render(<App narrate={narrate} voice={voice} />);

    // Act 1: opt in and flush 0ms — the digest is voiced first, before ts:1.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /start watching/i }));
      await vi.advanceTimersByTimeAsync(0);
    });
    // Only the digest has spoken so far (it is the first, and once fixed the ONLY,
    // utterance — it never resolves, so the voice is busy from here on).
    expect(calls).toHaveLength(1);
    expect(calls[0]!).toBe(digest);

    // Act 2: advance PAST the first event's surfacing AND the 12s host-loop
    // silence budget (mock events are ~15s apart) so an event WOULD narrate.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });

    // Assert (load-bearing): the digest is STILL the only thing voiced. With the
    // single-active guard, the surfacing event's speak is dropped while the digest
    // plays — no second concurrent voice. (Today this fails: the event also calls
    // voice.speak, so calls has length 2 — proving the overlap.)
    expect(calls).toHaveLength(1);
  });
});
