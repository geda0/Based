import { buildLiveSetup } from "./live-setup.js";

export type UpstreamSocket = {
  on(event: string, cb: (...args: unknown[]) => void): void;
  send(data: unknown): void;
  close?(): void;
};

export type ConnectUpstream = (url: string) => UpstreamSocket;

const UPSTREAM_URL =
  // ADR 0007 §2 / Amendment B Corrections 1 & 2: ephemeral token requires
  // BidiGenerateContentConstrained and access_token URL query param
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained";

export function createLiveRelay(deps: { connectUpstream: ConnectUpstream }) {
  return {
    relay(
      browserSocket: { on(event: string, cb: (...args: unknown[]) => void): void; send(data: unknown): void },
      opts: { token: string; model: string },
    ): void {
      const url = `${UPSTREAM_URL}?access_token=${encodeURIComponent(opts.token)}`;
      const upstream = deps.connectUpstream(url);
      let upstreamOpen = false;
      const pending: unknown[] = [];
      upstream.on("open", () => {
        upstream.send(JSON.stringify({ setup: buildLiveSetup({ model: opts.model }) }));
        for (const m of pending) upstream.send(m);
        pending.length = 0;
        upstreamOpen = true;
      });
      upstream.on("message", (data: unknown) => browserSocket.send(data));
      browserSocket.on("message", (data) => {
        if (upstreamOpen) {
          upstream.send(data);
        } else {
          pending.push(data);
        }
      });
      browserSocket.on("close", () => upstream.close?.());
    },
  };
}
