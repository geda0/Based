import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { App } from "../src/App.js";

// Decouple these tests from the shared demo event-graph: pin them to a FIXED
// in-test fixture so the demo mock can be enriched (more events, closer
// together) for liveliness without breaking the timing-coupled assertions here.
// This fixture reproduces the demo mock as it stood when these tests were
// written — the same 3 events, timings (ts 1 / 45000 / 90000), heatDeltas
// (0.91 / 0.78 / 0.55), vantages, and outcome-bearing narratives (kept so the
// spoiler-leak assertion in test #1 stays meaningful). `vi.mock` is hoisted, so
// the fixture is defined INLINE inside the factory — it cannot reference outer
// variables. Both <App/> and the tests now derive from this single fixture.
vi.mock("../src/mocks/event-graph", () => {
  const digest = "";

  const events = [
    {
      eventId: "evt_major_semi",
      type: "clutch",
      narrative:
        "1v3 retake clutch to win the round in the Valorant major semifinal",
      heatDelta: 0.91,
      novelty: 0.8,
      legibility: 0.95,
      confidenceTier: 1,
      source: { kind: "broadcast", ref: "valorant_official_feed" },
      vantages: [
        {
          streamId: "vmajor_co_a",
          platform: "twitch",
          embedUrl: "https://player.twitch.tv/?channel=rifftrax",
          offsetSec: 6,
          lensScore: 0.92,
          streamer: "rifftrax",
        },
        {
          streamId: "vmajor_off",
          platform: "twitch",
          embedUrl: "https://player.twitch.tv/?channel=247jynxzi",
          offsetSec: 0,
          lensScore: 0.7,
          streamer: "247jynxzi",
        },
      ],
      ts: 1,
    },
    {
      eventId: "evt_speedrun_wr",
      type: "reveal",
      narrative:
        "Speedrunner attempting the final trick for a world record, chat going wild",
      heatDelta: 0.78,
      novelty: 0.9,
      legibility: 0.9,
      confidenceTier: 2,
      source: { kind: "original" },
      vantages: [
        {
          streamId: "vrun_main",
          platform: "twitch",
          embedUrl: "https://player.twitch.tv/?channel=caedrel247",
          offsetSec: 0,
          lensScore: 0.88,
          streamer: "caedrel247",
        },
      ],
      ts: 45000,
    },
    {
      eventId: "evt_jc_drama",
      type: "drama",
      narrative:
        "Slow-building disagreement on a Just Chatting stream; chat is split",
      heatDelta: 0.55,
      novelty: 0.4,
      legibility: 0.7,
      confidenceTier: 3,
      source: { kind: "original" },
      vantages: [
        {
          streamId: "vjc_main",
          platform: "twitch",
          embedUrl: "https://player.twitch.tv/?channel=lirik_247",
          offsetSec: 0,
          lensScore: 0.6,
          streamer: "lirik_247",
        },
      ],
      ts: 90000,
    },
  ];

  return { digest, events };
});

import { events } from "../src/mocks/event-graph";

