import type { FastifyInstance } from "fastify";
import { liveSessionRequestSchema } from "./live.schema.js";
import { buildLiveSetup } from "./live-setup.js";

// The injectable mint seam (mirrors the GeminiClient seam in narrate.routes.ts):
// one async method, so tests inject a stub and the real @google/genai client
// (authTokens.create, ADR 0007 §7 / Amendment A1) swaps in later. It returns a
// SHORT-LIVED ephemeral token + its hard-expiry instant; the long-lived
// GEMINI_API_KEY never transits (ADR 0007 §8 secrets-from-env).
export interface LiveTokenClient {
  mintToken(): Promise<{ token: string; expiresAt: string }>;
}

const DEFAULT_LIVE_MODEL = "gemini-3.1-flash-live-preview";

export function registerLiveRoutes(app: FastifyInstance, mintClient: LiveTokenClient): void {
  // The HTTP contract is what tests assert (via app.inject), not internals.
  app.post("/live/session", async (request, reply) => {
    // No-spend gate: validate BEFORE minting so a body that is not an object 400s
    // and the mint client is never called (validate-before-spend, ADR 0007 §8).
    const parsed = liveSessionRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: "invalid live session request" };
    }
    const { token, expiresAt } = await mintClient.mintToken();
    // BARE model id — the `models/` prefix is the relay/buildLiveSetup's job,
    // never this route's (ADR 0007 §2).
    const model = process.env.GEMINI_LIVE_MODEL ?? DEFAULT_LIVE_MODEL;
    return { token, model, expiresAt, setup: { setup: buildLiveSetup({ model }) } };
  });
}
