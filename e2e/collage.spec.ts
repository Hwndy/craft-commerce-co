import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";

/**
 * Same genuine-watch-through reveal used by e2e/canvas-gestures.spec.ts —
 * the collage only matters once the Board is visible behind FilmStage's
 * full-screen layer (src/pages/Gallery.tsx).
 */
async function revealBoard(page: Page) {
  await page.goto("/gallery");
  const video = page.locator("video").last();
  await expect(video).toBeVisible();
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.readyState)).toBeGreaterThanOrEqual(1);

  await video.evaluate((el: HTMLVideoElement) => {
    const duration = el.duration;
    el.currentTime = 0;
    el.dispatchEvent(new Event("timeupdate"));
    for (let t = 0.5; t <= duration; t += 0.5) {
      el.currentTime = t;
      el.dispatchEvent(new Event("timeupdate"));
    }
    el.currentTime = duration;
    el.pause();
    el.dispatchEvent(new Event("ended"));
  });

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator('section[data-region-id="gallery"]')).toBeVisible();
  await video.evaluate((el: HTMLVideoElement) => el.pause());
}

/**
 * Pans the camera from the gallery viewpoint (2000, 0) down to the collage
 * viewpoint (2000, 1200) via the keyboard — no CanvasChrome/minimap wiring
 * exists yet (deferred to T10), and no internal store is exposed to tests,
 * so this is the same real-interaction approach the gesture specs already
 * use. ArrowDown pans by a fixed 80 screen-px / zoom per press regardless
 * of viewport size (useBoardKeyboard.ts), so exactly 15 presses moves
 * camera.y by exactly 1200 world units on every project/device.
 */
async function panToCollage(page: Page) {
  await page.locator("[data-camera-zoom]").first().focus();
  for (let i = 0; i < 15; i++) await page.keyboard.press("ArrowDown");
}

function seriousOrCritical(violations: { impact?: string | null }[]) {
  return violations.filter((v) => v.impact === "serious" || v.impact === "critical");
}

test.describe("collage region", () => {
  test("seeded photos render as focusable, labelled nodes once panned into view", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");
    await revealBoard(page);
    await panToCollage(page);

    const photoButton = page.getByRole("button", { name: /^Placeholder photo \d+/ }).first();
    await expect(photoButton).toBeVisible();

    // Focusable and in reading order (docs/02-canvas-spec.md §9) — Tab
    // from the viewport should be able to reach it.
    await photoButton.focus();
    await expect(photoButton).toBeFocused();
  });

  test("has no serious or critical accessibility violations once photos are visible", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");
    await revealBoard(page);
    await panToCollage(page);
    await expect(page.getByRole("button", { name: /^Placeholder photo \d+/ }).first()).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(seriousOrCritical(results.violations), JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  test("/list/collage lists the real published photos", async ({ page }) => {
    await page.goto("/list/collage");
    await expect(page.getByText(/^Placeholder photo \d+/).first()).toBeVisible();
    await expect(page.getByText("region-label")).toHaveCount(0);
  });
});
