import { defineConfig } from "@playwright/test";
// Reserve e2e for critical journeys only (see docs/testing-strategy.md).
export default defineConfig({
  testDir: "./tests",
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173" },
  // To run against a live stack, configure a webServer here that boots FE+BE.
});
