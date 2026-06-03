import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildApp } from "../src/app.js";

// LV1 seam (ADR 0007 §7 + Amendment A1 "token-flow option B"): POST /live/session
// mints a SHORT-LIVED ephemeral token via the @google/genai authTokens.create call,
// which is INJECTED (a stub here, exactly like M3 injects `gemini`) so the suite
// never hits the network. The success body is the architect-fixed contract:
//   { token: "<short-lived ephemeral>", model: "<BARE id>", expiresAt: "<ISO-8601>" }
// `model` is the BARE id `gemini-3.1-flash-live-preview` (the `models/` prefix is the
// relay/buildLiveSetup's job, NOT this route's). The long-lived GEMINI_API_KEY is
// NEVER on the wire — only the short-lived ephemeral token transits (Amendment A1).
// A real long-lived key in env so every "key never echoed" assertion is meaningful:
// the response must carry the EPHEMERAL token, never this sentinel.
const LONG_LIVED_KEY = "LONG-LIVED-SENTINEL-KEY-789";

describe("POST /live/session", () => {
  // Save/restore the env knobs these tests mutate so no value leaks between tests in
  // this file or to other files (mirrors live-token-client.test.ts). `beforeEach`
  // plants the long-lived sentinel and clears the model override so each test starts
  // from the BARE-default model; `afterEach` restores whatever the process had.
  const previousApiKey = process.env.GEMINI_API_KEY;
  const previousModel = process.env.GEMINI_LIVE_MODEL;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = LONG_LIVED_KEY;
    delete process.env.GEMINI_LIVE_MODEL;
  });

  afterEach(() => {
    if (previousApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = previousApiKey;
    }
    if (previousModel === undefined) {
      delete process.env.GEMINI_LIVE_MODEL;
    } else {
      process.env.GEMINI_LIVE_MODEL = previousModel;
    }
  });

  it("mints a short-lived ephemeral token via the injected mint client and returns the session payload", async () => {
    const ephemeralToken = "ephemeral-abc-123";
    const expiresAt = "2026-06-02T23:30:00.000Z";
    let mintCalls = 0;
    const liveMint = {
      // The injectable mint seam (mirrors M3's GeminiClient): the route assembles
      // the 200 body from what this returns plus the bare model id.
      mintToken: async () => {
        mintCalls += 1;
        return { token: ephemeralToken, expiresAt };
      },
    };
    const app = buildApp({ liveMint });

    // An empty JSON object body is a VALID request for the mint endpoint.
    const res = await app.inject({
      method: "POST",
      url: "/live/session",
      payload: {},
    });

    expect(res.statusCode).toBe(200);

    // The injected mint client was called exactly once (one mint per session request).
    expect(mintCalls).toBe(1);

    const body = res.json() as { token: string; model: string; expiresAt: string };
    // The short-lived ephemeral token the injected client minted rides back.
    expect(body.token).toBe(ephemeralToken);
    // BARE model id — never prefixed with `models/` (that prefix is the relay's job).
    expect(body.model).toBe("gemini-3.1-flash-live-preview");
    // An ISO-8601 hard-expiry instant is present (string).
    expect(typeof body.expiresAt).toBe("string");
    expect(body.expiresAt.length).toBeGreaterThan(0);

    // INVARIANT (ADR 0007 §8 secrets-from-env): the long-lived GEMINI_API_KEY is
    // NEVER on the wire — only the short-lived ephemeral token transits. Mirrors M3's
    // "key never echoed" assertion on the serialized response.
    const wire = JSON.stringify(res.json());
    expect(wire).not.toContain(LONG_LIVED_KEY);
  });

  it("returns 400 and does not mint when the body is not a valid object", async () => {
    // Validate-before-spend (mirrors M3's /narrate 400-no-spend): the route must
    // validate its body with its own local zod object-schema BEFORE doing any work.
    // A body that is valid JSON but NOT an object (here a JSON primitive) is rejected
    // by the schema, so the injected mint client is never called — no spend.
    let mintCalls = 0;
    const liveMint = {
      mintToken: async () => {
        mintCalls += 1;
        return { token: "ephemeral-should-not-mint", expiresAt: "2026-06-02T23:30:00.000Z" };
      },
    };
    const app = buildApp({ liveMint });

    // Valid JSON the object-schema must reject — exercises zod, not Fastify's
    // JSON-parse error (which a syntactically broken payload would trigger).
    const res = await app.inject({
      method: "POST",
      url: "/live/session",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify("not-an-object"),
    });

    expect(res.statusCode).toBe(400);
    // No spend before validation: the injected mint stub was never called.
    expect(mintCalls).toBe(0);
  });

  it("ignores a key supplied in the body and never echoes it or the long-lived key on the wire", async () => {
    // INVARIANT (ADR 0007 §8 secrets-from-env — the milestone's highest-risk rule,
    // mirrored here from M3's /narrate "body-key-ignored" test). The long-lived key
    // comes from process.env ONLY; the mint comes from the injected client ONLY. A
    // body that tries to smuggle a key in must NOT change the outcome and must NOT be
    // reflected back: the route assembles the 200 body purely from the mint result +
    // the bare model id, never from the request body. The non-strict (.passthrough())
    // schema lets the stray key fields through harmlessly — so the request still 200s.
    //
    // TRIPWIRE: this would FAIL if the route ever started echoing a body-supplied key
    // (e.g. spreading `request.body` into the response or handing it to the mint),
    // because the bogus value would then appear in the serialized wire payload.
    const ephemeralToken = "ephemeral-only-this-rides-back";
    const liveMint = {
      mintToken: async () => ({ token: ephemeralToken, expiresAt: "2026-06-02T23:30:00.000Z" }),
    };
    const app = buildApp({ liveMint });

    const BOGUS = "BOGUS-ATTACKER-KEY";
    const res = await app.inject({
      method: "POST",
      url: "/live/session",
      payload: { apiKey: BOGUS, GEMINI_API_KEY: BOGUS },
    });

    // The smuggled key fields are IGNORED — they don't break the request.
    expect(res.statusCode).toBe(200);

    // The response carries only the ephemeral token / model / expiresAt; neither the
    // body-supplied bogus value NOR the long-lived sentinel rides back over the wire.
    const wire = JSON.stringify(res.json());
    expect(wire).toContain(ephemeralToken);
    expect(wire).not.toContain(BOGUS);
    expect(wire).not.toContain(LONG_LIVED_KEY);
  });

  it("uses GEMINI_LIVE_MODEL as the response model when that env override is set", async () => {
    // The route's model knob has a SET branch as well as the BARE-default branch:
    // `model = process.env.GEMINI_LIVE_MODEL ?? DEFAULT_LIVE_MODEL`. The happy-path
    // test pins the default (env unset by beforeEach); this pins the override.
    //
    // TRIPWIRE: this would FAIL if the route ever ignored the env override and always
    // returned the hardcoded default — the asserted `model` would not match.
    const OVERRIDE_MODEL = "gemini-some-other-live-model";
    process.env.GEMINI_LIVE_MODEL = OVERRIDE_MODEL; // afterEach restores it.

    const liveMint = {
      mintToken: async () => ({ token: "ephemeral-xyz", expiresAt: "2026-06-02T23:30:00.000Z" }),
    };
    const app = buildApp({ liveMint });

    const res = await app.inject({
      method: "POST",
      url: "/live/session",
      payload: {},
    });

    expect(res.statusCode).toBe(200);

    const body = res.json() as { model: string };
    // The env override — not the bare default — is what the route reports as `model`.
    expect(body.model).toBe(OVERRIDE_MODEL);
  });
});
