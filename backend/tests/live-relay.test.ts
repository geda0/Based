import { describe, it, expect } from "vitest";
import { createLiveRelay } from "../src/modules/live/live-relay.js";

// LV1 RELAY (ADR 0007 §1/§2/§7 as CORRECTED by Amendment B): the WSS relay opens
// the UPSTREAM Google Live socket server-side carrying the ephemeral credential.
// A live probe of the real Live API (ADR 0007 Amendment B, Corrections 1 & 2)
// VALIDATED the exact wire shape: the WSS authenticates the ephemeral token via a
// `?access_token=<token>` URL QUERY PARAMETER, NOT an `Authorization: Token <token>`
// request header — the header path fails with WSS close 1008 "unregistered callers".
// And for an ephemeral token the method must be the `…BidiGenerateContentConstrained`
// variant (plain `BidiGenerateContent` was NOT validated with the token). So the
// relay attaches the token IN THE URL (`…Constrained?access_token=<ephemeral>`), not
// in a header. This is the credential-flow face of the secrets-from-env invariant
// (ADR 0007 §8): the short-lived token flows INTO the upstream open.
//
// The UPSTREAM socket open is the injectable I/O edge (mirrors how live-token-
// client injects `mint` and gemini-client treats `fetch`), so the suite never
// opens a real socket. We assert on the URL the relay opens (the validated
// credential carrier), not on any header. `browserSocket` / `UpstreamSocket` are
// duck-typed WS-like objects ({ on, send, close? }); forwarding/piping between them
// is a SEPARATE later cycle and is NOT asserted here.
describe("createLiveRelay", () => {
  it("opens the upstream BidiGenerateContentConstrained socket with the ephemeral token as an access_token query param", () => {
    // Arrange: a fake upstream-connect edge that records the url it gets and returns
    // a minimal WS-like upstream socket — so we observe HOW the relay opened upstream
    // (which URL it targeted) without opening a real socket.
    const connectArgs: { url: string }[] = [];
    const fakeUpstream = { on() {}, send() {} };
    const fakeConnect = (url: string) => {
      connectArgs.push({ url });
      return fakeUpstream;
    };
    const fakeBrowserSocket = { on() {}, send() {} };

    // Act: relay a browser socket carrying the short-lived ephemeral token.
    createLiveRelay({ connectUpstream: fakeConnect }).relay(fakeBrowserSocket, {
      token: "eph-123",
      model: "gemini-3.1-flash-live-preview",
    });

    // Assert: the upstream socket was opened EXACTLY ONCE...
    expect(connectArgs).toHaveLength(1);
    const url = connectArgs[0]?.url ?? "";
    // ...against the CONSTRAINED BidiGenerateContent method — the variant the live
    // probe validated for an ephemeral token (ADR 0007 Amendment B, Correction 2).
    expect(url).toContain("BidiGenerateContentConstrained");
    // ...carrying the ephemeral token as an `access_token` URL query param — the
    // credential carrier the live probe validated (Correction 1); the `Authorization:
    // Token` header path fails WSS close 1008. The token rides the URL, not a header.
    expect(url).toContain("access_token=eph-123");
  });

  // WIRE CONTRACT (ADR 0007 §2/§7): the `setup` frame is sent ONCE, SERVER-SIDE,
  // right after the upstream socket opens — the browser NEVER sends setup. The
  // frame is buildLiveSetup(...) wrapped as { setup: <…> }, carrying the PREFIXED
  // model id and AUDIO-ONLY modality. We assert the load-bearing fields the relay
  // is responsible for (server-side, once, prefixed, audio-only); the full setup
  // internals are pinned in live-setup.test.ts and not re-asserted here.
  it("sends the setup frame exactly once server-side after the upstream socket opens", () => {
    // Arrange: a fake upstream socket that records every send(data) and captures
    // its registered event handlers, so the test can fire `open` to simulate the
    // upstream connection being established.
    const sent: unknown[] = [];
    const handlers: Record<string, (...args: unknown[]) => void> = {};
    const fakeUpstream = {
      on(event: string, cb: (...args: unknown[]) => void) {
        handlers[event] = cb;
      },
      send(data: unknown) {
        sent.push(data);
      },
    };
    const fakeBrowserSocket = { on() {}, send() {} };

    // Act: relay, then fire the upstream `open` handler — the moment the relay
    // must push its single server-side setup frame.
    createLiveRelay({ connectUpstream: () => fakeUpstream }).relay(fakeBrowserSocket, {
      token: "eph-1",
      model: "gemini-3.1-flash-live-preview",
    });
    handlers.open?.();

    // Assert: exactly ONE frame was sent on open (the setup frame, server-side —
    // the browser never sends setup).
    expect(sent).toHaveLength(1);

    // The relay may JSON.stringify the frame before send — normalize so the test
    // fails on the missing setup behavior, not on serialization format.
    const raw = sent[0];
    const frame = (typeof raw === "string" ? JSON.parse(raw) : raw) as {
      setup?: { model?: string; generationConfig?: { responseModalities?: string[] } };
    };

    // It is the setup frame: a top-level `setup` object carrying the PREFIXED
    // model id and the AUDIO-ONLY modality (the two facts that silently break the
    // Live session if wrong, per ADR 0007 §2).
    expect(frame.setup?.model).toBe("models/gemini-3.1-flash-live-preview");
    expect(frame.setup?.generationConfig?.responseModalities).toEqual(["AUDIO"]);
  });

  // FORWARD DIRECTION (ADR 0007 §2/§7): the browser sends only its `clientContent`
  // line turn; the relay pipes that turn straight to the upstream Google socket. We
  // assert the load-bearing fact — a message the BROWSER emits is forwarded to
  // `upstream.send(...)` verbatim. The setup frame already lives in `uSent` (the
  // relay sent it on open), so we fire `open` first and then assert the browser's
  // frame is ALSO present — never that it's the only send. The reverse
  // (upstream -> browser PCM) pipe is a separate later cycle and is NOT asserted here.
  it("forwards a clientContent message the browser sends upstream", () => {
    // Arrange: a fake browser socket that captures its event handlers (so the test
    // can fire `message` to simulate the browser emitting its line turn), and a fake
    // upstream that captures its handlers + records every send(data).
    const bHandlers: Record<string, (...args: unknown[]) => void> = {};
    const uHandlers: Record<string, (...args: unknown[]) => void> = {};
    const uSent: unknown[] = [];
    const fakeBrowserSocket = {
      on(event: string, cb: (...args: unknown[]) => void) {
        bHandlers[event] = cb;
      },
      send() {},
    };
    const fakeUpstream = {
      on(event: string, cb: (...args: unknown[]) => void) {
        uHandlers[event] = cb;
      },
      send(data: unknown) {
        uSent.push(data);
      },
    };

    // A representative browser frame: the `clientContent` line turn (the only thing
    // the browser is allowed to send, per ADR 0007 §7). Kept as the exact JSON string
    // the browser would put on the wire so we can assert it is forwarded verbatim.
    const clientContentFrame = JSON.stringify({
      clientContent: {
        turns: [
          {
            role: "user",
            parts: [{ text: 'Speak only these exact words. Do not add anything. Say: "go"' }],
          },
        ],
        turnComplete: true,
      },
    });

    // Act: relay; fire upstream `open` FIRST so the relay initializes + emits its
    // setup frame (distinguishing setup from the forwarded message), THEN fire the
    // browser `message` with its clientContent line turn.
    createLiveRelay({ connectUpstream: () => fakeUpstream }).relay(fakeBrowserSocket, {
      token: "eph-1",
      model: "gemini-3.1-flash-live-preview",
    });
    uHandlers.open?.();
    bHandlers.message?.(clientContentFrame);

    // Assert: the browser's exact clientContent frame was forwarded to the upstream
    // socket (it is present among the sends — the setup frame is also there).
    expect(uSent).toContain(clientContentFrame);
  });

  // RETURN DIRECTION (ADR 0007 §2/§7): the upstream Google socket streams back
  // `serverContent` audio frames (PCM `inlineData` parts); the relay pipes each one
  // straight to the browser unmodified — that streamed audio is what the page plays.
  // We assert the load-bearing fact: a `message` the UPSTREAM emits reaches
  // `browserSocket.send(...)` verbatim. We assert the frame is PRESENT among the
  // browser sends — never that it's the only one.
  it("pipes a serverContent audio frame the upstream sends back to the browser", () => {
    // Arrange: a fake browser socket that captures its handlers AND records every
    // send(data) (so the test can observe what the relay pipes back to the page), and
    // a fake upstream that captures its handlers (so the test can fire `message` to
    // simulate Google streaming an audio frame down).
    const bHandlers: Record<string, (...args: unknown[]) => void> = {};
    const uHandlers: Record<string, (...args: unknown[]) => void> = {};
    const bSent: unknown[] = [];
    const fakeBrowserSocket = {
      on(event: string, cb: (...args: unknown[]) => void) {
        bHandlers[event] = cb;
      },
      send(data: unknown) {
        bSent.push(data);
      },
    };
    const fakeUpstream = {
      on(event: string, cb: (...args: unknown[]) => void) {
        uHandlers[event] = cb;
      },
      send() {},
    };

    // A representative upstream frame: a `serverContent.modelTurn.parts[].inlineData`
    // PCM audio chunk (the streamed audio the page plays, per ADR 0007 §2). Kept as the
    // exact JSON string Google would put on the wire so we can assert it is piped verbatim.
    const serverContentFrame = JSON.stringify({
      serverContent: {
        modelTurn: {
          parts: [{ inlineData: { mimeType: "audio/pcm;rate=24000", data: "QUJD" } }],
        },
      },
    });

    // Act: relay; fire upstream `open` FIRST so the relay initializes its pipes, THEN
    // fire the upstream `message` with the serverContent audio frame.
    createLiveRelay({ connectUpstream: () => fakeUpstream }).relay(fakeBrowserSocket, {
      token: "eph-1",
      model: "gemini-3.1-flash-live-preview",
    });
    uHandlers.open?.();
    uHandlers.message?.(serverContentFrame);

    // Assert: the upstream's exact serverContent audio frame was piped down to the
    // browser socket (it is present among the browser sends).
    expect(bSent).toContain(serverContentFrame);
  });

  // PRE-OPEN BUFFERING (ADR 0007 §2/§7 — real topology-(b) race): the browser sends
  // its `clientContent` line turn on ITS ws `open` (connected to OUR relay), which
  // fires BEFORE the relay's upstream Google socket has opened + been sent `setup`.
  // A browser frame that arrives before upstream-open must be BUFFERED (not sent to a
  // not-yet-open socket, where it'd be lost AND would precede `setup`, which the Live
  // API rejects); once the upstream opens, the relay sends `setup` FIRST, then flushes
  // the buffered browser frame(s) to the upstream in order. This guards the ordering
  // the Live session depends on (setup-before-clientContent), distinct from cycle-10
  // which fires `open` before `message` and so never exercises the race.
  it("buffers a browser message that arrives before upstream-open and flushes it after setup", () => {
    // Arrange: a fake browser socket that captures its handlers (so the test fires
    // `message` to simulate the browser emitting its line turn on its own ws open),
    // and a fake upstream that captures its handlers + records every send(data) in
    // order — so we can assert WHAT and in WHICH ORDER the relay sent upstream.
    const bHandlers: Record<string, (...args: unknown[]) => void> = {};
    const uHandlers: Record<string, (...args: unknown[]) => void> = {};
    const uSent: unknown[] = [];
    const fakeBrowserSocket = {
      on(event: string, cb: (...args: unknown[]) => void) {
        bHandlers[event] = cb;
      },
      send() {},
    };
    const fakeUpstream = {
      on(event: string, cb: (...args: unknown[]) => void) {
        uHandlers[event] = cb;
      },
      send(data: unknown) {
        uSent.push(data);
      },
    };

    // The exact `clientContent` line-turn string the browser puts on the wire — kept
    // verbatim so we can assert it is buffered then flushed unmodified.
    const clientContentFrame = JSON.stringify({
      clientContent: {
        turns: [{ role: "user", parts: [{ text: 'Speak only these exact words. Say: "go"' }] }],
        turnComplete: true,
      },
    });

    // Act (part 1): relay, then fire the browser `message` BEFORE the upstream `open`
    // — the real race. At this point the upstream socket is not yet open.
    createLiveRelay({ connectUpstream: () => fakeUpstream }).relay(fakeBrowserSocket, {
      token: "eph-1",
      model: "gemini-3.1-flash-live-preview",
    });
    bHandlers.message?.(clientContentFrame);

    // Assert (pre-open): nothing has been sent upstream yet — the browser frame was
    // BUFFERED, not pushed to the not-yet-open socket (and not ahead of `setup`).
    expect(uSent).toEqual([]);

    // Act (part 2): now the upstream opens — the relay must emit `setup` first, THEN
    // flush the buffered browser frame.
    uHandlers.open?.();

    // Assert (post-open): the FIRST upstream send is the `setup` frame...
    const first = uSent[0];
    const firstFrame = (typeof first === "string" ? JSON.parse(first) : first) as {
      setup?: unknown;
    };
    expect(firstFrame.setup).toBeDefined();
    // ...and the buffered browser frame was flushed AFTER setup (present, post-index-0).
    expect(uSent).toContain(clientContentFrame);
    expect(uSent.indexOf(clientContentFrame)).toBeGreaterThan(0);
  });

  // CLOSE PROPAGATION (ADR 0007 §2/§7 — qa-found resource leak LV2-D2): the narrator
  // closes the browser->relay ws on utterance end, but the relay only wires the two
  // `message` pipes — it never propagates that close upstream. So the upstream Google
  // WSS lingers until Google's idle timeout / the ~3-min ephemeral token expires: a
  // leaked live session per utterance. The relay must tear the upstream socket down
  // WITH the browser: when the browser socket emits `close`, the relay closes upstream.
  // (The reverse upstream-close -> browser-close direction is a possible later cycle and
  // is NOT asserted here.)
  it("closes the upstream socket when the browser socket closes", () => {
    // Arrange: a fake browser socket that captures its handlers (so the test can fire
    // `close` to simulate the narrator disconnecting on utterance end), and a fake
    // upstream that captures its handlers + RECORDS how many times close() is called —
    // so we observe the relay tearing the upstream connection down.
    const bHandlers: Record<string, (...args: unknown[]) => void> = {};
    const uHandlers: Record<string, (...args: unknown[]) => void> = {};
    let uCloseCalls = 0;
    const fakeBrowserSocket = {
      on(event: string, cb: (...args: unknown[]) => void) {
        bHandlers[event] = cb;
      },
      send() {},
      close() {},
    };
    const fakeUpstream = {
      on(event: string, cb: (...args: unknown[]) => void) {
        uHandlers[event] = cb;
      },
      send() {},
      close() {
        uCloseCalls += 1;
      },
    };

    // Act: relay, then fire the browser `close` handler — the narrator disconnecting
    // the browser->relay ws when its utterance ends.
    createLiveRelay({ connectUpstream: () => fakeUpstream }).relay(fakeBrowserSocket, {
      token: "eph-1",
      model: "gemini-3.1-flash-live-preview",
    });
    bHandlers.close?.();

    // Assert: the relay closed the upstream Google socket exactly once in response, so
    // the upstream session is torn down with the browser rather than left to linger.
    expect(uCloseCalls).toBe(1);
  });
});
