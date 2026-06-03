import type { LiveTokenClient } from "./live.routes.js";

const DEFAULT_LIVE_MODEL = "gemini-3.1-flash-live-preview";

// The injectable mint seam: hands the long-lived key + bare model id to the real
// @google/genai authTokens.create call (the untested I/O edge, mirroring M3's
// gemini-client treating `fetch`). Tests inject a fake `mint`, so the real SDK
// call stays out of this cycle and the suite never hits the network.
export type MintFn = (
  apiKey: string,
  model: string,
) => Promise<{ token: string; expiresAt: string }>;

// The default REAL mint: the untested I/O edge. NOT WIRED YET — the real
// @google/genai authTokens.create call (ADR 0007 §7 / Amendment A1 "token-flow
// option B") lands in a later LV1 cycle, together with the relay + FE + infra
// that gate /live/session on in production. Tests always inject `mint`, so this
// throwing default keeps the suite hermetic and never pulls @google/genai into
// this cycle.
const defaultMint: MintFn = async () => {
  throw new Error(
    "@google/genai live token mint not wired yet — install @google/genai + implement authTokens.create at release-prep",
  );
};

export function createLiveTokenClient(deps?: { mint?: MintFn }): LiveTokenClient {
  return {
    async mintToken(): Promise<{ token: string; expiresAt: string }> {
      // Read the env knobs LAZILY at mint time (not at construction) so an absent
      // key never crashes app/buildApp construction — the "throw if absent" guard
      // is a separate later cycle. Secrets come from env ONLY (ADR 0007 §8): the
      // long-lived GEMINI_API_KEY flows INTO the mint call and never comes back.
      const apiKey = process.env.GEMINI_API_KEY;
      // No key ⇒ nothing to mint WITH ⇒ refuse BEFORE calling mint, so we never
      // "spend" against an absent/undefined key (ADR 0007 §8). Guarding here also
      // narrows `apiKey` from `string | undefined` to `string` — no cast needed.
      if (!apiKey) {
        throw new Error(
          "GEMINI_API_KEY is not set — cannot mint a live session token",
        );
      }
      // BARE model id — the `models/` prefix is the relay's job (ADR 0007 §2).
      const model = process.env.GEMINI_LIVE_MODEL ?? DEFAULT_LIVE_MODEL;
      // The long-lived GEMINI_API_KEY flows INTO the mint call and never comes
      // back out (only the short-lived ephemeral token is returned).
      return (deps?.mint ?? defaultMint)(apiKey, model);
    },
  };
}
