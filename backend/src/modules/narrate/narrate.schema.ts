import { z } from "zod";

// ADR 0006 seam: zod schema for the §10 safe-input projection the FE sends.
// Single source of truth — NarrateRequestBody is inferred from this. Validating
// here is the no-spend gate: a malformed body 400s before Gemini is ever called.
export const narrateRequestSchema = z.object({
  type: z.enum(["clutch", "reveal", "drama", "launch", "irl", "other"]),
  narrative: z.string().min(1),
  confidenceTier: z.number().int().min(1).max(4),
  streamer: z.string().optional(),
  eventScore: z.number(),
});

export type NarrateRequestBody = z.infer<typeof narrateRequestSchema>;
