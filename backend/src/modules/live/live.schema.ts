import { z } from "zod";

// ADR 0007 seam: zod schema for the POST /live/session body, mirroring
// narrate.schema.ts. Validating here is the no-spend gate (validate-before-spend):
// a body that is not an object 400s BEFORE the mint client is ever called.
// Non-strict (.passthrough()) — a stray key is IGNORED, not rejected; the empty
// object {} is the valid request. The object-key/secrets handling is a later cycle.
export const liveSessionRequestSchema = z.object({}).passthrough();

export type LiveSessionRequestBody = z.infer<typeof liveSessionRequestSchema>;
