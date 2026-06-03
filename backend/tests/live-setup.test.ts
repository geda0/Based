import { describe, it, expect } from "vitest";
import { buildLiveSetup } from "../src/modules/live/live-setup.js";

// WIRE CONTRACT (ADR 0007 §2): the Gemini Live `setup` frame the relay sends ONCE,
// server-side, to open a BidiGenerateContent WSS session. Two facts are load-bearing
// and silently break the session if wrong, so they are pinned here:
//   1. The model id MUST be prefixed with `models/` (the Live API rejects a bare id).
//      Default model is `gemini-3.1-flash-live-preview` → `models/gemini-3.1-flash-live-preview`.
//   2. Output is AUDIO-ONLY: responseModalities is EXACTLY ["AUDIO"]. Mixing AUDIO+TEXT
//      silently hangs the session ~45-60s (ADR 0007 Alternatives), so one modality only.
// The persona/no-spoiler systemInstruction is a SEPARATE later behavior — not asserted here.
describe("buildLiveSetup", () => {
  it("targets the default model prefixed with models/ and requests audio-only output", () => {
    const setup = buildLiveSetup();

    // §2: model id appears PREFIXED — the default `gemini-3.1-flash-live-preview`
    // becomes `models/gemini-3.1-flash-live-preview` on the wire.
    expect(setup.model).toBe("models/gemini-3.1-flash-live-preview");

    // §2: EXACTLY ONE modality, AUDIO. Never ["AUDIO","TEXT"].
    expect(setup.generationConfig.responseModalities).toEqual(["AUDIO"]);
  });

  // INVARIANT (ADR 0007 §spoiler-safety + ADR 0006): spoiler-safety as
  // defense-in-depth INSIDE the Live session. The relay can't reliably scrub a
  // spoiler from live model audio, so the control is the systemInstruction the
  // setup frame carries — the model is told to speak only what it's given and to
  // NEVER reveal an outcome. Per the Live wire shape this nests at
  // setup.systemInstruction.parts[0].text (a string). Exact persona copy is the
  // §13 voice call and tunable — assert the no-spoiler STRUCTURE only, mirroring
  // the narration prompt's no-spoiler assertion (narrate-prompt.test.ts).
  it("carries a systemInstruction that encodes the no-spoiler rule", () => {
    const setup = buildLiveSetup();

    // The setup frame carries a systemInstruction nested at the Live wire shape
    // setup.systemInstruction.parts[0].text — assert the structure is present
    // first so a missing instruction reads as the absent no-spoiler control,
    // not an incidental property-access crash.
    const instruction = setup.systemInstruction?.parts?.[0]?.text;
    expect(instruction).toEqual(expect.any(String));
    // Type-narrow for the matchers below; the expect above is the structural
    // assertion that fails (not a property-access crash) if it's absent.
    if (typeof instruction !== "string") {
      throw new Error("expected systemInstruction text to be a string");
    }

    expect(instruction.length).toBeGreaterThan(0);

    // §spoiler-safety: the no-spoiler rule is encoded — name the concept and
    // prohibit it, exactly as the narration prompt does.
    expect(instruction).toMatch(/spoil|outcome|reveal/i);
    expect(instruction).toMatch(/never|don'?t|not\b/i);
  });
});
