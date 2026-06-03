import { GoogleGenAI } from "@google/genai";
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

// The default REAL mint — the untested I/O edge (live-probe.ts validated the
// exact SDK API against the real account). Mirrors live-probe.ts exactly:
//   client.authTokens.create({ config: { uses, expireTime, newSessionExpireTime } })
// The `model` param is part of the MintFn contract (used later in the setup frame
// by the relay) but the mint itself does not pass it to authTokens.create.
// ADR 0007 §7 / Amendment B.
const defaultMint: MintFn = async (apiKey: string, model: string) => {
  // `model` is part of the MintFn contract (used in the setup frame by the relay)
  // but authTokens.create does not take a model — reference it harmlessly to satisfy lint.
  void model;
  const client = new GoogleGenAI({
    apiKey,
    httpOptions: { apiVersion: "v1alpha" },
  });

  const now = Date.now();
  // ~10-min hard expiry — the token is unusable after this (ADR 0007 §reference).
  const expireTime = new Date(now + 10 * 60_000).toISOString();
  // ~3-min open-session window — the live session must start within this window.
  const newSessionExpireTime = new Date(now + 3 * 60_000).toISOString();

  const authToken = await client.authTokens.create({
    config: { uses: 1, expireTime, newSessionExpireTime },
  });

  // The SDK returns only `.name` (the token value, starts with `auth_tokens/`).
  // There is no `.token` or `.expiresAt` field on AuthToken — we supply both from
  // what we passed in (Correction 3 from release-prep spec).
  if (!authToken.name) {
    throw new Error(
      "@google/genai authTokens.create returned an AuthToken with no `name` — unexpected SDK shape",
    );
  }

  return { token: authToken.name, expiresAt: expireTime };
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
