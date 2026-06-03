import type { FastifyInstance } from "fastify";
import { narrateRequestSchema, type NarrateRequestBody } from "./narrate.schema.js";

// ADR 0006 seam: the §10 safe-input projection of a PerceptionEvent the FE sends
// and the backend narrates from. NOT the whole event — no vantages/embedUrl/source.
// Body shape is the single source of truth in narrate.schema.ts.
export type { NarrateRequestBody };

// The injectable Gemini seam (mirrors the Speaker seam in frontend/src/lib/speak.ts):
// one async method, so tests inject a stub and the real REST client swaps in.
export interface GeminiClient {
  narrate(input: NarrateRequestBody): Promise<string>;
}

export function registerNarrateRoutes(app: FastifyInstance, gemini: GeminiClient): void {
  // The HTTP contract is what tests assert (via app.inject), not internals.
  app.post("/narrate", async (request, reply) => {
    // No-spend gate: validate BEFORE calling Gemini so a malformed body 400s and
    // the model is never asked to narrate input that failed validation.
    const parsed = narrateRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: "invalid narrate request" };
    }
    const raw = await gemini.narrate(parsed.data);
    // Sanitize to a single, trimmed line — §10 wants one short line, no newlines.
    const oneLine = raw.replace(/\s*\n+\s*/g, " ").trim();
    // Silence/spend hygiene (§10): bound a runaway model line to ~20 words so the
    // host never "speaks" a paragraph. A short line passes through unchanged.
    const MAX_WORDS = 20;
    const words = oneLine.split(/\s+/);
    const utterance =
      words.length > MAX_WORDS ? words.slice(0, MAX_WORDS).join(" ") + "…" : oneLine;
    return { utterance };
  });
}
