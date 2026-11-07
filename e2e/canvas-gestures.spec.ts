import { test, expect, type Page } from "@playwright/test";

/**
 * Board gestures only matter once the Board is actually visible — on
 * /gallery that's behind FilmStage's full-screen layer until the gate
 * unlocks and Continue is clicked (src/pages/Gallery.tsx, T12). Reuses
 * the same synthetic honest-watch-through simulation as e2e/gate.spec.ts
 * rather than a throwaway dev harness, since /dev/canvas (any Vite
 * `build` command, any --mode) never actually ships import.meta.env.DEV
 * as true — only `vite dev` does — so it can't be reached by the
 * webServer (`vite preview`) this config's Playwright tests run against.
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

  // Gesture tests don't need the film still decoding in the background —
  // pausing it frees up this page's main thread, which otherwise competes
  // with the camera store's rAF loop under CPU contention from parallel
  // specs (this measurably fixed a real, reproducible-under-load flake).
  await video.evaluate((el: HTMLVideoElement) => el.pause());
}

async function getCamera(page: Page) {
  const viewport = page.locator("[data-camera-zoom]").first();
  const [x, y, zoom] = await Promise.all([
    viewport.getAttribute("data-camera-x"),
    viewport.getAttribute("data-camera-y"),
    viewport.getAttribute("data-camera-zoom"),
  ]);
  if (x == null || y == null || zoom == null) return null;
  return { x: Number(x), y: Number(y), zoom: Number(zoom) };
}

test.describe("canvas gestures", () => {
  test("wheel zooms the camera about the pointer", async ({ page, browserName }) => {
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");
    await revealBoard(page);

    const before = await getCamera(page);
    expect(before).toBeTruthy();

    await page.mouse.move(400, 300);
    await page.mouse.wheel(0, -400);
    await expect.poll(async () => (await getCamera(page))?.zoom).toBeGreaterThan(before!.zoom);

    const zoomedIn = await getCamera(page);
    await page.mouse.wheel(0, 400);
    await expect.poll(async () => (await getCamera(page))?.zoom).toBeLessThan(zoomedIn!.zoom);
  });

  test("dragging pans the camera", async ({ page, browserName }) => {
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");
    await revealBoard(page);

    const before = await getCamera(page);

    await page.mouse.move(400, 300);
    await page.mouse.down();
    await page.mouse.move(250, 300, { steps: 10 });
    await page.mouse.up();

    // Dragging the pointer left should pan the camera's world x forward
    // (content "sticks to the pointer" — see useBoardGestures.ts).
    await expect.poll(async () => (await getCamera(page))?.x).toBeGreaterThan(before!.x);
  });

  test("double-click zooms in about the click point", async ({ page, browserName }) => {
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");
    await revealBoard(page);

    const before = await getCamera(page);
    await page.mouse.dblclick(400, 300);
    await expect.poll(async () => (await getCamera(page))?.zoom).toBeGreaterThan(before!.zoom);
  });

  test("keyboard: arrows pan, +/- zoom, 0 returns home", async ({ page, browserName }) => {
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");
    await revealBoard(page);

    await page.locator("[data-camera-zoom]").first().focus();

    // Generous timeouts: the camera store updates synchronously on keydown —
    // these only wait out the rAF loop's next write of the data-camera-*
    // attributes, which can lag under CPU contention from parallel specs.
    const before = await getCamera(page);
    await page.keyboard.press("ArrowRight");
    await expect.poll(async () => (await getCamera(page))?.x, { timeout: 15000 }).toBeGreaterThan(before!.x);

    const panned = await getCamera(page);
    await page.keyboard.press("+");
    await expect.poll(async () => (await getCamera(page))?.zoom, { timeout: 15000 }).toBeGreaterThan(panned!.zoom);

    await page.keyboard.press("0");
    // flyTo animates to the landing viewpoint (x=0, zoom=1) — poll until settled.
    await expect.poll(async () => (await getCamera(page))?.x, { timeout: 5000 }).toBeCloseTo(0, 0);
    await expect.poll(async () => (await getCamera(page))?.zoom, { timeout: 5000 }).toBeCloseTo(1, 1);
  });

  test("Tab-focusing a node flies the camera to bring it back into view", async ({ page, browserName }) => {
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");
    await revealBoard(page);

    // Gallery.tsx's film-thumbnail button is a real focusable node inside
    // the Board. Pan it off-centre first, so refocusing it has somewhere
    // real to move the camera back to — docs/02-canvas-spec.md §9/FR-8.9.
    const node = page.getByRole("button", { name: /^Play / });
    await page.locator("[data-camera-zoom]").first().focus();
    for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowRight");
    const panned = await getCamera(page);

    await node.focus();
    await expect.poll(async () => (await getCamera(page))?.x, { timeout: 10000 }).toBeLessThan(panned!.x);
  });
});
