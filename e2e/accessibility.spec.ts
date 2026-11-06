import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

function seriousOrCritical(violations: { impact?: string | null }[]) {
  return violations.filter((v) => v.impact === "serious" || v.impact === "critical");
}

test.describe("accessibility", () => {
  test("landing page (/) has no serious or critical violations", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page }).analyze();
    expect(seriousOrCritical(results.violations), JSON.stringify(results.violations, null, 2)).toEqual(
      []
    );
  });

  test("/gallery, with the film revealed, has no serious or critical violations", async ({
    page,
    browserName,
  }) => {
    // See docs/decisions.md D-27: this environment's WebKit build cannot
    // decode this project's HLS film, so the film never reaches a revealed,
    // playing state here. Real Safari is unaffected and must be checked by
    // hand.
    test.skip(browserName === "webkit", "WebKit build in this environment cannot decode HLS — see D-27");
    await page.goto("/gallery");
    const video = page.locator("video").last();
    await expect(video).toBeVisible();
    await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.readyState)).toBeGreaterThanOrEqual(1);

    const results = await new AxeBuilder({ page }).analyze();
    expect(seriousOrCritical(results.violations), JSON.stringify(results.violations, null, 2)).toEqual(
      []
    );
  });
});