describe("App", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // WDC: the feed/host is gated behind a user gesture. Every test that advances
  // fake time to drive the feed must first click "Start watching", or no event
  // will ever surface under the new contract.
  const startWatching = async () => {
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /start watching/i }));
      await vi.advanceTimersByTimeAsync(0);
    });
  };

  it("mounts the channel-surf shell from the mock event-graph, showing a channel and the top event's best vantage", () => {
    // Derive expectations from the mock so this stays honest if the sample changes.
    const topEvent = events[0]!;
    const bestVantage = topEvent.vantages.reduce((best, v) =>
      v.lensScore > best.lensScore ? v : best,
    );

    render(<App />);

    // A channel per mock event: the top event's spoiler-safe `type · streamer` label
    // (ADR 0009) names a surfable button — NOT its outcome-bearing narrative. The mock
    // top event is `clutch` with top-vantage streamer "Co-streamer A".
    expect(
      screen.getByRole("button", { name: `${topEvent.type} · ${bestVantage.streamer}` }),
    ).toBeInTheDocument();

    // Spoiler-leak closed across the whole surface: no rail label on screen leaks a
    // banned outcome token from the mock narratives ("…to win the round", "…world record").
    expect(document.body).not.toHaveTextContent(/to win the round/i);
    expect(document.body).not.toHaveTextContent(/world record/i);

    // The player loads showing the top event's max-lensScore vantage. That vantage
    // is a Twitch embed (player.twitch.tv), so the Player preserves the official
    // source + channel and appends Twitch's mandated parent=<host> (ADR 0008).
    // Derive the channel from the mock so this stays honest if the sample changes;
    // jsdom's window.location.hostname defaults to "localhost".
    const channel = new URL(bestVantage.embedUrl).searchParams.get("channel");
    expect(channel).not.toBeNull();
    const src = screen.getByTitle("player").getAttribute("src") ?? "";
    expect(src).toContain("player.twitch.tv");
    expect(src).toContain(`channel=${channel}`);
    expect(src).toContain("parent=localhost");
  });

  it("does not start the feed or wake the host until the 'Start watching' gesture is clicked", async () => {
    // WDC: the host must NOT wake on mount. Starting the feed in a mount effect
    // wakes the host with no user gesture (wrong UX) AND creates the AudioContext
    // pre-gesture, so the browser blocks the host's audio. The feed must start —
    // and the host may wake — ONLY after a "Start watching" click.
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

    // The /narrate client resolves a known non-empty line so a surface yields a
    // real speak directive (the narrating-host-loop drops blank narrations).
    const narrate = async () => "the Major just turned — watch this";

    // A counting VoiceNarrator: each speak() bumps the count. A never-resolving
    // promise is fine — this test pins WHEN the App voices, not drain.
    let speakCount = 0;
    const voice = {
      speak: () => {
        speakCount += 1;
        return new Promise<void>(() => {});
      },
    };

    render(<App narrate={narrate} voice={voice} />);

    // Load-bearing: advance fake time PAST the first mock event (ts:1) WITHOUT
    // clicking. The feed is gated, so nothing surfaces: the host stays idle and
    // the voice is never asked to speak. (This proves the feed is GATED, not just
    // "not yet fired".)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(screen.getByRole("status")).toHaveTextContent(/idle/i);
    expect(screen.getByRole("status")).not.toHaveTextContent(/speaking/i);
    expect(speakCount).toBe(0);

    // The gesture exists: a "Start watching" control names the affordance.
    expect(
      screen.getByRole("button", { name: /start watching/i }),
    ).toBeInTheDocument();

    // Click it — now the feed starts. Advance past the first mock event (ts:1):
    // the host wakes and the line is voiced.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /start watching/i }));
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(screen.getByRole("status")).toHaveTextContent(/speaking/i);
    expect(speakCount).toBeGreaterThanOrEqual(1);
  });

  it("routes the surfacing event through the injected narrate client and wakes the host into the speaking state", async () => {
    // The host loop's speak side-effect defaults to window.speechSynthesis, which
    // jsdom lacks — stub the Web Speech surface so the character can speak without
    // crashing the environment.
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

    // M3: the host's utterance must come from the /narrate client, not a canned line.
    // Inject a stub that records calls (proving cost-gated narration fired) and
    // resolves a known line for the character to speak.
    const narrateCalls: unknown[] = [];
    const narrate = async (i: unknown) => {
      narrateCalls.push(i);
      return "the Major just turned — watch this";
    };

    render(<App narrate={narrate} />);
    await startWatching();

    // The first mock event (heatDelta 0.91) clears the default surfaceThreshold and
    // fires at ts: 1. Advance fake time past it; the async narrate resolves within
    // the flush (no waitFor under fake timers).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    // M3 load-bearing assertion: a surfacing event routed through the /narrate client
    // (cost-gated — only fires because the loop surfaced, not on the idle firehose).
    expect(narrateCalls.length).toBeGreaterThanOrEqual(1);

    // The host woke: the hot event drove a `speak` directive — now on the narrated
    // line — into the character.
    expect(screen.getByRole("status")).toHaveTextContent(/speaking/i);
  });

  it("keeps /narrate calls bounded on the default client path, never storming on re-render (cost-gating)", async () => {
    // D1 regression: <App/> with NO narrate prop must use the real default
    // createNarrateClient() — the production path. The cost-gating invariant has
    // to hold there too: a surfacing event spends ONE LLM call, never a storm.
    // (The existing cost-gating unit test injects a STABLE client, so it never
    // exercised the default-client identity churn that drives the storm.)
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

    // Stub global fetch so the default client's /narrate POST records each call
    // and resolves a valid { utterance } the character can speak.
    const narrateCalls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      if (String(url).includes("/narrate")) narrateCalls.push(String(url));
      return {
        ok: true,
        json: async () => ({ utterance: "a short test line" }),
      } as Response;
    });

    // No narrate prop → the real default createNarrateClient() (the buggy path).
    render(<App />);
    await startWatching();

    // Advance ~3s of feed time across several flush turns. Only the first mock
    // event (ts: 1, heatDelta 0.91) surfaces in this window — events 2/3 fire at
    // ts 45000/90000. Each turn pumps the render cascade; no waitFor under fake
    // timers. Separate turns matter: D1's storm escalates per render turn (the
    // effect re-subscribes the bus + re-arms the feed every re-render), so a
    // single advanceTimersByTimeAsync would collapse the window and mask it.
    for (let i = 0; i < 30; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
    }

    // Cost-gating: one surfacing event in 3s = at most one /narrate call (+1
    // headroom). The D1 storm re-fires the ts:1 feed timer on every re-render,
    // driving this far higher (one call per render turn).
    expect(narrateCalls.length).toBeLessThanOrEqual(2);
  });

  it("voices the /narrate-produced line through the injected VoiceNarrator, not Web Speech", async () => {
    // LV1: the voicing transport moves off Web Speech onto the injected
    // VoiceNarrator (native Gemini Live audio). The /narrate TEXT path is
    // unchanged — it still produces the utterance; only the speak() sink changes.
    vi.useFakeTimers();
    // Keep the Web Speech stubs in case the App constructs a default voice that
    // touches these globals at module load — this test injects `voice`, so the
    // real voicing must NOT go through them.
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

    // The /narrate client resolves the host's line (unchanged from M3).
    const narrate = async () => "the Major just turned — watch this";

    // The injected VoiceNarrator records what it is asked to speak. Its speak()
    // returns a never-resolving promise — this test pins only that the narrated
    // line reaches the injected narrator, not the drain-coupled revert (next cycle).
    const spoken: string[] = [];
    const voice = {
      speak: (t: string) => {
        spoken.push(t);
        return new Promise<void>(() => {});
      },
    };

    render(<App narrate={narrate} voice={voice} />);
    await startWatching();

    // The first mock event (heatDelta 0.91) clears surfaceThreshold and fires at
    // ts: 1; advance past it so the surfacing directive drives the voicing path.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    // Load-bearing: the surfaced line was voiced through the injected
    // VoiceNarrator (called once with the /narrate-produced utterance), proving
    // Web Speech is no longer the voicing path.
    expect(spoken).toEqual(["the Major just turned — watch this"]);
  });

  it("reverts the host to idle when the injected voice.speak promise drains, without waiting for the speakingMs timer", async () => {
    // LV1 (ADR 0007 §4 — drain-coupled revert): "speaking" must reflect audio
    // actually playing. The host stays speaking while voice.speak()'s promise is
    // pending and falls quiet the moment it RESOLVES (the utterance's audio has
    // drained) — NOT when the Character's internal speakingMs timer fires.
    vi.useFakeTimers();
    // Web Speech stubs kept only in case a default voice touches these globals at
    // module load; this test injects `voice`, so the real drain comes from it.
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

    // The /narrate client resolves the host's line (unchanged from M3).
    const narrate = async () => "the Major just turned — watch this";

    // A controllable VoiceNarrator: speak() returns a pending promise whose
    // resolver we capture, so the test drives exactly when the audio "drains".
    let resolveSpeak: (() => void) | undefined;
    const voice = {
      speak: () => new Promise<void>((res) => { resolveSpeak = res; }),
    };

    render(<App narrate={narrate} voice={voice} />);
    await startWatching();

    // The first mock event (heatDelta 0.91) clears surfaceThreshold and fires at
    // ts: 1; advance past it so the surfacing directive drives the voicing path.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    // Precondition: voice.speak was called and its promise is still pending, so
    // the host is mid-utterance — speaking.
    expect(screen.getByRole("status")).toHaveTextContent(/speaking/i);

    // Drain it: resolve the speak promise and flush a single 0ms tick. We do NOT
    // advance to the 4000ms speakingMs window — the revert must come from the
    // drain, not the Character's fallback timer.
    await act(async () => {
      resolveSpeak?.();
      await vi.advanceTimersByTimeAsync(0);
    });

    // The audio drained → the host fell quiet on its own, well before speakingMs.
    expect(screen.getByRole("status")).toHaveTextContent(/idle/i);
    expect(screen.getByRole("status")).not.toHaveTextContent(/speaking/i);
  });

  it("keeps the host speaking when an earlier utterance's drain settles after a later utterance has taken over", async () => {
    // LV1 race (App.tsx:44-47 — drain-coupled revert dropped the directive-identity
    // guard the old Character had at character.tsx:15). The App reverts to idle
    // UNCONDITIONALLY when a voice.speak() promise settles. If an EARLIER
    // utterance's audio drains LATE — after a LATER utterance is already speaking —
    // the earlier `.then(idle)` must NOT clobber the later utterance: the drain
    // revert belongs only to the utterance it came from.
    vi.useFakeTimers();
    // Web Speech stubs kept only in case a default voice touches these globals at
    // module load; this test injects `voice`, so the real drain comes from it.
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

    // The /narrate client resolves a non-empty line so each surface yields a real
    // speak directive (the narrating-host-loop drops blank narrations).
    const narrate = async () => "the Major just turned — watch this";

    // A controllable VoiceNarrator: each speak() captures its own resolver in call
    // order, so the test drives exactly which utterance's audio "drains" and when.
    const resolvers: Array<() => void> = [];
    const voice = {
      speak: () => new Promise<void>((res) => { resolvers.push(res); }),
    };

    render(<App narrate={narrate} voice={voice} />);
    await startWatching();

    // First surface: mock event 1 (ts: 1, heatDelta 0.91) clears surfaceThreshold
    // and fires; voice.speak() #1 is called and its resolver pushed (kept PENDING).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(resolvers.length).toBe(1);

    // Second surface: mock event 2 (ts: 45000, heatDelta 0.78) clears both the
    // surfaceThreshold (0.78 ≥ 0.6) and the 30s silence budget (45000 − 1 ≥ 30000),
    // so a LATER speak directive fires and takes over. (Event 3 at ts 90000 has
    // heatDelta 0.55 < 0.6, so it never surfaces — exactly two surfaces here.)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(45000);
    });
    expect(resolvers.length).toBe(2);

    // Precondition: the later utterance is active, so the host is speaking — and
    // the earlier utterance's drain has NOT yet settled.
    expect(screen.getByRole("status")).toHaveTextContent(/speaking/i);

    // Trigger the race: the EARLIER utterance's audio drains late — settle only
    // resolver #1 (the later one stays pending) and flush a single 0ms tick.
    await act(async () => {
      resolvers[0]?.();
      await vi.advanceTimersByTimeAsync(0);
    });

    // The later utterance is still playing → the host must STAY speaking. Today the
    // earlier `.then(idle)` clobbers it to idle (the dropped identity guard).
    expect(screen.getByRole("status")).toHaveTextContent(/speaking/i);
    expect(screen.getByRole("status")).not.toHaveTextContent(/idle/i);
  });

  it("keeps the host speaking past the old 4s speakingMs mark while the voice.speak drain is still pending", async () => {
    // LV2-D1 (qa-found, live browser): real Gemini lines run ~7s, but the Character's
    // fixed speakingMs=4000 timer reverts the host to idle at exactly 4.00s — BEATING
    // the drain-coupled revert (App reverts when voice.speak() RESOLVES). The host
    // flips to "idle" while audio is still playing. ADR 0007 §4 intent: "speaking is
    // gated on audio actually playing; reverts when speak() resolves" — the DRAIN must
    // govern the revert; the timer is only a generous SAFETY CAP, not the primary signal.
    vi.useFakeTimers();
    // Web Speech stubs kept only in case a default voice touches these globals at
    // module load; this test injects `voice`, so the real drain comes from it.
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

    // The /narrate client resolves the host's line (unchanged from M3).
    const narrate = async () => "the Major just turned — watch this";

    // A controllable VoiceNarrator: speak() returns a pending promise whose resolver
    // we capture, so the test drives exactly when the audio "drains". Until we resolve
    // it, the utterance is still playing — the host must stay speaking.
    let resolveSpeak: (() => void) | undefined;
    const voice = {
      speak: () => new Promise<void>((res) => { resolveSpeak = res; }),
    };

    render(<App narrate={narrate} voice={voice} />);
    await startWatching();

    // The first mock event (heatDelta 0.91) clears surfaceThreshold and fires at ts: 1;
    // advance ~100ms so the surfacing directive drives the voicing path.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    // Precondition: voice.speak was called and its promise is still pending, so the
    // host is mid-utterance — speaking.
    expect(screen.getByRole("status")).toHaveTextContent(/speaking/i);

    // Advance WELL past the old 4000ms speakingMs window WITHOUT resolving the drain.
    // (6s > 4000ms; the second mock event is at ts 45000, so nothing else surfaces in
    // this window.) The audio is still playing — only the drain may return it to idle.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });

    // RED: today the Character's speakingMs=4000 timer already fired at ~4s and reverted
    // the host to idle while the drain promise is still pending. The drain must govern —
    // so the host must STILL be speaking at 6s.
    expect(screen.getByRole("status")).toHaveTextContent(/speaking/i);
    expect(screen.getByRole("status")).not.toHaveTextContent(/idle/i);

    // Now drain it: resolve the speak promise and flush. The drain governs the revert,
    // so the host falls quiet. (This half should pass both before and after the fix —
    // it pins that the drain still returns the host to idle.)
    await act(async () => {
      resolveSpeak?.();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByRole("status")).toHaveTextContent(/idle/i);
    expect(screen.getByRole("status")).not.toHaveTextContent(/speaking/i);
  });

  it("voices zero times on idle/mount and exactly once per surfaced speak directive (cost-gating tripwire)", async () => {
    // Cost-gating invariant at the App dispatch layer (project-invariants §3): the
    // App must call voice.speak() ONLY when the loop surfaces a `speak` directive —
    // never on mount/idle, never on the non-surfacing firehose. Proven below at the
    // <App/> integration boundary, not just inside the loop/narrator units.
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

    // The /narrate client resolves a known non-empty line so a surface yields a real
    // speak directive (the narrating-host-loop drops blank narrations).
    const narrate = async () => "the Major just turned — watch this";

    // A counting VoiceNarrator: each speak() bumps the count. A never-resolving
    // promise is fine — this test pins only how MANY times the App voices, not drain.
    let speakCount = 0;
    const voice = {
      speak: () => {
        speakCount += 1;
        return new Promise<void>(() => {});
      },
    };

    render(<App narrate={narrate} voice={voice} />);

    // Mount/idle: the mock feed schedules its first event at ts:1 via setTimeout,
    // which has NOT fired yet (no timer advance). With nothing surfaced, the App
    // must not have voiced the idle firehose — zero on startup.
    expect(speakCount).toBe(0);

    // Start watching, then let the first mock event (ts:1, heatDelta 0.91 ≥
    // surfaceThreshold) surface.
    await startWatching();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    // One surfaced speak directive ⇒ exactly one voice call — bounded per surface.
    expect(speakCount).toBe(1);
  });
});
