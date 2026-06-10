import { test, expect } from "@playwright/test";

// R3 — the Based TV journey. ONE hermetic, deterministic critical path on the
// FE-only mock graph (no backend, no API keys). Every assertion is client-side
// and deterministic against `frontend/src/mocks/event-graph.ts`.
//
// Deterministic facts derived from the ranker (W_HEAT/NOVELTY/LEGIBILITY/
// CONFIDENCE) over the mock events:
//   index 0 (initial player, before Start) = evt_clutch_comeback -> channel=caedrel247
//   index 4 (rail)                         = evt_lol_draft        -> channel=lirik_247
// The rail label is the SAFE `type · streamer` form (ADR 0009), never the
// outcome-bearing narrative.
//
// Surf target = lirik_247. On Start the source feed begins and the host
// AUTONOMOUSLY cuts the player as events arrive (the /narrate speak is dropped
// without a backend, but the cutTo is kept by design). Its cut schedule is:
//   ts≈1ms → rifftrax, 16s → 247jynxzi, 31s → caedrel247, 47s → lirik_247, …
// lirik_247 is the LAST channel the host reaches (≈47s), and is unique to one
// event — so a user click on it, performed seconds after Start, moves the player
// purely because of the click and stays put through the assertion window. This
// makes the manual-surf assertion deterministic, not a race with the host.

const TOP_EMBED_CHANNEL = "caedrel247"; // initial player src (top-ranked event, pre-Start)
const SURF_LABEL = "reveal · lirik_247"; // rail label for evt_lol_draft
const SURF_EMBED_CHANNEL = "lirik_247"; // its embed channel — host won't auto-cut here until ≈47s

// Outcome words that live ONLY in mock narratives (not in any `type`/`streamer`),
// so they must never leak onto the viewer-facing rail.
const SPOILER_WORDS = ["reverse sweep", "insurmountable", "underdog", "world record"];

test("Based TV journey: load → wake host → surf, spoiler-safe throughout", async ({ page }) => {
  // 1) Cold load on the mock path: shell, CTA, player, and rail all render.
  await page.goto("/");

  await expect(page.locator(".app-wordmark")).toHaveText("Based");

  const startCta = page.getByRole("button", { name: /start watching/i });
  await expect(startCta).toBeVisible();

  const player = page.locator('iframe[title="player"]');
  await expect(player).toBeVisible();
  // Player opens on the top-ranked event's vantage (deterministic).
  await expect(player).toHaveAttribute("src", new RegExp(`channel=${TOP_EMBED_CHANNEL}`));

  const rail = page.getByRole("complementary", { name: /channel rail/i });
  const railButtons = rail.locator("button.channel-card-btn");
  await expect(railButtons.first()).toBeVisible();
  expect(await railButtons.count()).toBeGreaterThan(1);

  // 2) Wake the host: clicking Start voices the client-side digest, so the
  //    Character transitions to its speaking state and surfaces the caption.
  await startCta.click();

  const host = page.getByRole("status", { name: /host speaking/i });
  await expect(host).toBeVisible();
  await expect(host).toHaveAttribute("data-state", "speaking");
  // The digest caption is the host's spoken text (action: 'digest').
  await expect(host.locator(".host-caption")).toContainText("Feed is heating up");

  // 3) Surf: click a rail channel and confirm the player cuts to its vantage.
  //    Capture the src right before the click, then assert it moves to the
  //    selected channel and genuinely changed (manual surf works).
  const srcBeforeSurf = await player.getAttribute("src");
  await rail.getByRole("button", { name: SURF_LABEL }).click();
  await expect(player).toHaveAttribute("src", new RegExp(`channel=${SURF_EMBED_CHANNEL}`));
  expect(await player.getAttribute("src")).not.toBe(srcBeforeSurf);

  // 4) Spoiler-safety invariant (ADR 0009): the rail exposes only the safe
  //    `type · streamer` label and never the outcome-bearing narrative.
  await expect(rail.getByRole("button", { name: SURF_LABEL })).toBeVisible();
  const railText = (await rail.innerText()).toLowerCase();
  for (const spoiler of SPOILER_WORDS) {
    expect(railText).not.toContain(spoiler);
  }
});
