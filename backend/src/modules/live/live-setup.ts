// WIRE CONTRACT (ADR 0007 §2): builds the Gemini Live `setup` frame the relay
// sends ONCE, server-side, to open a BidiGenerateContent WSS session. Pure
// function: no I/O, no env reads, no secrets — the route/relay resolves
// process.env.GEMINI_LIVE_MODEL and passes it as opts.model.
//
// Two facts are load-bearing (ADR 0007 §2):
//   1. The model id MUST be prefixed with `models/` (the Live API rejects a bare
//      id). Default is `gemini-3.1-flash-live-preview`.
//   2. Output is AUDIO-ONLY: responseModalities is EXACTLY ["AUDIO"]. Mixing
//      AUDIO+TEXT silently hangs the session.

const DEFAULT_MODEL = "gemini-3.1-flash-live-preview";

// INVARIANT (ADR 0007 §spoiler-safety + ADR 0006): defense-in-depth INSIDE the
// Live session. The relay can't scrub a spoiler from live audio, so the control
// is this systemInstruction — the model speaks ONLY the line it's given (already
// spoiler-safe from /narrate) and never reveals an outcome. Kept consistent with
// buildNarratePrompt's §10 persona + no-spoiler rule. (DRY: the persona/no-spoiler
// copy is duplicated with narrate.prompt.ts — extract a shared string in a later
// refactor; an inline default is acceptable for now.)
const DEFAULT_SYSTEM_INSTRUCTION =
  "You are Based, an AI host narrating live streams. Speak ONLY the exact line " +
  "you are given, verbatim — never improvise, add, or change words. NEVER reveal " +
  "or spoil the outcome of anything happening on stream. Build anticipation only.";

export interface LiveSetup {
  model: string;
  generationConfig: {
    responseModalities: ["AUDIO"];
  };
  systemInstruction: {
    parts: Array<{ text: string }>;
  };
}

export function buildLiveSetup(opts?: {
  model?: string;
  systemInstruction?: string;
}): LiveSetup {
  return {
    model: `models/${opts?.model ?? DEFAULT_MODEL}`,
    generationConfig: {
      responseModalities: ["AUDIO"],
    },
    systemInstruction: {
      parts: [{ text: opts?.systemInstruction ?? DEFAULT_SYSTEM_INSTRUCTION }],
    },
  };
}
