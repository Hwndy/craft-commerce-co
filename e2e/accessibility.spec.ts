import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

function seriousOrCritical(violations: { impact?: string | null }[]) {
  return violations.filter((v) => v.impact === "serious" || v.impact === "critical");
}

test.describe("accessibility", () => {
  test("landing page (/) has no serious or critical violations", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page }).analyze();
    expect(seriousOrCritical(results.violations), JSON.stringify(results.violations, null, 2)).toEqual(
      []
    );
  });

  test("/gallery, with the film revealed, has no serious or critical violations", async ({
    page,
    browserName,
  }) => {
    // See docs/decisions.md D-27: this environment's WebKit build cannot
    // decode this project's HLS film, so the film never reaches a revealed,
    // playing state here. Real Safari is unaffected and must be checked by
    // hand.
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");
    await page.goto("/gallery");
    const video = page.locator("video").last();
    await expect(video).toBeVisible();
    await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.readyState)).toBeGreaterThanOrEqual(1);

    const results = await new AxeBuilder({ page }).analyze();
    expect(seriousOrCritical(results.violations), JSON.stringify(results.violations, null, 2)).toEqual(
      []
    );
  });

  test("/gallery, once unlocked and Continue reveals the board, has no serious or critical violations", async ({
    page,
    browserName,
  }) => {
    // T11: CanvasChrome (minimap, Home, List view, Guided/Explore) was only
    // wired into a real page for the first time in T10 — never axe-checked
    // in that state before now. The earlier test above covers the locked,
    // film-only state; this covers what's on screen once a visitor is
    // actually handed off to the collage.
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");
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
    await expect(page.getByRole("button", { name: "Home" })).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(seriousOrCritical(results.violations), JSON.stringify(results.violations, null, 2)).toEqual(
      []
    );
  });

  // D-45: PhotoViewer's reskin added real new UI (the counter line, the
  // filmstrip) — never axe-checked before. Deep-links straight to a photo
  // rather than clicking a collage thumbnail, so this doesn't need
  // photo-viewer.spec.ts's own chrome-overlap avoidance logic just to open
  // the dialog.
  test("the open photo viewer has no serious or critical violations", async ({ page, browserName }) => {
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");
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

    const photoId = await page.locator("[data-photo-id]").first().getAttribute("data-photo-id");
    expect(photoId).toBeTruthy();
    await page.goto(`/gallery/photo/${photoId}`);
    await expect(page.getByRole("dialog")).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(seriousOrCritical(results.violations), JSON.stringify(results.violations, null, 2)).toEqual(
      []
    );
  });

  // T3: the product overlay is genuinely new UI, never axe-checked before.
  // Deep-links straight to the seeded product (same reasoning as the photo
  // viewer's own case above) rather than navigating the board to click it.
  test("the open product overlay has no serious or critical violations", async ({ page, browserName }) => {
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");
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

    await page.goto("/gallery/shop/sample-belt-no-5");
    await expect(page.getByRole("dialog")).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(seriousOrCritical(results.violations), JSON.stringify(results.violations, null, 2)).toEqual(
      []
    );
  });
});
