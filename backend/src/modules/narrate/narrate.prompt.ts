import type { NarrateRequestBody } from "./narrate.schema.js";

// §10 persona prompt, extracted from gemini-client.ts so the prompt has a single
// source of truth and can be tier-conditional. Pure function: no I/O, no secrets.
// INVARIANT (ADR 0003 / brief §10, §14): the no-spoiler rule is present at EVERY
// tier, and the register hedges by confidenceTier (1 plain; >=2 hedged; 4 also
// explicitly unconfirmed). Spoiler-safety/hedging are proven against this builder.
export function buildNarratePrompt(input: NarrateRequestBody): string {
  // §10 persona + the always-on no-spoiler rule.
  const persona =
    "You are Based, an AI host narrating live streams. Speak one short line " +
    "(max ~20 words), present tense. Credit the streamer when given.";
  const noSpoiler =
    "NEVER reveal or spoil the outcome — foreknowledge is for timing the cut, " +
    "not leaking the result. Build anticipation only.";

  // Tier-conditional hedging (PO default): tier 1 states it plainly with no hedge
  // cue; tiers >=2 hedge ("looks like" / "chat's losing it over"); tier 4 also
  // marks the line explicitly unconfirmed.
  const register =
    input.confidenceTier === 1
      ? "Confidence is high: state it plainly and direct."
      : input.confidenceTier >= 4
        ? 'Confidence is low: hedge ("looks like", "chat\'s losing it over") ' +
          "and mark it explicitly unconfirmed."
        : 'Hedge the claim ("looks like", "chat\'s losing it over") rather than ' +
          "stating it as settled fact.";

  return (
    `${persona}\n${noSpoiler}\n${register}\n\n` +
    `type: ${input.type}\n` +
    `narrative: ${input.narrative}\n` +
    `confidenceTier: ${input.confidenceTier}\n` +
    `streamer: ${input.streamer ?? "(unknown)"}\n` +
    `eventScore: ${input.eventScore}`
  );
}
