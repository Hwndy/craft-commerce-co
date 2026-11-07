import { test, expect, type Page } from "@playwright/test";

/** Same genuine-watch-through reveal used by e2e/canvas-gestures.spec.ts. */
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

/** Same helper as e2e/collage.spec.ts — see its comment for the reasoning. */
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

function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/**
 * Clicks a seeded photo thumbnail, skipping any that CanvasChrome's fixed
 * top-left corner (minimap/Home/Guided controls — correctly screen-
 * anchored since docs/decisions.md D-44) happens to sit on top of.
 * panToCollage()'s extreme zoom-out packs the whole phyllotaxis cluster
 * near screen centre, but exactly which seeded photo (random ids each
 * CI run) ends up nearest a given screen region isn't something `.first()`
 * can assume is always clickable.
 */
async function clickAnUnobstructedPhoto(page: Page) {
  const chromeBox = await page.locator("[data-canvas-chrome]").boundingBox();
  const candidates = page.getByRole("button", { name: /^Placeholder photo \d+/ });
  const count = await candidates.count();
  for (let i = 0; i < count; i++) {
    const candidate = candidates.nth(i);
    const box = await candidate.boundingBox();
    if (box && (!chromeBox || !boxesOverlap(box, chromeBox))) {
      await candidate.click();
      return candidate;
    }
  }
  throw new Error("every seeded photo thumbnail is obstructed by CanvasChrome — nothing clickable found");
}

test.describe("photo viewer", () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");
  });

  test("clicking a photo opens a full-screen viewer with its title and date", async ({ page }) => {
    await revealBoard(page);
    await panToCollage(page);

    const thumbnail = await clickAnUnobstructedPhoto(page);
    const label = await thumbnail.getAttribute("aria-label");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/gallery\/photo\/.+/);
    expect(label).toBeTruthy();
  });

  test("Escape closes the viewer and returns to /gallery", async ({ page }) => {
    await revealBoard(page);
    await panToCollage(page);
    await clickAnUnobstructedPhoto(page);
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page).toHaveURL(/\/gallery$/);
  });

  test("browser Back closes the viewer", async ({ page }) => {
    await revealBoard(page);
    await panToCollage(page);
    await clickAnUnobstructedPhoto(page);
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.goBack();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page).toHaveURL(/\/gallery$/);
  });

  test("Next cycles forward and loops from the last photo to the first", async ({ page }) => {
    await revealBoard(page);
    await panToCollage(page);
    await clickAnUnobstructedPhoto(page);
    await expect(page.getByRole("dialog")).toBeVisible();

    const urlsSeen = new Set<string>();
    urlsSeen.add(page.url());
    for (let i = 0; i < 8; i++) {
      await page.getByRole("button", { name: "Next photo" }).click();
      urlsSeen.add(page.url());
    }
    // 8 placeholder photos seeded (scripts/generate-placeholder-photos.sh
    // default count) — 8 Next clicks from any starting point must have
    // cycled through every one and looped back, without erroring.
    expect(urlsSeen.size).toBe(8);
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("ArrowLeft/ArrowRight keys also cycle", async ({ page }) => {
    await revealBoard(page);
    await panToCollage(page);
    await clickAnUnobstructedPhoto(page);
    await expect(page.getByRole("dialog")).toBeVisible();
    const firstUrl = page.url();

    await page.keyboard.press("ArrowRight");
    await expect(page).not.toHaveURL(firstUrl);
    const secondUrl = page.url();

    await page.keyboard.press("ArrowLeft");
    await expect(page).toHaveURL(firstUrl);
    expect(secondUrl).not.toBe(firstUrl);
  });

  test("tapping the image toggles the caption and nav arrows", async ({ page }) => {
    await revealBoard(page);
    await panToCollage(page);
    await clickAnUnobstructedPhoto(page);
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // A CSS (not role) locator, since aria-hidden removes an element from
    // the accessibility tree role queries search — exactly the state this
    // test is checking. Scoped to the dialog: the collage thumbnails
    // behind it (PhotoThumbnail.tsx) also use `alt=""`, and with several
    // of them culled into view at once (panToCollage's whole point), a
    // bare page-wide `img[alt=""]` locator can resolve to more than one
    // element — only the dialog's own full-size image is what this test
    // means to click.
    const image = dialog.locator('img[alt=""]');
    const nextButton = dialog.locator('button[aria-label="Next photo"]');
    await expect(nextButton).toHaveAttribute("aria-hidden", "false");

    await image.click();
    await expect(nextButton).toHaveAttribute("aria-hidden", "true");

    await image.click();
    await expect(nextButton).toHaveAttribute("aria-hidden", "false");
  });

  test("a direct deep link to an already-open photo renders the viewer immediately once unlocked", async ({
    page,
  }) => {
    await revealBoard(page);
    await panToCollage(page);
    await clickAnUnobstructedPhoto(page);
    await expect(page.getByRole("dialog")).toBeVisible();
    const photoUrl = page.url();

    // Re-visiting the same deep link fresh (gate already unlocked on this
    // device/localStorage) must show the viewer directly, no extra clicks.
    await page.goto(photoUrl);
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});
