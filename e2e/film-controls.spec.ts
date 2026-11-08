import { test, expect, type Page } from "@playwright/test";

/** Reveals the film without needing a genuine watch-through — these tests
 * only exercise the custom transport bar (FilmControls.tsx), not the gate. */
async function revealFilm(page: Page) {
  await page.goto("/gallery");
  const video = page.locator("video").last();
  await expect(video).toBeVisible();
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.readyState)).toBeGreaterThanOrEqual(1);
  return video;
}

test.describe("film controls (D-45 reskin: CC + Speed)", () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS - see D-27");
  });

  test("Speed cycles the video's real playbackRate and its own label", async ({ page }) => {
    await revealFilm(page);

    const speedButton = page.getByRole("button", { name: "Speed 1×" });
    await expect(speedButton).toBeVisible();

    await speedButton.click();
    await expect(page.getByRole("button", { name: "Speed 1.25×" })).toBeVisible();
    await expect
      .poll(() => page.locator("video").last().evaluate((el: HTMLVideoElement) => el.playbackRate))
      .toBe(1.25);

    await page.getByRole("button", { name: "Speed 1.25×" }).click();
    await expect(page.getByRole("button", { name: "Speed 1.5×" })).toBeVisible();
  });

  // scripts/upload-film.ts never sets captions_path in this environment's
  // test fixture (docs/decisions.md D-45) - CC has nothing to toggle, so it
  // must not render rather than show a dead control. A captioned fixture is
  // needed to exercise the toggle itself; see the owner note in FilmControls.
  test("CC is not offered for a film with no captions track", async ({ page }) => {
    await revealFilm(page);
    await expect(page.getByRole("button", { name: "CC" })).toHaveCount(0);
  });
});
