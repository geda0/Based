import type { GeminiClient, NarrateRequestBody } from "./narrate.routes.js";
import { buildNarratePrompt } from "./narrate.prompt.js";

// The default REAL client: the untested I/O edge. Tests inject a stub instead
// (exactly like speak.ts's Web Speech default), so this thin wrapper is the only
// thing that touches the live model. Secrets come from env ONLY — never logged.
export function createGeminiClient(): GeminiClient {
  const apiKey = process.env.GEMINI_API_KEY ?? "";
  const model = process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";

  return {
    async narrate(input: NarrateRequestBody): Promise<string> {
      // §10 persona prompt (single source of truth in narrate.prompt.ts): a
      // live-stream host who never spoils outcomes and hedges to the tier.
      const prompt = buildNarratePrompt(input);

      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    },
  };
}
