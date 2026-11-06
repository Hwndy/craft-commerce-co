import { test, expect } from "@playwright/test";

test.describe("entry sequence", () => {
  test("clicking through lands on /gallery with the film already playing", async ({
    page,
    browserName,
  }) => {
    // Playwright's Linux WebKit build has no usable H.264/AAC decoder (no
    // native HLS, no MSE codec support) — see docs/decisions.md D-27. Real
    // Safari is unaffected; verify there by hand.
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");
    await page.goto("/");
    await page.getByRole("button", { name: "Enter ALL LIFE" }).click();

    // The full sequence runs ~7.3s; give it generous headroom in CI.
    await expect(page).toHaveURL(/\/gallery$/, { timeout: 15000 });

    const video = page.locator("video").last();
    await expect(video).toBeVisible();
    await expect
      .poll(async () => video.evaluate((el: HTMLVideoElement) => el.paused))
      .toBe(false);
  });

  test("Skip jumps straight to /gallery without waiting out the full sequence", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Enter ALL LIFE" }).click();
    await page.waitForTimeout(500);

    const start = Date.now();
    await page.getByRole("button", { name: "Skip entry animation" }).click();
    await expect(page).toHaveURL(/\/gallery$/, { timeout: 3000 });

    expect(Date.now() - start).toBeLessThan(2000);
  });

  test("reduced motion collapses the sequence to a short cross-fade with no rays canvas", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.getByRole("button", { name: "Enter ALL LIFE" }).click();

    // computeReducedMotionState's total duration is 400ms — should land on
    // /gallery well under the full-motion sequence's ~7.3s.
    await expect(page).toHaveURL(/\/gallery$/, { timeout: 3000 });

    // RaysCanvas is never mounted under reduced motion (src/pages/LandingVideo.tsx).
    const raysCanvasCount = await page.locator("canvas").count();
    expect(raysCanvasCount).toBe(0);
  });
});
