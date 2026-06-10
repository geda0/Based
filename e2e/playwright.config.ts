import { defineConfig } from "@playwright/test";
// Reserve e2e for critical journeys only (see docs/testing-strategy.md).
//
// R3 — the Based TV journey runs hermetically on the FE-only MOCK path: no
// backend, no API keys, CI-friendly. The webServer below boots the frontend dev
// build WITHOUT VITE_USE_REMOTE_SOURCE / VITE_LIVE_VOICE, so `events` come from
// the deterministic mock graph and the digest voices client-side on Start. The
// host stays failure-silent for per-event narration (no /narrate backend), so the
// journey only asserts client-side, deterministic state.
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:5173";

export default defineConfig({
  testDir: "./tests",
  use: { baseURL: BASE_URL },
  webServer: {
    // Mock path: plain `vite` dev with no remote-source / live-voice flags.
    command: "pnpm --filter @app/frontend dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
