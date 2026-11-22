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

// Investigated, not assumed, after a real CI failure (found in review,
// CodeRabbit, PR #36's containment fix, then a follow-up CI run):
// e2e/product-overlay.spec.ts's "opening the seeded product from its board
// node" test reaches the Shop room by clicking "The Shop" region tab — a
// guided-path camera flight to the real shop-wall viewpoint — then the
// product button, unlike every other product-overlay test (which deep-
// link straight to the overlay's URL). Being inside ShopRoomScene's own
// clipped box (assertWithinScene above) doesn't guarantee a product also
// lands inside the *camera's own framed window*, a strictly smaller area —
// src/pages/E2EShopRoom.tsx now reproduces that exact camera transform.
// Checked directly: both of CI's real seeded products (synthetic total=2
// here, matching that fixture's actual count) land inside the frame on
// every configured project, ruling this out as that failure's cause — kept
// as a real, permanent regression guard either way.
async function assertWithinRealCameraFrame(page: Page) {
  const viewportSize = page.viewportSize();
  if (!viewportSize) throw new Error("page has no viewport size");

  const belts = page.getByRole("button", { name: /^Synthetic Belt No\./ });
  const count = await belts.count();
  for (let i = 0; i < count; i += 1) {
    const el = belts.nth(i);
    const label = await el.textContent();
    const box = await el.boundingBox();
    if (!box) throw new Error(`${label} has no bounding box`);
    const within =
      box.x >= 0 && box.y >= 0 && box.x + box.width <= viewportSize.width && box.y + box.height <= viewportSize.height;
    expect(
      within,
      `expected "${label}" to stay inside the real guided-path camera frame (box=${JSON.stringify(box)}, viewport=${JSON.stringify(viewportSize)})`
    ).toBe(true);
    // A real click, not just a bounding-box check — Playwright's own
    // actionability wait (visible, stable, receives pointer events,
    // genuinely in view) is a stronger signal than geometry alone that
    // a real visitor could reach this product from this exact viewpoint.
    await el.click({ timeout: 3000 });
  }
}

test.describe("Shop room geometry (docs/decisions.md D-82)", () => {
  test("page 1 stays reachable from the real guided-path camera viewpoint, for today's real catalogue size", async ({
    page,
  }) => {
    await page.goto("/e2e/shop-room?total=2");
    await expect(page.getByRole("button", { name: /^Synthetic Belt No\./ })).toHaveCount(2);
    await assertWithinRealCameraFrame(page);
  });

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

    // Expected belt numbers per page (1-indexed, matching E2EShopRoom.tsx's
    // "Synthetic Belt No.N" naming) — found in review (CodeRabbit, PR #36):
    // an empty page would still pass the geometry checks below (zero rects
    // is trivially non-overlapping and contained), so this also has to
    // confirm each page actually holds the products it's supposed to.
    const expectedBeltsByPage = [
      Array.from({ length: 8 }, (_, i) => i + 1),
      Array.from({ length: 8 }, (_, i) => i + 9),
      Array.from({ length: 4 }, (_, i) => i + 17),
    ];

    await expect(pageIndicator(page)).toHaveText("Page 1 of 3");
    for (let expectedPage = 1; expectedPage <= 3; expectedPage += 1) {
      await expect(pageIndicator(page)).toHaveText(`Page ${expectedPage} of 3`);
      const belts = page.getByRole("button", { name: /^Synthetic Belt No\./ });
      const expectedNames = expectedBeltsByPage[expectedPage - 1].map((n) => `Synthetic Belt No.${n}`);
      await expect(belts).toHaveCount(expectedNames.length);
      for (const name of expectedNames) {
        await expect(belts.filter({ hasText: name })).toHaveCount(1);
      }

      const rects = await floorRects(page);
      assertNoOverlap(rects);
      await assertWithinScene(page, rects);
      if (expectedPage < 3) {
        await page.getByRole("button", { name: "Next products" }).click();
      }
    }
  });
});
