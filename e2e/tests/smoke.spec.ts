import { test, expect } from "@playwright/test";

// Critical-path placeholder. Replace with a real journey (e.g. sign up -> log in
// -> core action). Skipped until a running stack + webServer is configured.
test.skip("user can load the app and see the heading", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /saas app/i })).toBeVisible();
});
