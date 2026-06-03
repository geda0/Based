import type { RelaySocket } from './live-narrator';

// The real `openRelay` for the live-voice path (topology a: browser-direct).
// It mints a short-lived ephemeral token + server-built `setup` envelope via
// `POST /live/session`, then opens Google's Live WSS directly with the token.
// The long-lived API key never transits the browser (ADR 0007 §8).
// The ephemeral token is NEVER logged.

const GOOGLE_LIVE_WSS = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained';

type SessionResponse = {
  token: string;
  model: string;
  expiresAt: string;
  setup: unknown;
};

export function createOpenRelay(opts?: {
  sessionBaseUrl?: string;
  fetchImpl?: typeof fetch;
  socketFactory?: (url: string) => WebSocket;
}): () => RelaySocket {
  const sessionBaseUrl = opts?.sessionBaseUrl ?? import.meta.env.VITE_API_BASE_URL ?? '';
  const fetchImpl = opts?.fetchImpl ?? fetch;
  const socketFactory = opts?.socketFactory ?? ((url: string) => new WebSocket(url));

  return (): RelaySocket & { setup?: unknown } => {
    // Recorded handlers + a send queue so the proxy honours the narrator's
    // SYNCHRONOUS openRelay() contract while the mint+connect happens async.
    const handlers: Record<string, Array<(...a: unknown[]) => void>> = {};
    const sendQueue: unknown[] = [];
    let realWs: WebSocket | undefined;
    let closed = false;

    const proxy: RelaySocket & { setup?: unknown } = {
      on(event, cb) {
        (handlers[event] ??= []).push(cb);
      },
      send(data) {
        // Tight cast at the typed-WS boundary (narrator sends JSON strings).
        if (realWs && realWs.readyState === WebSocket.OPEN) realWs.send(data as string);
        else sendQueue.push(data);
      },
      close() {
        closed = true;
        realWs?.close();
      },
      setup: undefined,
    };

    // Mint a token + setup envelope, then connect Google's Live WSS directly
    // and bridge its events to the recorded handlers. Any failure fires `error`
    // so the narrator REJECTS and the host stays silent (failure-silent, ADR 0007).
    void (async () => {
      const res = await fetchImpl(`${sessionBaseUrl}/live/session`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        throw new Error(`live session mint failed: ${res.status}`);
      }
      const response = (await res.json()) as SessionResponse;

      // Populate `.setup` on the proxy BEFORE the WS fires `open` — the narrator
      // reads `ws.setup` inside its open handler (Amendment C §C2.2 contract).
      proxy.setup = response.setup;

      const ws = socketFactory(
        `${GOOGLE_LIVE_WSS}?access_token=${encodeURIComponent(response.token)}`,
      );
      ws.binaryType = 'arraybuffer'; // ensure binary frames arrive as ArrayBuffer, not Blob
      ws.addEventListener('open', () => {
        // `data` crosses the typed-WS boundary: the narrator only ever hands us
        // JSON strings, but RelaySocket.send is `unknown` — cast tightly here.
        for (const m of sendQueue) ws.send(m as string);
        sendQueue.length = 0;
        handlers.open?.forEach((cb) => cb());
      });
      ws.addEventListener('message', (e) =>
        handlers.message?.forEach((cb) => cb((e as MessageEvent).data)),
      );
      ws.addEventListener('error', (ev) => handlers.error?.forEach((cb) => cb(ev)));
      ws.addEventListener('close', () => handlers.close?.forEach((cb) => cb()));
      realWs = ws;
      // close() may have been called before the socket existed — honour it now.
      if (closed) ws.close();
    })().catch((err: unknown) => {
      // Mint rejected / non-ok / socket construct threw → reject the narrator.
      handlers.error?.forEach((cb) => cb(err));
    });

    return proxy;
  };
}
