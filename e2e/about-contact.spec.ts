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

test.describe("About and Contact regions (T6)", () => {
  // Found in review (Greptile/CodeRabbit, PR #3): a genuinely first-time
  // visitor (gate not yet unlocked) who opens /about or /contact directly
  // previously lost that destination the moment they clicked Continue —
  // FilmStage's own handoff flew unconditionally to the collage instead.
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
    await expect(region.getByLabel("Name")).toBeVisible();
  });

  test("a direct /about visit redirects into the board's About region", async ({ page, browserName }) => {
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");
    await page.goto("/about");
    // The film gate (T10/D-07) still covers the page on a cold visit —
    // same reasoning as a direct /shop/:slug or /gallery/photo/:id deep
    // link — but the redirect itself (docs/01-architecture.md's "/about —
    // Board focused on that region") happens at the router, independent of
    // the gate.
    await expect(page).toHaveURL(/\/gallery\/about$/);
  });

  test("a direct /contact visit redirects into the board's Contact region", async ({ page, browserName }) => {
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");
    await page.goto("/contact");
    await expect(page).toHaveURL(/\/gallery\/contact$/);
  });

  test("the About region shows the owner's real copy, with the brand story clearly flagged as a placeholder", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");
    await revealBoard(page);
    await page.goto("/gallery/about");

    const region = page.locator('section[data-region-id="about"]');
    await expect(region.getByText("Light entering from darkness.")).toBeVisible();
    await expect(region.getByText(/ALL LIFE expresses inner drives/)).toBeVisible();
    await expect(region.getByText("Placeholder — pending the owner's own words")).toBeVisible();
    await expect(region.getByText("Artworks")).toBeVisible();
  });

  test("the Contact region's form submits a real enquiry, with no product selected", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");
    await revealBoard(page);

    let requestBody: Record<string, unknown> | undefined;
    await page.route("**/functions/v1/submit-enquiry", async (route) => {
      requestBody = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });

    await page.goto("/gallery/contact");
    const region = page.locator('section[data-region-id="contact"]');
    await expect(region.getByText("Commissions, collaborations, press or a question about a belt.")).toBeVisible();

    await region.getByLabel("Name").fill("Jane Visitor");
    await region.getByLabel("Email").fill("jane@example.com");
    await region.getByLabel("Message").fill("Do you take custom commissions?");

    const sendButton = region.getByRole("button", { name: "Send enquiry" });
    await expect(sendButton).toBeEnabled({ timeout: 15000 });
    await sendButton.click();

    await expect(region.getByText("Thank you — message sent")).toBeVisible();
    expect(requestBody).toMatchObject({
      name: "Jane Visitor",
      email: "jane@example.com",
      message: "Do you take custom commissions?",
    });
    // No "About a product" option was chosen — the dropdown's own default.
    expect(requestBody?.productId).toBeUndefined();
  });

  // T6's own "About a product (optional)" dropdown (matching the owner's
  // mockup) — ProductOverlay's own enquiry form never shows this (it
  // already has a fixed productId), so this is the one place it's
  // exercised against the real seeded products.
  test("the Contact region's product picker lists the real seeded products and includes the choice in the enquiry", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");
    await revealBoard(page);

    let requestBody: Record<string, unknown> | undefined;
    await page.route("**/functions/v1/submit-enquiry", async (route) => {
      requestBody = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });

    await page.goto("/gallery/contact");
    const region = page.locator('section[data-region-id="contact"]');
    const picker = region.getByLabel("About a product (optional)");
    await expect(picker).toBeVisible({ timeout: 10000 });
    await picker.click();
    await page.getByRole("option", { name: /Sample Belt No\.5/ }).click();

    await region.getByLabel("Name").fill("Jane Visitor");
    await region.getByLabel("Email").fill("jane@example.com");
    await region.getByLabel("Message").fill("Is this one still available?");

    const sendButton = region.getByRole("button", { name: "Send enquiry" });
    await expect(sendButton).toBeEnabled({ timeout: 15000 });
    await sendButton.click();

    await expect(region.getByText("Thank you — message sent")).toBeVisible();
    expect(typeof requestBody?.productId).toBe("string");
  });

  test("the email link names its purpose rather than showing the raw address, and social links with no owner URL yet are disabled", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");
    await revealBoard(page);
    await page.goto("/gallery/contact");

    const region = page.locator('section[data-region-id="contact"]');
    const emailLink = region.getByRole("link", { name: "Email ALL LIFE directly" });
    await expect(emailLink).toBeVisible();
    await expect(emailLink).toHaveAttribute("href", /^mailto:.+@.+/);

    await expect(region.getByRole("button", { name: "Instagram (coming soon)" })).toBeDisabled();
  });
});
