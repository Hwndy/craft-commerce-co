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
    // landing, gallery, collage, shop, shop-wall, shop-floor, about, contact
    // (Phase 3 T1, docs/decisions.md D-48: 'shop' is a non-guided overview
    // anchor alongside the two real guided-path stops).
    await expect(regionLinks).toHaveCount(8);
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

  test("/list/shop shows the empty-state message and no crash (region-label nodes are internal, never shown)", async ({
    page,
  }) => {
    // T8: ListRegion filters out 'region-label' nodes entirely — they're
    // supabase/seed.sql's internal "nothing published here yet" filler,
    // never real content a list visitor should see (docs/decisions.md).
    await page.goto("/list/shop");
    await expect(page.getByRole("heading", { level: 1, name: "Shop" })).toBeVisible();
    await expect(page.getByText("Nothing published here yet.")).toBeVisible();
    await expect(page.getByText("region-label")).toHaveCount(0);
  });

  test("navigating from the index to a region and back works", async ({ page }) => {
    await page.goto("/list");
    // exact: "Shop (wall)"/"Shop (floor)" also match "Shop" as a substring.
    await page.getByRole("link", { name: "Shop", exact: true }).click();
    await expect(page).toHaveURL(/\/list\/shop$/);
    await page.getByRole("link", { name: "Back to all regions" }).click();
    await expect(page).toHaveURL(/\/list$/);
  });
});
