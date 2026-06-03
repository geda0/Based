import type { RelaySocket } from './live-narrator';

// The real `openRelay` for the live-voice path (the untested I/O edge behind the
// already-tested VoiceNarrator). It mints a short-lived session token via the
// backend `/live/session` HTTP route (mirroring narrate-client's env + fetch
// style), then opens the browser→relay WebSocket carrying that token in the
// query string. The long-lived key never transits the browser (ADR 0007 §8);
// the ephemeral token + relay URL are NEVER logged.

// Derive a ws(s):// base from an http(s):// origin (best-effort local-dev
// default when VITE_LIVE_RELAY_URL is unset): http→ws, https→wss.
function deriveWsBase(httpOrigin: string): string {
  if (httpOrigin.startsWith('https://')) return 'wss://' + httpOrigin.slice('https://'.length);
  if (httpOrigin.startsWith('http://')) return 'ws://' + httpOrigin.slice('http://'.length);
  // Already a ws(s) base, or some other scheme — pass through unchanged.
  return httpOrigin;
}

export function createOpenRelay(opts?: {
  sessionBaseUrl?: string;
  relayBaseUrl?: string;
  fetchImpl?: typeof fetch;
  socketFactory?: (url: string) => WebSocket;
}): () => RelaySocket {
  const sessionBaseUrl = opts?.sessionBaseUrl ?? import.meta.env.VITE_API_BASE_URL ?? '';
  const fetchImpl = opts?.fetchImpl ?? fetch;
  const socketFactory = opts?.socketFactory ?? ((url: string) => new WebSocket(url));

  // The ws(s):// base for the relay socket. Prefer an explicit override, then
  // VITE_LIVE_RELAY_URL, then derive from the API/page origin (local-dev default).
  const relayWsBase =
    opts?.relayBaseUrl ??
    import.meta.env.VITE_LIVE_RELAY_URL ??
    deriveWsBase(
      sessionBaseUrl !== ''
        ? sessionBaseUrl
        : typeof window !== 'undefined'
          ? window.location.origin
          : '',
    );

  return (): RelaySocket => {
    // Recorded handlers + a send queue so the proxy honours the narrator's
    // SYNCHRONOUS openRelay() contract while the mint+connect happens async.
    const handlers: Record<string, Array<(...a: unknown[]) => void>> = {};
    const sendQueue: unknown[] = [];
    let realWs: WebSocket | undefined;
    let closed = false;

    // Mint a token, then connect the real WS and bridge its events to the
    // recorded handlers. Any failure fires `error` so the narrator REJECTS and
    // the host stays silent (failure-silent, ADR 0007).
    void (async () => {
      const res = await fetchImpl(`${sessionBaseUrl}/live/session`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        throw new Error(`live session mint failed: ${res.status}`);
      }
      const { token, model } = (await res.json()) as { token: string; model: string };

      const ws = socketFactory(
        `${relayWsBase}/live/relay?token=${encodeURIComponent(token)}&model=${encodeURIComponent(model)}`,
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

    return {
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
    };
  };
}
