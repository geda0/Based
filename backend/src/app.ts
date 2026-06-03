import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { registerHealthRoutes } from "./modules/health/health.routes.js";

// App factory so tests build an instance and use app.inject() — no real network.
export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });
  // Allowlist read at call time so tests/env can set CORS_ORIGINS per build.
  const origins = (process.env.CORS_ORIGINS ?? "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  app.register(cors, { origin: origins });
  registerHealthRoutes(app);
  return app;
}
