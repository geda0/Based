import { describe, it, expect, afterEach } from "vitest";
import { buildApp } from "../src/app.js";

describe("CORS allowlist", () => {
  const previous = process.env.CORS_ORIGINS;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.CORS_ORIGINS;
    } else {
      process.env.CORS_ORIGINS = previous;
    }
  });

  it("reflects an allowed origin but not one outside the allowlist", async () => {
    process.env.CORS_ORIGINS = "https://allowed.example";
    const app = buildApp();

    const allowed = await app.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "https://allowed.example" },
    });
    expect(allowed.headers["access-control-allow-origin"]).toBe(
      "https://allowed.example",
    );

    const blocked = await app.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "https://evil.example" },
    });
    expect(blocked.headers["access-control-allow-origin"]).not.toBe(
      "https://evil.example",
    );
  });
});
