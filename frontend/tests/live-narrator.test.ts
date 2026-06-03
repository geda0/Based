import { describe, it, expect } from "vitest";
import { createLiveNarrator } from "../src/lib/live-narrator";

// The FE narrator generalizes today's fire-and-forget `speak.ts` into the async,
// lifecycle-aware `VoiceNarrator` over the Gemini Live WSS (ADR 0007 §2/§4/§7 +
// Amendment C). Topology is RESOLVED → (a) browser-direct: the FE opens Google's Live
// WSS itself, so the narrator now OWNS the connection and sends the `setup` frame
// ITSELF (the retired relay used to). `openRelay()` is the injectable open-edge — the
// real impl is a SYNCHRONOUS deferred-proxy: it returns a WS-like socket IMMEDIATELY,
// then asynchronously mints an ephemeral token + fetches the server-built `setup` via
// `POST /live/session` and opens the Google WSS. So `setup` is NOT known at call-time —
// it only exists by the time the socket fires `open`. Per Amendment C §C2.2 the returned
// socket therefore CARRIES its own `.setup` (read at OPEN-time), NOT a `{ socket, setup }`
// wrapper destructured at call-time (which would hand the narrator `setup === undefined`
// in a real browser — the LV1-D1 trap). The narrator reads `ws.setup` inside its `open`
// handler, where BOTH the sync fake AND the real async proxy have populated it. The
// `setup` is the FULLY-WRAPPED envelope the FE forwards VERBATIM — it does not build or
// inspect it; `buildLiveSetup` on the backend stays the single source of truth (prefixed
// model, AUDIO-only, no-spoiler systemInstruction). Tests inject a duck-typed fake socket
// (WS-like: on/send/close) that carries a fake `.setup` envelope.

// A shared fake of the server-built setup envelope `POST /live/session` returns
// (`{ setup: buildLiveSetup({ model }) }`, §C2.1). The narrator forwards exactly these
// bytes; the test does not assert its internals (the backend test pins the shape).
const SETUP = {
  setup: {
    model: "models/gemini-3.1-flash-live-preview",
    generationConfig: { responseModalities: ["AUDIO"] },
    systemInstruction: { parts: [{ text: "no spoilers" }] },
  },
};

