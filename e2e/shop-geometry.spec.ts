import { test, expect, type Page, type Locator } from "@playwright/test";

/**
 * The real anti-overlap guarantee the Shop room never had (docs/
 * decisions.md D-82) — three prior fixes (D-76, D-78, 6d27b0c) all reasoned
 * from flat 2D pixel math, but the room is a true CSS `perspective` scene,
 * where that math doesn't reliably predict final on-screen bounding boxes.
 * This measures real, rendered `getBoundingClientRect()`s (jsdom/Vitest
 * can't: no real layout engine) via src/pages/E2EShopRoom.tsx, a synthetic-
 * data-only route that needs no local Supabase stack.
 */

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function overlaps(a: Rect, b: Rect): boolean {
  // 1px tolerance: adjacent elements sharing an edge aren't "overlapping".
  const epsilon = 1;
  return (
    a.x + a.width - epsilon > b.x &&
    b.x + b.width - epsilon > a.x &&
    a.y + a.height - epsilon > b.y &&
    b.y + b.height - epsilon > a.y
  );
}

async function floorRects(page: Page): Promise<{ label: string; rect: Rect }[]> {
  const posters = page.locator('[data-testid^="floor-poster-"]');
  const badges = page.getByRole("button", { name: /^Synthetic Belt No\./ });

  const results: { label: string; rect: Rect }[] = [];
  for (const locator of [posters, badges]) {
    const count = await locator.count();
    for (let i = 0; i < count; i += 1) {
      const el = locator.nth(i);
      const label = (await el.getAttribute("data-testid")) ?? (await el.textContent()) ?? `item-${i}`;
      const box = await el.boundingBox();
      if (box) results.push({ label, rect: box });
    }
  }
  return results;
}

function assertNoOverlap(rects: { label: string; rect: Rect }[]) {
  for (let i = 0; i < rects.length; i += 1) {
    for (let j = i + 1; j < rects.length; j += 1) {
      expect(
        overlaps(rects[i].rect, rects[j].rect),
        `expected "${rects[i].label}" and "${rects[j].label}" not to overlap`
      ).toBe(false);
    }
  }
}

function pageIndicator(page: Page): Locator {
  return page.getByText(/^Page \d+ of \d+$/);
}

test.describe("Shop room geometry (docs/decisions.md D-82)", () => {
  test("a full page (PRODUCTS_PER_PAGE products) renders with zero overlap and no pagination controls", async ({
    page,
  }) => {
    await page.goto("/e2e/shop-room?total=8");
    const belts = page.getByRole("button", { name: /^Synthetic Belt No\./ });
    await expect(belts).toHaveCount(8);

    assertNoOverlap(await floorRects(page));
    await expect(pageIndicator(page)).not.toBeVisible();
  });

  test("one product past a full page paginates instead of overlapping, and Prev/Next work", async ({ page }) => {
    await page.goto("/e2e/shop-room?total=9");

    await expect(pageIndicator(page)).toHaveText("Page 1 of 2");
    let belts = page.getByRole("button", { name: /^Synthetic Belt No\./ });
    await expect(belts).toHaveCount(8);
    await expect(belts.filter({ hasText: "Synthetic Belt No.9" })).toHaveCount(0);
    assertNoOverlap(await floorRects(page));

    await page.getByRole("button", { name: "Next products" }).click();
    await expect(pageIndicator(page)).toHaveText("Page 2 of 2");
    belts = page.getByRole("button", { name: /^Synthetic Belt No\./ });
    await expect(belts).toHaveCount(1);
    await expect(belts.filter({ hasText: "Synthetic Belt No.9" })).toHaveCount(1);
    assertNoOverlap(await floorRects(page));
    await expect(page.getByRole("button", { name: "Next products" })).toBeDisabled();

    await page.getByRole("button", { name: "Previous products" }).click();
    await expect(pageIndicator(page)).toHaveText("Page 1 of 2");
    await expect(page.getByRole("button", { name: "Previous products" })).toBeDisabled();
  });

  test("a large synthetic catalogue (20 products) still renders every page with zero overlap", async ({ page }) => {
    await page.goto("/e2e/shop-room?total=20");

    await expect(pageIndicator(page)).toHaveText("Page 1 of 3");
    for (let expectedPage = 1; expectedPage <= 3; expectedPage += 1) {
      await expect(pageIndicator(page)).toHaveText(`Page ${expectedPage} of 3`);
      assertNoOverlap(await floorRects(page));
      if (expectedPage < 3) {
        await page.getByRole("button", { name: "Next products" }).click();
      }
    }
  });
});
