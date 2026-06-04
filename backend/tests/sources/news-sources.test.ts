import { describe, it, expect } from "vitest";
import { createNewsSources } from "../../src/modules/sources/news-sources.js";
import { createSourceRegistry } from "../../src/modules/sources/source-registry.js";

// M5-P3 R2 c1 — the NEWS-DEFAULT seed (ADR 0010; m5-youtube-reference.md
// "News-default seed channels"). Based TV's default lens is NEWS (the navigator's
// vision: "default should be news"). `createNewsSources()` is the production seed
// factory: it wires the YouTube Source with the 5 VERIFIED news channels (BBC,
// Reuters, AP, Sky, NBC) and returns the production `Source[]` that `server.ts`
// passes to `buildApp({ sources })`. Production calls it with NO args (the YouTube
// Source then reads process.env.YOUTUBE_API_KEY + global fetch); the optional
// `{ apiKey, fetchImpl }` thread a key + a hermetic fetch in for this test so the
// suite never touches the network.
//
// The OBSERVABLE contract proven here: every seeded channel is actually QUERIED
// when the sources are drained. The YouTube Source converts each UC… channel id to
// its UU… uploads playlist (UC→UU string swap) and calls playlistItems.list with
// that playlist id — so each seeded channel's id-SUFFIX (the part after the UC/UU
// prefix, which the conversion leaves untouched) must appear in some requested URL.
// Asserting the suffix (not the UC/UU prefix) keeps the test robust to the uploads-
// playlist conversion: it proves the right channel was reached without coupling to
// the prefix-swap mechanics.
describe("createNewsSources", () => {
  it("seeds the YouTube source so every news channel is queried", async () => {
    // Arrange — a fetchImpl SPY that records every requested URL and returns empty
    // playlist pages, so no videos.list follow-up fires and no events are produced.
    // We only care about WHICH channels were reached, captured via the URLs.
    const urls: string[] = [];
    const fetchImpl = (async (u: string) => {
      urls.push(u);
      return { ok: true, json: async () => ({ items: [] }) };
    }) as unknown as typeof fetch;

    // Act — build the production seed (with a key so fetch isn't no-key short-
    // circuited), then drain every source through the registry so each one fetches.
    const sources = createNewsSources({ apiKey: "k", fetchImpl });
    await createSourceRegistry(sources).fetchAll();

    // Assert (1) — the seed is non-empty (it actually wires at least one Source).
    expect(sources.length).toBeGreaterThanOrEqual(1);

    // (2) — every one of the 5 verified news channels was queried. Each entry is the
    // channel id with the UC prefix stripped — the suffix the UC→UU swap preserves —
    // for BBC, Reuters, AP, Sky, NBC respectively (m5-youtube-reference.md).
    const suffixes = [
      "16niRr50-MSBwiO3YDb3RA", // BBC News    (UC16niRr50-MSBwiO3YDb3RA)
      "hqUTb7kYRX8-EiaN3XFrSQ", // Reuters     (UChqUTb7kYRX8-EiaN3XFrSQ)
      "wSNeFq42XE7DuN7_p3ySsQ", // AP          (UCwSNeFq42XE7DuN7_p3ySsQ)
      "oMdktPbSTixAyNGwb-UYkQ", // Sky News    (UCoMdktPbSTixAyNGwb-UYkQ)
      "eY0bbntWzzVIaj2z3QigXg", // NBC News    (UCeY0bbntWzzVIaj2z3QigXg)
    ];
    for (const s of suffixes) {
      expect(urls.some((u) => u.includes(s))).toBe(true);
    }
  });
});
