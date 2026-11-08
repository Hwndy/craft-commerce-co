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
 * Flies the camera (via the keyboard — no CanvasChrome/minimap wiring
 * exists yet, deferred to T10, and no internal store is exposed to tests)
 * so the collage viewpoint (2000, 1200) is centred and the whole cluster
 * fits on screen, regardless of the project/device's real viewport size.
 *
 * Zooms out to the camera's floor (DEFAULT_ZOOM_LIMITS.min, 0.15 — "-"
 * enough times to clamp there from any starting zoom) first, so the
 * collage's ~1100-world-unit spread (phyllotaxis, 8 placeholder photos —
 * see docs/decisions.md on DEFAULT_RADIUS_STEP) is a small fraction of
 * even the narrowest mobile viewport's visible world area. Then reads the
 * real camera/zoom and viewport size off the DOM (data-camera-*, same
 * attributes every other gesture spec reads) and computes the *exact*
 * number of pan presses needed to centre (2000, 1200) — not a guessed
 * count — since useBoardKeyboard.ts's pan step is a fixed 80 screen-px
 * divided by the *current* zoom, which only this script's own zoom-out
 * step has just changed.
 */
async function panToCollage(page: Page) {
  const viewport = page.viewportSize();
  const vw = viewport?.width ?? 1280;
  const vh = viewport?.height ?? 720;

  const cameraLocator = page.locator("[data-camera-zoom]").first();
  await cameraLocator.focus();
  for (let i = 0; i < 12; i++) await page.keyboard.press("-");

  const camera = {
    x: Number(await cameraLocator.getAttribute("data-camera-x")),
    y: Number(await cameraLocator.getAttribute("data-camera-y")),
    zoom: Number(await cameraLocator.getAttribute("data-camera-zoom")),
  };
  const panStepWorld = 80 / camera.zoom;
  const stepsX = Math.round((2000 - vw / (2 * camera.zoom) - camera.x) / panStepWorld);
  const stepsY = Math.round((1200 - vh / (2 * camera.zoom) - camera.y) / panStepWorld);

  for (let i = 0; i < Math.abs(stepsX); i++) await page.keyboard.press(stepsX > 0 ? "ArrowRight" : "ArrowLeft");
  for (let i = 0; i < Math.abs(stepsY); i++) await page.keyboard.press(stepsY > 0 ? "ArrowDown" : "ArrowUp");
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

  // D-45: CollageChrome only shows once the camera is actually near the
  // collage viewpoint (it shares the board with the Gallery/film region,
  // which must NOT show a "Circle" layout toggle that belongs to the
  // collage alone). Continue's own flyTo (T10) already lands on collage,
  // so this checks the toggle disappears when guided Previous moves away
  // to gallery, then reappears on Next back to collage.
  test("the Circle/Diagonal strips toggle only shows while the camera is near the collage", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");
    await revealBoard(page);
    await expect(page.getByRole("button", { name: "Circle" })).toBeVisible();

    await page.getByRole("button", { name: "Previous" }).click();
    await expect(page.locator('section[data-region-id="gallery"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Circle" })).not.toBeVisible();

    await page.getByRole("button", { name: "Next: Collage" }).click();
    await expect(page.getByRole("button", { name: "Circle" })).toBeVisible();

    await page.getByRole("button", { name: "Diagonal strips" }).click();
    const photoButton = page.getByRole("button", { name: /^Placeholder photo \d+/ }).first();
    await expect(photoButton).toBeVisible();
  });
});
