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

    // "Watch once to unlock the gallery" hint is present while locked (docs/decisions.md D-45).
    await expect(page.getByText(/Watch once to unlock/)).toBeVisible();

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
    await expect(page.getByText(/Watch once to unlock/)).not.toBeVisible();

    const unlocked = await page.evaluate(() =>
      Object.keys(localStorage).some(
        (k) => k.startsWith("alllife:film:") && localStorage.getItem(k) === "true"
      )
    );
    expect(unlocked).toBe(true);

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.locator('section[data-region-id="gallery"]')).toBeVisible();

    // T10: Continue hands the visitor off to the collage, not wherever
    // Explore-mode panning happened to leave the camera.
    const collageViewpoint = { x: 2000, y: 1200 };
    await expect
      .poll(async () => {
        const camera = page.locator("[data-camera-x]").first();
        return {
          x: Number(await camera.getAttribute("data-camera-x")),
          y: Number(await camera.getAttribute("data-camera-y")),
        };
      })
      .toEqual(collageViewpoint);

    // CanvasChrome only appears once the film is out of the way (T10) —
    // showing it earlier would let a visitor navigate off before the gate
    // can ever lock them in.
    await expect(page.getByRole("button", { name: "Home" })).toBeVisible();
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

    await expect(page.getByText(/Watch once to unlock/)).not.toBeVisible();
  });

  test("a direct /gallery/photo/:id deep link requires the gate first, then opens automatically once unlocked (T10, D-07)", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");
    await page.goto("/gallery");
    const video = page.locator("video").last();
    await expect(video).toBeVisible();
    await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.readyState)).toBeGreaterThanOrEqual(1);

    // Grab a real seeded photo id to deep-link to (data-photo-id is a plain
    // DOM read, not a click, so it's fine that the full-screen film layer
    // visually covers the collage underneath right now).
    const photoId = await page.locator("[data-photo-id]").first().getAttribute("data-photo-id");
    expect(photoId).toBeTruthy();

    await page.goto(`/gallery/photo/${photoId}`);
    await expect(video).toBeVisible();
    await expect(page.getByText(/Watch once to unlock/)).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    // CanvasChrome mustn't be reachable either while locked.
    await expect(page.getByRole("button", { name: "Home" })).toHaveCount(0);

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

    // The deep link's destination opens on its own, with no further
    // navigation — the URL never changed, only isUnlocked did.
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10000 });
    await expect(page.getByLabel("Close")).toBeVisible();
  });
});
