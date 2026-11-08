import { test, expect, type Page } from "@playwright/test";

/** Same genuine-watch-through reveal used by e2e/canvas-gestures.spec.ts and e2e/photo-viewer.spec.ts. */
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

  const camera = page.locator("[data-camera-x]").first();
  await expect
    .poll(async () => ({
      x: Number(await camera.getAttribute("data-camera-x")),
      y: Number(await camera.getAttribute("data-camera-y")),
      zoom: Number(await camera.getAttribute("data-camera-zoom")),
    }))
    .toEqual({ x: 2000, y: 1200, zoom: 1 });
}

test.describe("product overlay (T3)", () => {
  test("opening the seeded product from its board node shows the overlay with real content", async ({
    page,
    browserName,
    isMobile,
  }) => {
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");
    // CanvasChrome's region-tab row is desktop-only (hidden md:flex) — this
    // one test's navigation step needs it; the deep-link tests below cover
    // the overlay itself on every project, mobile included.
    test.skip(isMobile, "region tabs used to reach the Shop node are desktop-only");

    await revealBoard(page);
    await page.getByRole("button", { name: "Shop (floor)" }).click();

    const productButton = page.getByRole("button", { name: /Sample Belt No\.5/ });
    await expect(productButton).toBeVisible({ timeout: 10000 });
    await productButton.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Sample Belt No.5")).toBeVisible();
    await expect(dialog.getByText("£40.00")).toBeVisible();
    await expect(dialog.getByText("Belt made from repurposed bike tyre")).toBeVisible();
    expect(page.url()).toContain("/gallery/shop/sample-belt-no-5");
  });

  test("a direct /gallery/shop/:slug deep link opens the overlay once unlocked", async ({ page, browserName }) => {
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");
    await revealBoard(page);

    await page.goto("/gallery/shop/sample-belt-no-5");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Sample Belt No.5")).toBeVisible();
  });

  test("a bare /shop/:slug visit redirects into the same overlay (docs/01-architecture.md's documented URL)", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");
    await revealBoard(page);

    await page.goto("/shop/sample-belt-no-5");
    await expect(page).toHaveURL(/\/gallery\/shop\/sample-belt-no-5$/);
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("the X button closes the overlay and the back button closes it too", async ({ page, browserName }) => {
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");
    await revealBoard(page);

    await page.goto("/gallery/shop/sample-belt-no-5");
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByLabel("Close").click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page).toHaveURL(/\/gallery\/?$/);

    // Re-open, then close via the browser's own Back button this time —
    // T3's own "deep link and back-button behaviour" requirement.
    await page.goto("/gallery/shop/sample-belt-no-5");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("Escape closes the overlay", async ({ page, browserName }) => {
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");
    await revealBoard(page);

    await page.goto("/gallery/shop/sample-belt-no-5");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("a deep link for an unknown slug shows a not-available message instead of crashing", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");
    await revealBoard(page);

    await page.goto("/gallery/shop/not-a-real-product");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("This item isn't available")).toBeVisible();
  });

  // T4 (FR-5.1): purchase by email.
  test("the Buy / Enquire link has the right mailto subject and body, and the copy/form actions are present", async ({
    page,
    browserName,
    context,
  }) => {
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await revealBoard(page);

    await page.goto("/gallery/shop/sample-belt-no-5");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const buyLink = dialog.getByRole("link", { name: "Buy / Enquire" });
    const href = await buyLink.getAttribute("href");
    expect(href).toBeTruthy();
    const decoded = decodeURIComponent(href!);
    expect(decoded).toContain("subject=Enquiry: Sample Belt No.5 (GBP 40)");
    expect(decoded).toContain("Sample Belt No.5");
    expect(decoded).toContain("£40.00");
    expect(decoded).toContain("/shop/sample-belt-no-5");

    await dialog.getByRole("button", { name: "Copy email address" }).click();
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toBe(href!.replace(/^mailto:/, "").split("?")[0]);

    await expect(dialog.getByRole("button", { name: "Use the form instead" })).toBeEnabled();
  });

  // T5 (FR-5.2–FR-5.4): the fallback enquiry form. submit-enquiry itself is
  // mocked (not a real Supabase project to hit from e2e) — this proves the
  // client-side flow: open the form, fill it in, Turnstile's own test site
  // key auto-verifies for real (no network stubbing of challenges.
  // cloudflare.com), submit, see the success state.
  test("'Use the form instead' opens a working enquiry form that submits and shows success", async ({
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

    await page.goto("/gallery/shop/sample-belt-no-5");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "Use the form instead" }).click();
    await expect(dialog.getByText("Hi, I'd like to ask about Sample Belt No.5.")).toBeVisible();

    await dialog.getByLabel("Name").fill("Jane Visitor");
    await dialog.getByLabel("Email").fill("jane@example.com");
    await dialog.getByLabel("Message").fill("Is this still available?");

    const sendButton = dialog.getByRole("button", { name: "Send enquiry" });
    // Cloudflare's "always passes" test site key (.env.example) auto-solves
    // without any click — just needs a moment to load and call back.
    await expect(sendButton).toBeEnabled({ timeout: 15000 });
    await sendButton.click();

    await expect(dialog.getByText("Thank you — message sent")).toBeVisible();
    expect(requestBody).toMatchObject({
      name: "Jane Visitor",
      email: "jane@example.com",
      message: "Is this still available?",
      website: "",
    });
    expect(typeof requestBody?.turnstileToken).toBe("string");
    expect((requestBody?.turnstileToken as string).length).toBeGreaterThan(0);
  });
});
