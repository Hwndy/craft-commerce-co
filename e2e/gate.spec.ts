import { test, expect } from "@playwright/test";

/** Forces every play() attempt to reject, so the fallback chain lands on the play-button tier. */
async function forceAutoplayBlocked(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = () =>
      Promise.reject(new DOMException("blocked for test", "NotAllowedError"));
  });
}

test.describe("first-watch gate", () => {
  test("a direct /gallery visit with autoplay fully blocked shows the play button, not a black screen", async ({
    page,
    browserName,
  }) => {
    // See docs/decisions.md D-27: this environment's WebKit build cannot
    // decode this project's HLS film at all (no native HLS, no MSE codec
    // support) — real Safari is unaffected and must be checked by hand.
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");
    await forceAutoplayBlocked(page);
    await page.goto("/gallery");

    await expect(page.getByRole("button", { name: "Play the film" })).toBeVisible({
      timeout: 10000,
    });
  });

  test("cannot be unlocked by seeking straight to the end", async ({ page, browserName }) => {
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");
    await page.goto("/gallery");
    const video = page.locator("video").last();
    await expect(video).toBeVisible();
    await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.readyState)).toBeGreaterThanOrEqual(1);

    await video.evaluate((el: HTMLVideoElement) => {
      const duration = el.duration;
      el.currentTime = Math.max(0, duration - 2);
      el.dispatchEvent(new Event("timeupdate"));
      el.currentTime = duration;
      el.dispatchEvent(new Event("timeupdate"));
      el.pause();
      el.dispatchEvent(new Event("ended"));
    });

    // The cheat attempt must not produce the unlocked Replay/Continue screen.
    await expect(page.getByRole("button", { name: "Continue" })).not.toBeVisible();
    const unlocked = await page.evaluate(() =>
      Object.keys(localStorage).some(
        (k) => k.startsWith("alllife:film:") && localStorage.getItem(k) === "true"
      )
    );
    expect(unlocked).toBe(false);
  });

  test("locks, then unlocks after a genuine watch-through, offering Replay and Continue", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");
    await page.goto("/gallery");
    const video = page.locator("video").last();
    await expect(video).toBeVisible();
    await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.readyState)).toBeGreaterThanOrEqual(1);

    // "Watch to continue" hint is present while locked.
    await expect(page.getByText(/Watch to continue/)).toBeVisible();

    // Simulate an honestly-paced watch-through via synthetic timeupdate
    // events (waiting out the real ~20s test film in real time works too,
    // but this keeps the test fast and deterministic regardless of the
    // fixture's exact duration). Relies on the video still genuinely
    // playing (video.paused === false) so each synthetic event counts as
    // real progress under the gate's own anti-cheat rule.
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

    // Generous timeout: the state is already correct the instant the evaluate()
    // above resolves — this only waits out React's render under CPU contention
    // (e.g. several browser engines running other specs in parallel).
    await expect(page.getByRole("button", { name: "Replay" })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Watch to continue/)).not.toBeVisible();

    const unlocked = await page.evaluate(() =>
      Object.keys(localStorage).some(
        (k) => k.startsWith("alllife:film:") && localStorage.getItem(k) === "true"
      )
    );
    expect(unlocked).toBe(true);

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.locator('section[data-region-id="gallery"]')).toBeVisible();
  });

  test("a returning visitor who already unlocked is not re-locked", async ({ page, browserName }) => {
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

    await page.reload();

    await expect(page.getByText(/Watch to continue/)).not.toBeVisible();
  });
});
