import { test, expect, type Page } from "@playwright/test";

/**
 * docs/04-design-and-motion.md §7's panning/memory budgets are measured
 * "on the reference devices" (an iPhone 12+ and a 2021 mid-range Android)
 * — this sandbox has neither, the same honest limitation recorded
 * throughout this build (D-30 and others). What follows is a best-effort
 * headless-Chromium proxy: a real, repeatable regression check against
 * gross frame-rate collapse or unbounded memory growth, not a substitute
 * for the real reference-device measurement the budget actually requires.
 * chromium-only: `performance.memory` is a Chromium-only API, and
 * cross-engine fps numbers from different renderers aren't comparable.
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
  await video.evaluate((el: HTMLVideoElement) => el.pause());
}

test.describe("performance (headless-Chromium proxy — see file comment)", () => {
  test("panning the full collage holds a reasonable frame rate", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "fps numbers aren't comparable across rendering engines");
    await revealBoard(page);
    await page.locator("[data-camera-zoom]").first().focus();
    // Zoomed out enough that every seeded photo is on screen at once —
    // the actual worst case the 60fps/full-collage budget is about.
    for (let i = 0; i < 12; i++) await page.keyboard.press("-");

    const fpsWhilePanning = page.evaluate(() => {
      // Races the rAF count against a hard wall-clock deadline (setTimeout,
      // not rAF-driven) so this always resolves even if a headless/
      // backgrounded tab throttles or fully suspends requestAnimationFrame
      // — a real risk under CI's parallel load, not hypothetical. A
      // suspended-rAF result (frames stuck at 0) fails the assertion below
      // cleanly instead of hanging the whole test (and its retries).
      let frames = 0;
      const start = performance.now();
      function tick() {
        frames++;
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
      return new Promise<number>((resolve) => {
        setTimeout(() => resolve((frames * 1000) / (performance.now() - start)), 2000);
      });
    });
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press(i % 2 === 0 ? "ArrowRight" : "ArrowLeft");
    }
    const fps = await fpsWhilePanning;

    // Loose floor: a CI runner under full parallel load is not the
    // reference-device environment the real 50fps budget targets — this
    // only catches a gross collapse (e.g. a culling/LOD regression that
    // mounts every node unconditionally), not a true budget verification.
    expect(fps).toBeGreaterThan(20);
  });

  test("a sustained pan/zoom session doesn't grow heap usage unboundedly", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "performance.memory is a Chromium-only API");
    await revealBoard(page);
    await page.locator("[data-camera-zoom]").first().focus();
    for (let i = 0; i < 12; i++) await page.keyboard.press("-");

    const readHeap = () =>
      page.evaluate(() => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null);

    const before = await readHeap();
    test.skip(before == null, "performance.memory unavailable in this runner");

    // A bounded stress proxy, not the literal 2-minute session the real
    // budget specifies — see file comment. Exercises the same culling/LOD
    // recompute path a real 2-minute session would, just compressed.
    for (let round = 0; round < 30; round++) {
      for (let i = 0; i < 6; i++) await page.keyboard.press(round % 2 === 0 ? "ArrowRight" : "ArrowLeft");
      await page.keyboard.press(round % 4 === 0 ? "+" : "-");
    }
    await page.evaluate(() => new Promise((r) => setTimeout(r, 200)));

    const after = await readHeap();
    expect(after).not.toBeNull();
    // Loose ceiling (3x): this catches an unbounded leak (nodes/listeners
    // that never get cleaned up as the camera moves), not a tight budget —
    // some growth from GC timing and lazy allocation is expected and fine.
    expect(after!).toBeLessThan(before! * 3 + 5_000_000);
  });
});
