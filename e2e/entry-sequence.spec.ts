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

  // Found as a real, reproduced bug (not a review finding): on a device
  // that had already watched the film through once before (isUnlocked
  // persisted in localStorage from an earlier visit), Gallery.tsx's own
  // mount-time revealAutomatically() call overwrote the explicit reveal()
  // LandingVideo's handleDone had just made moments earlier — which made
  // FilmStage's own already-unlocked-automatic-reveal effect hide() the
  // film straight back again, dropping the visitor onto the board instead
  // of the film they'd just explicitly clicked through the whole entry
  // sequence to watch.
  test("clicking through still plays the film on a device that has already unlocked it before", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");

    // Unlock the gate first, the same honest-watch-through way gate.spec.ts
    // does, so this test doesn't just assert against a hand-written
    // localStorage value that happens to match the gate's own format.
    await page.goto("/gallery");
    const galleryVideo = page.locator("video").last();
    await expect(galleryVideo).toBeVisible();
    await expect
      .poll(() => galleryVideo.evaluate((el: HTMLVideoElement) => el.readyState))
      .toBeGreaterThanOrEqual(1);
    await galleryVideo.evaluate((el: HTMLVideoElement) => {
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
    await expect
      .poll(() =>
        page.evaluate(() =>
          Object.keys(localStorage).some(
            (k) => k.startsWith("alllife:film:") && localStorage.getItem(k) === "true"
          )
        )
      )
      .toBe(true);

    // Now the real scenario: a fresh visit starting from the landing page,
    // clicking through the entry sequence exactly as a first-time visitor
    // would, on this now-already-unlocked device.
    await page.goto("/");
    await page.getByRole("button", { name: "Enter ALL LIFE" }).click();
    await expect(page).toHaveURL(/\/gallery$/, { timeout: 15000 });

    const video = page.locator("video").last();
    await expect(video).toBeVisible();
    await expect
      .poll(async () => video.evaluate((el: HTMLVideoElement) => el.paused))
      .toBe(false);

    // Found in review (Greptile, PR #8): toBeVisible() doesn't check
    // opacity, only bounding box + visibility — FilmStage.tsx's own hidden
    // state (opacity: 0, zIndex: -1, not display: none) still has a real,
    // non-empty box, so the checks above alone could pass even if the
    // regression this test exists to catch (Gallery.tsx's mount effect
    // re-hiding the film) somehow stopped short of also pausing the video.
    // Asserting the stage's own real computed opacity directly is immune
    // to that — 1 only when FilmStage.tsx's revealedLayerStyle is active.
    await expect(page.getByTestId("film-stage")).toHaveCSS("opacity", "1");
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
