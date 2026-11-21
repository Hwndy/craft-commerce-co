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

// ShopRoomScene.tsx's own outer container is h-[852px] w-full
// overflow-hidden — anything positioned past that box is genuinely
// clipped (invisible, unclickable) regardless of whether it also
// overlaps another card. Found in review (CodeRabbit, PR #36): an
// earlier tuning pass killed every pairwise overlap by growing the grid
// pitch, but that pushed several cards far enough down/right to be
// clipped by this exact box — the overlap check alone never caught it.
const SCENE_CLIP_HEIGHT = 852;

async function assertWithinScene(page: Page, rects: { label: string; rect: Rect }[]) {
  const sceneBox = await page.getByTestId("e2e-shop-room-scene-box").boundingBox();
  if (!sceneBox) throw new Error("e2e-shop-room-scene-box not found");

  for (const { label, rect } of rects) {
    const relX = rect.x - sceneBox.x;
    const relY = rect.y - sceneBox.y;
    const within =
      relX >= -1 && relY >= -1 && relX + rect.width <= sceneBox.width + 1 && relY + rect.height <= SCENE_CLIP_HEIGHT + 1;
    expect(within, `expected "${label}" to stay within the room's own clipped box (relX=${relX.toFixed(1)}, relY=${relY.toFixed(1)}, right=${(relX + rect.width).toFixed(1)}, bottom=${(relY + rect.height).toFixed(1)})`).toBe(
      true
    );
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

    const rects = await floorRects(page);
    assertNoOverlap(rects);
    await assertWithinScene(page, rects);
    await expect(pageIndicator(page)).not.toBeVisible();
  });

  test("one product past a full page paginates instead of overlapping, and Prev/Next work", async ({ page }) => {
    await page.goto("/e2e/shop-room?total=9");

    await expect(pageIndicator(page)).toHaveText("Page 1 of 2");
    let belts = page.getByRole("button", { name: /^Synthetic Belt No\./ });
    await expect(belts).toHaveCount(8);
    await expect(belts.filter({ hasText: "Synthetic Belt No.9" })).toHaveCount(0);
    let rects = await floorRects(page);
    assertNoOverlap(rects);
    await assertWithinScene(page, rects);

    await page.getByRole("button", { name: "Next products" }).click();
    await expect(pageIndicator(page)).toHaveText("Page 2 of 2");
    belts = page.getByRole("button", { name: /^Synthetic Belt No\./ });
    await expect(belts).toHaveCount(1);
    await expect(belts.filter({ hasText: "Synthetic Belt No.9" })).toHaveCount(1);
    rects = await floorRects(page);
    assertNoOverlap(rects);
    await assertWithinScene(page, rects);
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
      const rects = await floorRects(page);
      assertNoOverlap(rects);
      await assertWithinScene(page, rects);
      if (expectedPage < 3) {
        await page.getByRole("button", { name: "Next products" }).click();
      }
    }
  });
});
