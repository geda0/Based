import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createLiveTokenClient } from "../src/modules/live/live-token-client.js";

// INVARIANT (ADR 0007 §8 secrets-from-env — the HIGHEST-RISK invariant of LV1):
// the long-lived key is sourced from `process.env.GEMINI_API_KEY` ONLY and flows
// into the @google/genai mint call — never hardcoded, never read from a request
// body, and never returned to the caller (only the short-lived ephemeral token is).
//
// The real `@google/genai` `authTokens.create` is the untested I/O edge (mirrors
// M3's gemini-client.ts treating `fetch`), so the mint is INJECTABLE: the client is
// `createLiveTokenClient(deps?: { mint?: MintFn })` where
//   MintFn = (apiKey: string, model: string) => Promise<{ token: string; expiresAt: string }>
// The default `mint` is the real SDK call (deferred — left throwing until the dep is
// wired at release-prep); the suite always injects a fake mint so it never needs the
// (uninstalled) SDK and never hits the network. The client reads
// `process.env.GEMINI_API_KEY` + `process.env.GEMINI_LIVE_MODEL` (default the BARE id
// `gemini-3.1-flash-live-preview`) and calls `mint(apiKey, model)`; `mintToken()`
// returns that result verbatim.
//
// Scope: exactly ONE behavior — env-only sourcing of the long-lived key into the mint
// call. The "throws when the env key is absent" case and the route-level
// "body-supplied key ignored" case are SEPARATE later cycles, not asserted here.
describe("createLiveTokenClient", () => {
  // Save/restore the env knobs this client reads so no value leaks across tests.
  const previousApiKey = process.env.GEMINI_API_KEY;
  const previousModel = process.env.GEMINI_LIVE_MODEL;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = "SENTINEL-LONGLIVED-KEY";
    // Leave GEMINI_LIVE_MODEL unset so the client falls back to its BARE default;
    // a leftover value from another test must not mask the default-model assertion.
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

  it("sources the long-lived key from process.env, passes it to the injected mint, and returns only the mint's token", async () => {
    // The fake mint records the (apiKey, model) it was handed and returns a fixed
    // ephemeral result — proving the ENV key flows INTO the mint call and that the
    // long-lived key is NOT what comes back out.
    const minted = { token: "ephemeral-x", expiresAt: "2026-06-02T23:30:00.000Z" };
    const mintArgs: { apiKey: string; model: string }[] = [];
    const fakeMint = async (apiKey: string, model: string) => {
      mintArgs.push({ apiKey, model });
      return minted;
    };

    const result = await createLiveTokenClient({ mint: fakeMint }).mintToken();

    // The mint was called EXACTLY ONCE...
    expect(mintArgs).toHaveLength(1);
    // ...with the long-lived key read from process.env.GEMINI_API_KEY (never
    // hardcoded, never from a body)...
    expect(mintArgs[0]?.apiKey).toBe("SENTINEL-LONGLIVED-KEY");
    // ...and the BARE default model id (the `models/` prefix is the relay's job).
    expect(mintArgs[0]?.model).toBe("gemini-3.1-flash-live-preview");

    // mintToken() returns the injected mint's result verbatim — the short-lived
    // ephemeral token, NOT the long-lived env key.
    expect(result).toEqual(minted);
    expect(JSON.stringify(result)).not.toContain("SENTINEL-LONGLIVED-KEY");
  });

  it("rejects without calling mint when the long-lived env key is absent (no spend without the key)", async () => {
    // Secrets-from-env, key-safety face (ADR 0007 §8): with no long-lived key in
    // the env there is nothing to mint WITH, so mintToken() must refuse BEFORE it
    // reaches the SDK — minting with `undefined` would "spend" against no key.
    delete process.env.GEMINI_API_KEY;

    // The fake mint must never run; a counter proves zero spend.
    let mintCalls = 0;
    const fakeMint = async (apiKey: string, model: string) => {
      mintCalls += 1;
      return { token: `ephemeral-${apiKey}-${model}`, expiresAt: "2026-06-02T23:30:00.000Z" };
    };

    await expect(
      createLiveTokenClient({ mint: fakeMint }).mintToken(),
    ).rejects.toThrow(/GEMINI_API_KEY/);

    // No key ⇒ no mint ⇒ no spend.
    expect(mintCalls).toBe(0);
  });
});
