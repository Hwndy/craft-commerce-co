import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

function seriousOrCritical(violations: { impact?: string | null }[]) {
  return violations.filter((v) => v.impact === "serious" || v.impact === "critical");
}

test.describe("list view", () => {
  test("/list shows every region as a link, and axe is clean", async ({ page }) => {
    await page.goto("/list");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const regionLinks = page.locator("nav[aria-label='Regions'] a");
    await expect(regionLinks).toHaveCount(6); // landing, gallery, collage, shop, about, contact
    await expect(page.getByRole("link", { name: "Gallery" })).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(seriousOrCritical(results.violations), JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  test("/list/gallery shows the published film as real content", async ({ page }) => {
    await page.goto("/list/gallery");
    await expect(page.getByRole("heading", { level: 1, name: "Gallery" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2 })).toHaveText("ALL LIFE Test Film");
    await expect(page.getByRole("link", { name: "Watch the film" })).toHaveAttribute("href", "/gallery");
  });

  test("/list/shop shows a placeholder region-label node and no crash", async ({ page }) => {
    await page.goto("/list/shop");
    await expect(page.getByRole("heading", { level: 1, name: "Shop" })).toBeVisible();
    await expect(page.getByText("region-label")).toBeVisible();
  });

  test("navigating from the index to a region and back works", async ({ page }) => {
    await page.goto("/list");
    await page.getByRole("link", { name: "Shop" }).click();
    await expect(page).toHaveURL(/\/list\/shop$/);
    await page.getByRole("link", { name: "Back to all regions" }).click();
    await expect(page).toHaveURL(/\/list$/);
  });
});
