import { test, expect } from "@playwright/test";

test.describe("orientation", () => {
  test("rotating mid-film keeps the same video element, playback position and controls usable", async ({
    page,
    browserName,
  }) => {
    // See docs/decisions.md D-27: this environment's WebKit build cannot
    // decode this project's HLS film at all. Real Safari is unaffected;
    // verify orientation changes there (and on a real iPhone) by hand.
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");
    await page.setViewportSize({ width: 390, height: 844 }); // portrait
    await page.goto("/gallery");

    const video = page.locator("video").last();
    await expect(video).toBeVisible();
    await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.readyState)).toBeGreaterThanOrEqual(1);

    await page.evaluate(() => {
      (window as unknown as { __video: HTMLVideoElement }).__video = document.querySelector(
        "video"
      ) as HTMLVideoElement;
    });

    // Let it play for real a moment so currentTime has somewhere to advance from.
    await page.waitForTimeout(1200);
    const before = await video.evaluate((el: HTMLVideoElement) => ({
      currentTime: el.currentTime,
      paused: el.paused,
    }));

    // Fullscreen (if engaged) blocks programmatic resize in some browsers —
    // exit it first, matching what a real rotation does on a real device
    // (the Fullscreen API element itself persists across rotation there;
    // here we're isolating the one thing this test cares about: the DOM
    // node and playback state survive a layout change).
    await page.evaluate(() => {
      if (document.fullscreenElement) void document.exitFullscreen();
    });
    await page.waitForTimeout(200);

    await page.setViewportSize({ width: 844, height: 390 }); // landscape
    await page.waitForTimeout(500);

    const sameNode = await page.evaluate(
      () =>
        (window as unknown as { __video: HTMLVideoElement }).__video ===
        document.querySelector("video")
    );
    expect(sameNode).toBe(true);

    const after = await video.evaluate((el: HTMLVideoElement) => ({
      currentTime: el.currentTime,
      paused: el.paused,
    }));
    expect(after.currentTime).toBeGreaterThan(before.currentTime);
    expect(after.paused).toBe(before.paused);

    // Controls are still usable in the new orientation.
    await expect(page.getByRole("button", { name: /^(Pause|Play)$/ })).toBeVisible();
  });
});
