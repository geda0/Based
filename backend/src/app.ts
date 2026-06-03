import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { registerHealthRoutes } from "./modules/health/health.routes.js";
import { registerNarrateRoutes, type GeminiClient } from "./modules/narrate/narrate.routes.js";
import { createGeminiClient } from "./modules/narrate/gemini-client.js";

// App factory so tests build an instance and use app.inject() — no real network.
// Gemini is injectable so tests stub it; defaults to the real REST client.
export function buildApp(opts?: { gemini?: GeminiClient }): FastifyInstance {
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
  return app;
}
