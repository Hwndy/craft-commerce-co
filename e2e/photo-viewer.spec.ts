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

  // Continue's own flyTo (T10) is async and never awaited by its click
  // handler, so the camera is still mid-flight (position changing every
  // rAF frame) the instant this click() resolves. Confirmed on real CI:
  // every photo-thumbnail click here failed with Playwright's own
  // "element is not stable"/"detached from the DOM" — NodeLayer's culling
  // recomputes against whatever intermediate camera position the flight
  // is passing through, not just its settled end state. Waiting for the
  // camera to actually reach collage (2000, 1200, zoom 1 — the exact
  // values flyTo's own set({ camera: targetCamera }) finishes on) avoids
  // interacting with anything until it's genuinely done moving.
  const camera = page.locator("[data-camera-x]").first();
  await expect
    .poll(async () => ({
      x: Number(await camera.getAttribute("data-camera-x")),
      y: Number(await camera.getAttribute("data-camera-y")),
      zoom: Number(await camera.getAttribute("data-camera-zoom")),
    }))
    .toEqual({ x: 2000, y: 1200, zoom: 1 });
}

function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/**
 * Clicks a seeded photo thumbnail, skipping any that one of CanvasChrome's
 * or CollageChrome's fixed regions (top bar, minimap, bottom bar, Home;
 * the Circle/Diagonal toggle, shoot chips, zoom + Recentre — D-45) happens
 * to sit on top of — both are screen-anchored (D-44) and both render at
 * the same time once Continue hands off to the collage. Each photo's
 * seeded id is random per CI run, so exactly which one the phyllotaxis
 * layout places nearest a chrome region isn't something `.first()` can
 * assume is always clickable — Continue's own flyTo (T10) already centres
 * the camera on collage at zoom 1, so no extra panning/zooming is needed
 * here just to reach a clickable photo.
 */
async function clickAnUnobstructedPhoto(page: Page) {
  const chromeBoxes = (
    await Promise.all(
      (await page.locator("[data-canvas-chrome], [data-collage-chrome]").all()).map((el) => el.boundingBox())
    )
  ).filter((box): box is NonNullable<typeof box> => box !== null);
  const viewport = page.viewportSize();
  const candidates = page.getByRole("button", { name: /^Placeholder photo \d+/ });
  const count = await candidates.count();
  for (let i = 0; i < count; i++) {
    // Reads this candidate's stable id, then clicks through a locator
    // scoped by that id — not the positional `nth(i)` locator itself.
    // `nth(i)` re-resolves live on every action, so if NodeLayer's
    // culling mounts/unmounts/reorders nodes between this boundingBox()
    // read and the eventual click (a real race during T10's Continue
    // flyTo, confirmed on real CI: Playwright's own actionability retry
    // silently swapped in a *different* button mid-click, one that
    // genuinely was obstructed), a positional locator can click whatever
    // ends up at that index by then, not the one actually vetted here.
    const id = await candidates.nth(i).getAttribute("data-photo-id");
    if (!id) continue;
    const candidate = page.locator(`[data-photo-id="${id}"]`);
    const box = await candidate.boundingBox();
    if (!box || chromeBoxes.some((chromeBox) => boxesOverlap(box, chromeBox))) continue;
    // At zoom 1 (collage's own viewpoint — no extra zoom-out), a narrower
    // mobile viewport genuinely doesn't contain every seeded photo: the
    // phyllotaxis cluster's radius can exceed half the viewport width.
    // Confirmed on real CI ("element is outside of the viewport") once
    // the chrome-overlap check alone let a fully off-screen candidate
    // through.
    if (viewport && (box.x < 0 || box.y < 0 || box.x + box.width > viewport.width || box.y + box.height > viewport.height)) {
      continue;
    }
    await candidate.click();
    return candidate;
  }
  throw new Error("no seeded photo thumbnail is both on-screen and unobstructed by CanvasChrome");
}

test.describe("photo viewer", () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");
  });

  test("clicking a photo opens a full-screen viewer with its title and date", async ({ page }) => {
    await revealBoard(page);

    const thumbnail = await clickAnUnobstructedPhoto(page);
    const label = await thumbnail.getAttribute("aria-label");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/gallery\/photo\/.+/);
    expect(label).toBeTruthy();
  });

  test("Escape closes the viewer and returns to /gallery", async ({ page }) => {
    await revealBoard(page);
    await clickAnUnobstructedPhoto(page);
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page).toHaveURL(/\/gallery$/);
  });

  test("browser Back closes the viewer", async ({ page }) => {
    await revealBoard(page);
    await clickAnUnobstructedPhoto(page);
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.goBack();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page).toHaveURL(/\/gallery$/);
  });

  test("Next cycles forward and loops from the last photo to the first", async ({ page }) => {
    await revealBoard(page);
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
    await clickAnUnobstructedPhoto(page);
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // data-testid, not a bare `img[alt=""]`: the collage thumbnails behind
    // this dialog (PhotoThumbnail.tsx) and the filmstrip strip inside it
    // (PhotoViewer.tsx, D-45) both also use `alt=""` — only the dialog's
    // own full-size image is what this test means to click.
    const image = dialog.getByTestId("photo-viewer-image");
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
    await clickAnUnobstructedPhoto(page);
    await expect(page.getByRole("dialog")).toBeVisible();
    const photoUrl = page.url();

    // Re-visiting the same deep link fresh (gate already unlocked on this
    // device/localStorage) must show the viewer directly, no extra clicks.
    await page.goto(photoUrl);
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});
