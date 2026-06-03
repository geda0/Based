import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.js";

// M3 seam (ADR 0006): POST /narrate takes a PerceptionEvent's SAFE fields and
// returns { utterance } — one short line. Gemini is injected so the test stubs it
// and never hits the live model.
describe("POST /narrate", () => {
  it("returns 200 with a single non-empty line when given a well-formed body", async () => {
    const utter = "listen — eyes on RunnerX";
    const calls: unknown[] = [];
    const gemini = {
      narrate: async (input: unknown) => {
        calls.push(input);
        return utter;
      },
    };
    const app = buildApp({ gemini });

    const res = await app.inject({
      method: "POST",
      url: "/narrate",
      payload: {
        type: "reveal",
        narrative: "Speedrunner attempting the final trick for a world record",
        confidenceTier: 2,
        streamer: "RunnerX",
        eventScore: 0.9,
      },
    });

    expect(res.statusCode).toBe(200);

    const body = res.json() as { utterance: string };
    expect(typeof body.utterance).toBe("string");
    expect(body.utterance.length).toBeGreaterThan(0);
    expect(body.utterance).not.toMatch(/\n/);
    expect(body.utterance).toBe(utter);
  });

  it("caps the utterance to a bounded length when the model returns a long line", async () => {
    // Silence/spend hygiene (§10): the model is asked for one short line (~20 words),
    // but a runaway response must not become a paragraph the host "speaks". The proxy
    // caps the returned utterance to a bounded length. Length has a cheap, reliable
    // oracle — so we assert a generous upper bound on word count here.
    const longLine = Array.from({ length: 60 }, (_, i) => "word" + i).join(" ");
    const gemini = {
      narrate: async () => longLine,
    };
    const app = buildApp({ gemini });

    const res = await app.inject({
      method: "POST",
      url: "/narrate",
      payload: {
        type: "reveal",
        narrative: "Speedrunner attempting the final trick for a world record",
        confidenceTier: 2,
        streamer: "RunnerX",
        eventScore: 0.9,
      },
    });

    expect(res.statusCode).toBe(200);

    const body = res.json() as { utterance: string };
    // Bounded: a generous cap around the §10 "~20 words" — the implementer picks
    // the exact cap (<= 30). A 60-word model line must not pass through whole.
    expect(body.utterance.trim().split(/\s+/).length).toBeLessThanOrEqual(30);
    // Still a usable, single non-empty line.
    expect(body.utterance.trim().length).toBeGreaterThan(0);
    expect(body.utterance).not.toMatch(/\n/);
  });

  it("returns 400 and does not call Gemini when the body is malformed", async () => {
    // Cost-gating on the backend side: an invalid request must be rejected before
    // any spend — Gemini is never asked to narrate a body that fails validation.
    const calls: unknown[] = [];
    const gemini = {
      narrate: async (input: unknown) => {
        calls.push(input);
        return "x";
      },
    };
    const app = buildApp({ gemini });

    const res = await app.inject({
      method: "POST",
      url: "/narrate",
      payload: {
        type: "reveal",
        narrative: "Speedrunner attempting a trick",
        confidenceTier: 9, // out of range (valid is 1..4) — only this field is wrong
        streamer: "RunnerX",
        eventScore: 0.9,
      },
    });

    expect(res.statusCode).toBe(400);
    expect(calls.length).toBe(0);
  });

  it("ignores a key supplied in the body so it never reaches Gemini or the response", async () => {
    // Invariant (ADR 0003): secrets-from-env. The Gemini API key comes from
    // process.env only — a body-supplied key is stripped before Gemini is called
    // and never echoed back. This guards against the route passing the raw body
    // (instead of the zod-validated safe fields) to the model.
    const received: unknown[] = [];
    const gemini = {
      narrate: async (input: unknown) => {
        received.push(input);
        return "listen — eyes on X";
      },
    };
    const app = buildApp({ gemini });

    const res = await app.inject({
      method: "POST",
      url: "/narrate",
      payload: {
        type: "reveal",
        narrative: "Speedrunner attempting a trick",
        confidenceTier: 2,
        streamer: "RunnerX",
        eventScore: 0.9,
        apiKey: "BOGUS-KEY-123",
        GEMINI_API_KEY: "BOGUS-KEY-456",
      },
    });

    // The valid safe fields pass; the smuggled key fields don't break the request.
    expect(res.statusCode).toBe(200);

    // Gemini received only the safe fields — no key field rode along.
    expect(received[0]).not.toHaveProperty("apiKey");
    expect(received[0]).not.toHaveProperty("GEMINI_API_KEY");

    // Neither bogus key value is reflected back over the wire.
    const wire = JSON.stringify(res.json());
    expect(wire).not.toContain("BOGUS-KEY-123");
    expect(wire).not.toContain("BOGUS-KEY-456");
  });
});
