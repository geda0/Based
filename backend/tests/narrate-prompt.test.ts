import { describe, it, expect } from "vitest";
import { buildNarratePrompt } from "../src/modules/narrate/narrate.prompt.js";
import type { NarrateRequestBody } from "../src/modules/narrate/narrate.schema.js";

// INVARIANT (ADR 0003 / brief §10, §14): spoiler-safety + tier-hedging proven at the
// PROMPT level. For a *generated* line the real control is the prompt the proxy shapes
// (the proxy can't reliably detect a spoiler in arbitrary model output), so we assert on
// the prompt builder. The narration prompt ALWAYS carries the no-spoiler rule, and hedges
// by confidence tier: tier 1 → state plainly; tiers ≥2 → hedge ("looks like" / unconfirmed
// register). Exact copy is tunable per the §13 tier-hedging call — assert STRUCTURE only.
describe("buildNarratePrompt", () => {
  const base: NarrateRequestBody = {
    type: "clutch",
    narrative: "1v3 retake clutch to win the round",
    confidenceTier: 1,
    streamer: "CoStreamerA",
    eventScore: 0.9,
  };

  it("always carries the no-spoiler rule and hedges only when the confidence tier is >= 2", () => {
    const tier1 = buildNarratePrompt({ ...base, confidenceTier: 1 });
    const tier3 = buildNarratePrompt({ ...base, confidenceTier: 3 });

    // §10: "NEVER spoil an outcome … foreknowledge is for timing, not leaking."
    // The no-spoiler rule is present at EVERY tier — name the concept and prohibit it.
    expect(tier1).toMatch(/spoil|outcome|reveal/i);
    expect(tier1).toMatch(/never|don'?t|not\b/i);
    expect(tier3).toMatch(/spoil|outcome|reveal/i);
    expect(tier3).toMatch(/never|don'?t|not\b/i);

    // Tier-hedging: tier >= 2 instructs an unconfirmed / "looks like" register that
    // tier 1 (state plainly) does not. The prompt must actually vary by tier.
    expect(tier3).toMatch(/looks like|chat'?s|hedge|unconfirmed/i);
    expect(tier1).not.toMatch(/looks like|chat'?s|hedge|unconfirmed/i);
    expect(tier1).not.toBe(tier3);
  });
});
