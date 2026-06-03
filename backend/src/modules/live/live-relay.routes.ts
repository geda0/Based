import type { FastifyInstance } from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import WebSocket from "ws";
import { createLiveRelay, type ConnectUpstream, type UpstreamSocket } from "./live-relay.js";

// Adapt a ws.WebSocket to the UpstreamSocket duck-type.
// ws.WebSocket's send(data: BufferLike) is narrower than UpstreamSocket's send(data: unknown),
// so a direct structural assignment fails. This adapter bridges the gap without `any`.
function toWsSocket(ws: WebSocket): UpstreamSocket {
  return {
    on: (event, cb) => { ws.on(event, cb as (...args: unknown[]) => void); },
    send: (data) => { ws.send(data as WebSocket.RawData); },
    close: () => ws.close(),
  };
}

export function registerLiveRelayRoute(app: FastifyInstance): void {
  // Encapsulate the WS plugin + the route in ONE child scope so they register
  // together. CRITICAL: @fastify/websocket transforms `{ websocket: true }` routes
  // via an `onRoute` hook that it installs when the plugin is APPLIED. `app.register`
  // is DEFERRED (applied at ready()), but `app.get(...)` fires its onRoute hook
  // SYNCHRONOUSLY at definition time — so registering the plugin and the route in the
  // same tick at the root means the route is defined BEFORE the plugin's onRoute hook
  // exists. The flag is then silently ignored, no WS upgrade happens, and the handler
  // runs as a plain HTTP route receiving (request, reply) — `req.query` is the Reply
  // (no `.query`), crashing with a 500 at upgrade (validated against the live relay).
  // Wrapping both in a child plugin guarantees the plugin is applied (its onRoute hook
  // live) BEFORE this scope's route is registered. buildApp stays synchronous and the
  // existing app.inject() HTTP tests are unaffected (the WS plugin is scoped here).
  app.register(async (scope) => {
    await scope.register(fastifyWebsocket);

    // GET /live/relay — browser connects here after receiving token from /live/session.
    // Token + model travel in the query string (never logged — they carry the ephemeral token).
    // In @fastify/websocket v8 the handler receives (connection: SocketStream, req) where
    // connection.socket is the ws.WebSocket for the browser connection.
    scope.get("/live/relay", { websocket: true }, (connection, req) => {
      const browserWs = connection.socket;
      const query = req.query as Record<string, string | undefined>;
      const token = query["token"] ?? "";
      const model = query["model"] ?? (process.env.GEMINI_LIVE_MODEL ?? "gemini-3.1-flash-live-preview");

      // Real connectUpstream: opens a new ws.WebSocket to the Google Live endpoint.
      const connectUpstream: ConnectUpstream = (url) => toWsSocket(new WebSocket(url));

      // Adapt the browser ws.WebSocket to the browserSocket duck-type (same shape as upstream).
      createLiveRelay({ connectUpstream }).relay(toWsSocket(browserWs), { token, model });
    });
  });
}
