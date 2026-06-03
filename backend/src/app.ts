import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { registerHealthRoutes } from "./modules/health/health.routes.js";
import { registerNarrateRoutes, type GeminiClient } from "./modules/narrate/narrate.routes.js";
import { createGeminiClient } from "./modules/narrate/gemini-client.js";
import { registerLiveRoutes, type LiveTokenClient } from "./modules/live/live.routes.js";
import { createLiveTokenClient } from "./modules/live/live-token-client.js";

// App factory so tests build an instance and use app.inject() — no real network.
// Gemini + the live mint client are injectable so tests stub them; each defaults
// to its real client.
export function buildApp(opts?: { gemini?: GeminiClient; liveMint?: LiveTokenClient }): FastifyInstance {
  const app = Fastify({ logger: false });
  // Allowlist read at call time so tests/env can set CORS_ORIGINS per build.
  const origins = (process.env.CORS_ORIGINS ?? "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  app.register(cors, { origin: origins });
  registerHealthRoutes(app);
  const gemini = opts?.gemini ?? createGeminiClient();
  registerNarrateRoutes(app, gemini);
  registerLiveRoutes(app, opts?.liveMint ?? createLiveTokenClient());
  return app;
}