describe("createLiveNarrator", () => {
  it("sends the setup frame first, then the wrapped clientContent turn, on open", () => {
    // Arrange: a fake open-edge whose returned value IS the WS-like socket and CARRIES
    // its own `.setup` (no `{ socket, setup }` wrapper). The socket captures its event
    // handlers (so the test can fire `open`) and records every send(data); SETUP is the
    // server-built envelope the narrator forwards verbatim, read off `ws.setup` at OPEN
    // time. The real `openRelay` is a synchronous deferred-proxy that returns immediately
    // and fetches `POST /live/session` asynchronously, so `setup` only exists by the time
    // `open` fires — reading `ws.setup` in the open handler is the contract that BOTH this
    // sync fake AND the real async proxy satisfy (avoids the LV1-D1 destructure-at-call trap).
    const handlers: Record<string, (...args: unknown[]) => void> = {};
    const sent: unknown[] = [];
    const fakeWs = {
      on(event: string, cb: (...args: unknown[]) => void) {
        handlers[event] = cb;
      },
      send(data: unknown) {
        sent.push(data);
      },
      close() {},
      setup: SETUP,
    };

    // Act: speak a line over the injected open-edge, then fire the socket's `open`. We
    // do NOT await speak(): its promise resolves on audio drain (a later cycle). The
    // socket is opened synchronously by speak(); both frames are emitted on `open`.
    const narrator = createLiveNarrator({
      openRelay: () => fakeWs,
    });
    void narrator.speak("go");
    handlers.open?.();

    // Assert (Amendment C §C2.3): on `open` the narrator sends EXACTLY TWO frames, in
    // order — the socket's own `setup` envelope VERBATIM first, then the clientContent
    // line turn. Frame 1 is the literal `JSON.stringify(ws.setup)` bytes (forwarded from
    // the socket, never rebuilt). This INVERTS the retired "never sends a setup frame"
    // assertion — under browser-direct the browser owns the connection and MUST send setup.
    expect(sent).toHaveLength(2);
    expect(sent[0]).toBe(JSON.stringify(SETUP));

    // Frame 2 is the line wrapped in the exact guard prompt. A send may be a JSON string
    // (wire form) or a raw object — normalize before asserting the payload.
    const asObject = (data: unknown): unknown =>
      typeof data === "string" ? JSON.parse(data) : data;
    expect(asObject(sent[1])).toEqual({
      clientContent: {
        turns: [
          {
            role: "user",
            parts: [
              {
                text: 'Speak only these exact words. Do not add anything. Say: "go"',
              },
            ],
          },
        ],
        turnComplete: true,
      },
    });
  });

  it("routes each inbound serverContent audio part to the injected audio sink", () => {
    // Arrange: a fake relay socket that captures handlers (so the test can fire
    // `message`), and a fake audio sink that records the base64 chunk it is asked to
    // play. play() returns a never-resolving promise — this cycle pins routing, NOT
    // drain/resolution (a later cycle), so we never need it to settle.
    const handlers: Record<string, (...args: unknown[]) => void> = {};
    const fakeWs = {
      on(event: string, cb: (...args: unknown[]) => void) {
        handlers[event] = cb;
      },
      send() {},
      close() {},
      setup: SETUP,
    };
    const played: string[] = [];
    const fakeAudio = {
      play(chunk: string): Promise<void> {
        played.push(chunk);
        return new Promise<void>(() => {});
      },
    };

    // Act: speak over the injected relay + audio sink, fire `open`, then deliver a
    // `serverContent` audio frame as the wire form (a JSON string) carrying one PCM
    // part. We do NOT await speak(): its promise resolves on drain (a later cycle).
    const narrator = createLiveNarrator({
      openRelay: () => fakeWs,
      audio: fakeAudio,
    });
    void narrator.speak("go");
    handlers.open?.();
    const serverContentFrame = JSON.stringify({
      serverContent: {
        modelTurn: {
          parts: [
            {
              inlineData: { mimeType: "audio/pcm;rate=24000", data: "QUJD" },
            },
          ],
        },
      },
    });
    handlers.message?.(serverContentFrame);

    // Assert: the part's base64 `inlineData.data` was handed to the sink exactly once.
    expect(played).toEqual(["QUJD"]);
  });

  it("routes a serverContent audio part delivered as a binary ArrayBuffer frame", () => {
    // Arrange: same fake relay (captures handlers) + fake audio sink recording each
    // played base64 chunk. play() returns a never-resolving promise — this pins routing
    // of the BINARY wire form, not drain/resolution. In a real browser the relay's
    // serverContent audio frames arrive as binary WebSocket frames (Blob/ArrayBuffer),
    // NOT strings; the adapter normalizes them to ArrayBuffer upstream, so ArrayBuffer is
    // the narrator's contract here (the prior test pins the string form).
    const handlers: Record<string, (...args: unknown[]) => void> = {};
    const fakeWs = {
      on(event: string, cb: (...args: unknown[]) => void) {
        handlers[event] = cb;
      },
      send() {},
      close() {},
      setup: SETUP,
    };
    const played: string[] = [];
    const fakeAudio = {
      play(chunk: string): Promise<void> {
        played.push(chunk);
        return new Promise<void>(() => {});
      },
    };

    // Act: speak over the injected relay + audio sink, fire `open`, then deliver the SAME
    // serverContent audio frame as an ArrayBuffer of UTF-8 JSON bytes (the real binary
    // wire form) instead of a string. We do NOT await speak().
    const narrator = createLiveNarrator({
      openRelay: () => fakeWs,
      audio: fakeAudio,
    });
    void narrator.speak("go");
    handlers.open?.();
    const frame = {
      serverContent: {
        modelTurn: {
          parts: [
            {
              inlineData: { mimeType: "audio/pcm;rate=24000", data: "QUJD" },
            },
          ],
        },
      },
    };
    const buf = new TextEncoder().encode(JSON.stringify(frame)).buffer; // ArrayBuffer
    handlers.message?.(buf);

    // Assert: the narrator decoded the ArrayBuffer, parsed the JSON, and handed the
    // part's base64 `inlineData.data` to the sink exactly once.
    expect(played).toEqual(["QUJD"]);
  });

  it("resolves speak only after turn completion AND all played audio has drained", async () => {
    // Arrange: a fake relay socket that captures handlers, plus a fake audio sink whose
    // play() returns a CONTROLLABLE promise — the test holds each resolver so it can
    // decide exactly when a scheduled buffer "drains" (ADR 0007 §2).
    const handlers: Record<string, (...args: unknown[]) => void> = {};
    const fakeWs = {
      on(event: string, cb: (...args: unknown[]) => void) {
        handlers[event] = cb;
      },
      send() {},
      close() {},
      setup: SETUP,
    };
    const played: string[] = [];
    const audioResolvers: Array<() => void> = [];
    const fakeAudio = {
      play(chunk: string): Promise<void> {
        played.push(chunk);
        return new Promise<void>((res) => {
          audioResolvers.push(res);
        });
      },
    };

    // Act: speak, and track resolution WITHOUT awaiting (the promise may never resolve
    // unless the real drain semantics hold).
    const narrator = createLiveNarrator({
      openRelay: () => fakeWs,
      audio: fakeAudio,
    });
    const p = narrator.speak("go");
    let resolved = false;
    void p.then(() => {
      resolved = true;
    });

    handlers.open?.();
    const audioFrame = JSON.stringify({
      serverContent: {
        modelTurn: {
          parts: [
            {
              inlineData: { mimeType: "audio/pcm;rate=24000", data: "QUJD" },
            },
          ],
        },
      },
    });
    handlers.message?.(audioFrame);
    // The chunk was scheduled but its play() promise is still pending (not drained).

    // The server signals the turn is complete — but the audio has NOT drained yet.
    const turnCompleteFrame = JSON.stringify({
      serverContent: { turnComplete: true },
    });
    handlers.message?.(turnCompleteFrame);

    // Assert: turn complete alone is not enough — with a buffer still pending, speak must
    // NOT have resolved.
    await Promise.resolve();
    await Promise.resolve();
    expect(resolved).toBe(false);

    // Now the scheduled buffer drains. With the turn already complete, speak resolves.
    // Observe resolution via the `resolved` flag after flushing pending microtasks with a
    // macrotask tick — NOT by `await p`, which would hang for the full timeout if speak
    // never resolves under a broken impl. (p is still tracked by the earlier .then above.)
    audioResolvers[0]?.();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(resolved).toBe(true);
  });

  it("rejects speak when the relay socket errors and forces no audio", async () => {
    // Arrange: a fake relay socket that captures handlers (so the test can fire the
    // socket's `error` event), and a fake audio sink that records any chunk it is asked
    // to play. No `serverContent` frame is delivered in the failure path, so the sink
    // must stay untouched.
    const handlers: Record<string, (...args: unknown[]) => void> = {};
    const fakeWs = {
      on(event: string, cb: (...args: unknown[]) => void) {
        handlers[event] = cb;
      },
      send() {},
      close() {},
      setup: SETUP,
    };
    const played: string[] = [];
    const fakeAudio = {
      play(chunk: string): Promise<void> {
        played.push(chunk);
        return new Promise<void>(() => {});
      },
    };

    // Act: speak over the injected relay + audio sink, then fire the relay's `error`
    // event (the relay socket emits `"error"` when the upstream WSS fails / close 1011).
    // Track rejection via a flag — attaching .catch both records the outcome AND prevents
    // an unhandled rejection. We do NOT `await p`: under a broken impl that never rejects
    // it would hang for the full timeout instead of failing fast.
    const narrator = createLiveNarrator({
      openRelay: () => fakeWs,
      audio: fakeAudio,
    });
    const p = narrator.speak("go");
    let rejected = false;
    p.catch(() => {
      rejected = true;
    });

    handlers.error?.(new Error("relay failed"));

    // Flush pending microtasks with a macrotask tick (twice), mirroring the drain test.
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    // Assert: the relay error rejected speak — this is what lets the host loop drop the
    // speak directive and degrade to silence (Based invariant: failure-silent).
    expect(rejected).toBe(true);
    // And no audio was forced: with no serverContent frame in this path, the sink is untouched.
    expect(played).toEqual([]);
  });

  it("closes the relay socket when the utterance ends", async () => {
    // Arrange: a fake relay socket that captures handlers, records sends, AND records
    // close() calls. The open/close-per-utterance lifecycle (ADR 0007 §3) is what makes
    // cost-gating structurally true — no socket may linger once the line is spoken.
    const handlers: Record<string, (...args: unknown[]) => void> = {};
    let closeCalls = 0;
    const fakeWs = {
      on(event: string, cb: (...args: unknown[]) => void) {
        handlers[event] = cb;
      },
      send() {},
      close() {
        closeCalls++;
      },
      setup: SETUP,
    };
    const played: string[] = [];
    const audioResolvers: Array<() => void> = [];
    const fakeAudio = {
      play(chunk: string): Promise<void> {
        played.push(chunk);
        return new Promise<void>((res) => {
          audioResolvers.push(res);
        });
      },
    };

    // Act: speak over the injected relay + audio sink and drive the full SUCCESS sequence
    // through to drain so the utterance ends (speak resolves). We do NOT await speak():
    // we attach .catch to silence a possible rejection, then observe close() via its
    // recorded count after flushing — `await p` would hang for the full timeout under a
    // broken impl instead of failing fast.
    const p = createLiveNarrator({
      openRelay: () => fakeWs,
      audio: fakeAudio,
    }).speak("go");
    void p.catch(() => {});

    handlers.open?.();
    const audioFrame = JSON.stringify({
      serverContent: {
        modelTurn: {
          parts: [
            {
              inlineData: { mimeType: "audio/pcm;rate=24000", data: "QUJD" },
            },
          ],
        },
      },
    });
    handlers.message?.(audioFrame);
    const turnCompleteFrame = JSON.stringify({
      serverContent: { turnComplete: true },
    });
    handlers.message?.(turnCompleteFrame);
    // Drain the scheduled buffer — with the turn already complete, the utterance ends here.
    audioResolvers[0]?.();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    // Assert: ending the utterance closed the relay socket exactly once (ADR 0007 §3).
    expect(closeCalls).toBe(1);
  });

  it("opens zero relays when held and exactly one relay per speak call", () => {
    // Arrange: a COUNTING openRelay — each call increments `opens` and returns a fresh
    // socket-with-`.setup` (the Amendment C §C2.2 open-edge shape: the returned value IS
    // the WS-like socket, carrying its own `setup`). This pins the cost-gating / silence-
    // budget invariant structurally: merely constructing/holding a VoiceNarrator must open
    // NOTHING, and the Google socket is opened ONLY inside a speak(...) call — exactly one
    // per speak, never a shared/persistent socket (the "no storm" / no-continuous-session
    // guarantee; ADR 0007 §5/§8). Carrying `.setup` on the socket does not change the
    // count — still one per speak.
    let opens = 0;
    const makeFakeWs = (): {
      on(): void;
      send(): void;
      close(): void;
      setup: typeof SETUP;
    } => ({ on() {}, send() {}, close() {}, setup: SETUP });
    const openRelay = (): ReturnType<typeof makeFakeWs> => {
      opens++;
      return makeFakeWs();
    };
    const fakeAudio = {
      play(): Promise<void> {
        return new Promise<void>(() => {});
      },
    };

    // Act + Assert: holding a narrator opens nothing. Constructing it must not touch the
    // relay edge at all.
    const narrator = createLiveNarrator({ openRelay, audio: fakeAudio });
    expect(opens).toBe(0);

    // The first speak opens exactly one relay. We do NOT await it (its promise resolves
    // on drain — a later cycle); `.catch` keeps any rejection from floating.
    void narrator.speak("a").catch(() => {});
    expect(opens).toBe(1);

    // A second speak opens exactly one MORE relay — one-per-speak, not a reused socket.
    void narrator.speak("b").catch(() => {});
    expect(opens).toBe(2);
  });
});
