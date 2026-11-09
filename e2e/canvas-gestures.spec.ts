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
  // Generous timeouts throughout this file, matching the keyboard test's
  // own already-documented reasoning below: these only wait out real event
  // dispatch/paint under CI's documented CPU contention (D-49), not slow
  // application logic. Found investigating recurring CI failures: this
  // test's own poll calls were the one place in this file still left on
  // the 5000ms default, unlike the keyboard test's explicit 15000ms — no
  // reason for the two to differ, since both wait on the same mechanism.
  test("wheel zooms the camera about the pointer", async ({ page, browserName }) => {
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");
    // Found in review (CodeRabbit, PR #8): two sequential 15000ms polls
    // plus revealBoard()'s own setup can exceed Playwright's default
    // 30000ms per-test timeout before the second poll's own window even
    // elapses, which would fail the test on an unrelated test-level
    // timeout instead of a clean poll assertion. Widened to cover both
    // polls' full worst case plus setup, with margin.
    test.setTimeout(60000);
    await revealBoard(page);

    const before = await getCamera(page);
    expect(before).toBeTruthy();

    await page.mouse.move(400, 300);
    await page.mouse.wheel(0, -400);
    await expect.poll(async () => (await getCamera(page))?.zoom, { timeout: 15000 }).toBeGreaterThan(before!.zoom);

    const zoomedIn = await getCamera(page);
    await page.mouse.wheel(0, 400);
    await expect.poll(async () => (await getCamera(page))?.zoom, { timeout: 15000 }).toBeLessThan(zoomedIn!.zoom);
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
    await expect.poll(async () => (await getCamera(page))?.x, { timeout: 15000 }).toBeGreaterThan(before!.x);
  });

  test("double-click zooms in about the click point", async ({ page, browserName }) => {
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");
    await revealBoard(page);

    const before = await getCamera(page);
    await page.mouse.dblclick(400, 300);
    await expect.poll(async () => (await getCamera(page))?.zoom, { timeout: 15000 }).toBeGreaterThan(before!.zoom);
  });

  test("keyboard: arrows pan, +/- zoom, 0 returns home", async ({ page, browserName }) => {
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");
    // Found in review (CodeRabbit, PR #8, while fixing the identical shape
    // of issue in the wheel test above): this test's own four sequential
    // polls (15000 + 15000 + 5000 + 5000 = 40000ms worst case) already
    // exceeded Playwright's default 30000ms per-test timeout before
    // revealBoard()'s own setup time is even added — a pre-existing risk,
    // not introduced by this PR, just not caught until this same
    // investigation looked closely at this file's own timeout budgets.
    test.setTimeout(75000);
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
    const node = page.getByRole("button", { name: /^Gallery, Film/ });
    await page.locator("[data-camera-zoom]").first().focus();
    for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowRight");
    const panned = await getCamera(page);

    await node.focus();
    await expect.poll(async () => (await getCamera(page))?.x, { timeout: 10000 }).toBeLessThan(panned!.x);
  });

  // T11: "deep link opens at the right camera" (B4) — the gallery
  // viewpoint itself, not just the photo deep link T9/T10 already cover.
  test("/gallery opens at the real gallery viewpoint", async ({ page, browserName }) => {
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");
    await page.goto("/gallery");
    await expect.poll(() => getCamera(page)).toEqual({ x: 2000, y: 0, zoom: 1 });
  });

  test("guided mode: Explore/Guided switch keeps position, and Next/Previous cycle gallery and collage at the right camera", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");
    await revealBoard(page); // Continue's own flyTo (T10) leaves the camera at collage.
    // T10 wired CanvasChrome into Gallery.tsx for the first time — this is
    // its first real-page exercise of Guided mode, not just CanvasChrome's
    // own isolated component tests. Landing (the only other guided-path
    // viewpoint, docs/02-canvas-spec.md §6) isn't a Board page at all, so
    // cycling past gallery into it has nothing meaningful to assert here —
    // out of scope until a later phase gives it somewhere real to go.
    const modeButton = page.getByRole("button", { name: /^(Guided|Explore)$/ });
    await expect(modeButton).toHaveText("Guided");

    // currentIndex starts at 0 on every fresh page load regardless of
    // where Continue's own flyTo left the camera, so it doesn't yet agree
    // with "collage" — B3's "switch without losing position" is exactly
    // the mechanism that resolves this: switching Explore -> Guided flies
    // to the nearest path viewpoint to wherever the camera actually is
    // (useGuidedModeStore.ts), which is collage here.
    await modeButton.click(); // Guided -> Explore: keeps the camera at collage.
    await expect.poll(() => getCamera(page)).toEqual({ x: 2000, y: 1200, zoom: 1 });
    await modeButton.click(); // Explore -> Guided: resyncs currentIndex to collage.
    await expect.poll(() => getCamera(page)).toEqual({ x: 2000, y: 1200, zoom: 1 });

    await page.getByRole("button", { name: "Previous" }).click();
    await expect.poll(() => getCamera(page)).toEqual({ x: 2000, y: 0, zoom: 1 });
    await expect(page.locator('section[data-region-id="gallery"]')).toBeVisible();

    // "Next: Collage" — names the real target (docs/decisions.md D-45), not a bare "Next".
    await page.getByRole("button", { name: "Next: Collage" }).click();
    await expect.poll(() => getCamera(page)).toEqual({ x: 2000, y: 1200, zoom: 1 });
    await expect(page.locator("[data-photo-id]").first()).toBeVisible();

    // T2 (found by the owner, docs/decisions.md D-60): Shop's two regions
    // are centred the same way About/Contact are, unlike Gallery/Collage
    // above — each is seeded with exactly one small product card deliberately
    // centred on its own viewpoint coordinate (scripts/seed-products.ts),
    // so landing with that coordinate as the camera's raw top-left cropped
    // roughly half the card instead. Computed from the real viewport, not
    // hardcoded, since the centred camera depends on it. Asserts the real
    // seeded product card's own bounding box, not just the region section
    // being present — found in review (CodeRabbit, PR #4): the CI workflow
    // only ever seeded a floor product, so the wall assertion previously
    // only ever exercised the region's empty-rect fallback, never a real
    // card that could actually be cropped (now seeded in ci.yml too).
    const viewport = page.viewportSize();
    if (!viewport) throw new Error("expected a real viewport size");

    async function expectFullyInViewport(locator: ReturnType<Page["getByRole"]>) {
      const box = await locator.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
    }

    await page.getByRole("button", { name: "Next: Shop (wall)" }).click();
    await expect
      .poll(() => getCamera(page))
      .toEqual({ x: -2000 - viewport.width / 2, y: 0 - viewport.height / 2, zoom: 1 });
    await expectFullyInViewport(page.getByRole("button", { name: /Sample Belt No\.2/ }));

    await page.getByRole("button", { name: "Next: Shop (floor)" }).click();
    await expect
      .poll(() => getCamera(page))
      .toEqual({ x: -2000 - viewport.width / 2, y: 1200 - viewport.height / 2, zoom: 1 });
    await expectFullyInViewport(page.getByRole("button", { name: /Sample Belt No\.5/ }));
  });
});
