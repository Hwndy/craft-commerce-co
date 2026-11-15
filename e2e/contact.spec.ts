import { test, expect, type Page } from "@playwright/test";

/** Same genuine-watch-through reveal used by e2e/product-overlay.spec.ts and others. */
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

// Renamed from about-contact.spec.ts — docs/decisions.md D-71, Step 9
// removed the About region outright, leaving this file Contact-only.
test.describe("Contact region (T6)", () => {
  // Found in review (Greptile/CodeRabbit, PR #3): a genuinely first-time
  // visitor (gate not yet unlocked) who opens /contact directly previously
  // lost that destination the moment they clicked Continue — FilmStage's
  // own handoff flew unconditionally to the collage instead.
  // Distinct from every other test below, which calls revealBoard() first
  // (an *already-unlocked* visit) and so never exercised this path.
  test("a genuinely first-time visitor who opens /contact directly still lands there after watching and clicking Continue", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");

    await page.goto("/contact");
    await expect(page).toHaveURL(/\/gallery\/contact$/);

    const video = page.locator("video").last();
    await expect(video).toBeVisible();
    await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.readyState)).toBeGreaterThanOrEqual(1);
    await video.evaluate((el: HTMLVideoElement) => {
      const duration = el.duration;
      for (let t = 0; t <= duration; t += 0.5) {
        el.currentTime = t;
        el.dispatchEvent(new Event("timeupdate"));
      }
      el.pause();
      el.dispatchEvent(new Event("ended"));
    });
    await page.getByRole("button", { name: "Continue" }).click();

    const region = page.locator('section[data-region-id="contact"]');
    await expect(region.getByText("Commissions, collaborations, press or a question about a belt.")).toBeVisible();
    await expect(region.getByRole("link", { name: /^Send us an email at /i })).toBeVisible();
  });

  test("a direct /contact visit redirects into the board's Contact region", async ({ page, browserName }) => {
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");
    await page.goto("/contact");
    await expect(page).toHaveURL(/\/gallery\/contact$/);
  });

  // docs/decisions.md D-71, client feedback Step 8: the enquiry form was
  // removed from Contact entirely (UI only — submit-enquiry/enquiries/RLS
  // all stay in place, dormant) in favour of the plain mailto link below,
  // so there's no form-submission flow left to exercise here any more.

  test("the email address is shown as the link's own visible text, and social links with no owner URL yet are disabled", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");
    await revealBoard(page);
    await page.goto("/gallery/contact");

    const region = page.locator('section[data-region-id="contact"]');
    const emailLink = region.getByRole("link", { name: /^Send us an email at /i });
    await expect(emailLink).toBeVisible();
    await expect(emailLink).toHaveAttribute("href", /^mailto:.+@.+/);
    // The href's own address appears again as real visible text, not a
    // generic "contact us"-style label — docs/decisions.md D-71 reversing
    // D-53's earlier "name the purpose, not the address" choice.
    const href = (await emailLink.getAttribute("href"))!;
    const address = href.replace(/^mailto:/, "");
    await expect(emailLink).toHaveText(`Send us an email at ${address}`);

    await expect(region.getByRole("button", { name: "Instagram (coming soon)" })).toBeDisabled();
  });
});
