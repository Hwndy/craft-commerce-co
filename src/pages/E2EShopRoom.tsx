import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { cameraForViewpoint, getViewpoint } from "@/canvas/viewpoints";
import { PRODUCTS_PER_PAGE, ShopRoomScene } from "@/features/shop/ShopRoomScene";
import type { ProductNode } from "@/features/shop/lib/queries";

function useWindowSize() {
  const [size, setSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return size;
}

function syntheticNode(index: number): ProductNode {
  return {
    nodeId: `synthetic-${index}`,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    rotation: 0,
    product: {
      id: `synthetic-${index}`,
      slug: `synthetic-belt-${index}`,
      name: `Synthetic Belt No.${index + 1}`,
      priceAmount: 40,
      priceCurrency: "GBP",
      description: "Synthetic fixture product for e2e geometry testing.",
      bullets: [],
      status: "available",
      zone: "floor",
      onSale: false,
      sortOrder: index,
      poster: null,
    },
  };
}

/**
 * A deliberately always-registered route (not gated by `import.meta.env.DEV`
 * the way src/pages/DevUpload.tsx is) — that guard is a build-time constant
 * Vite dead-code-eliminates, so a DEV-only route literally doesn't exist in
 * the production build `npm run preview` serves, which is exactly what
 * Playwright's e2e suite runs against (see DevUpload.tsx's own comment).
 * This route is instead gated by VITE_E2E_TEST_ROUTES (.env.example), set
 * only in CI's/local e2e's own build step — never in the real Vercel
 * deployment — so it ships in the build the geometry test needs and never
 * in the build real visitors get.
 *
 * It mounts the real ShopRoomScene directly, with synthetic, locally
 * generated ProductNode[] data instead of Supabase-backed hooks (unlike
 * ShopRegion.tsx) — e2e/shop-geometry.spec.ts needs real, rendered
 * getBoundingClientRect() geometry under ShopRoomScene's actual CSS
 * `perspective` transforms (jsdom/Vitest can't measure that: no real
 * layout engine), without a local Supabase stack. `?total=<n>` sets the
 * synthetic catalogue size (docs/decisions.md D-82); pagination state here
 * mirrors ShopRegion.tsx's own (kept duplicated, deliberately: this file is
 * test fixture code, not a production code path).
 *
 * Wrapped in a fixed 1600×900 box (`SCENE_WIDTH`/`SCENE_HEIGHT`,
 * `ShopRegion.tsx`) rather than left to fill the bare viewport — found in
 * review (CodeRabbit, PR #36): `ShopRoomScene`'s own `w-full`/anchor
 * position (`calc(50% + 230px)`) resolve against *whatever contains it*,
 * and in production that's always this fixed 1600×900 world-space box
 * (`Region.tsx` sets an explicit pixel width/height, independent of the
 * real device's viewport — the Board's own camera pans/zooms that fixed
 * box into view, same as every other region on this board), never the
 * bare browser viewport this route used to leave it against. Testing
 * containment against the real browser window at 1280px or a 390px phone
 * width was measuring a geometry that production never actually produces.
 *
 * Also wrapped in `Board.tsx`'s own `position: fixed; overflow: hidden`
 * top-level clip (same values) — without it, a real mobile browser's
 * layout viewport expands to fit this unconstrained 1600px-wide content
 * (confirmed directly: `window.innerWidth` read back 1601 on an emulated
 * 412px-wide device), which fed `useIsMobile()`'s `window.innerWidth < 768`
 * check a wrong, inflated value and silently skipped `ShopRoomScene`'s own
 * mobile `scale(0.55)` branch entirely — a second harness fidelity gap,
 * not a real production behaviour (`Board.tsx`'s real top-level container
 * already clips the same way, so `window.innerWidth` there always reflects
 * the device's true width regardless of how wide any region's content is).
 *
 * A third fidelity gap, investigated for the same reason as the first two
 * but this time *ruled out*, not confirmed: `e2e/product-overlay.spec.ts`'s
 * "opening the seeded product from its board node" test (which clicks
 * "The Shop" region tab — a guided-path camera flight to `shop-wall`'s
 * viewpoint — then the product button) failed on CI right after this PR's
 * grid retuning, and unlike every other test in that file (which reach the
 * overlay via a direct `/gallery/shop/:slug` URL, never through the room's
 * own camera-framed click), that one actually exercises geometry this PR
 * changed. Worth checking properly rather than assuming: in production
 * `ShopRoomScene` sits inside `Region.tsx` (positioned at
 * `getViewpoint("shop-wall").x/y` minus half the scene size) inside
 * `Board.tsx`'s own world div, panned/zoomed by the real guided-path
 * camera (`cameraForViewpoint`, `Board.tsx`'s own
 * `translate3d(-x*zoom,-y*zoom,0) scale(zoom)`) — this route didn't apply
 * that transform at all before, so "inside the room's own box" (the
 * previous fix above) was never the same question as "inside the camera's
 * actual framed window," a strictly smaller area. Reproducing the exact
 * same `getViewpoint`/`cameraForViewpoint`/transform chain here (not
 * duplicating the formula by hand) and measuring the real 1-2 product
 * count that test's own seeded fixture uses showed both products land
 * comfortably inside the camera's frame on every configured browser/device
 * project — this geometry is not the cause of that CI failure. Kept
 * anyway: it's a strictly more faithful reproduction of production than
 * the un-transformed version, and `e2e/shop-geometry.spec.ts`'s own
 * "page 1 stays on screen from the real guided-path viewpoint" test now
 * uses it to guard the regression surface that failure's test depends on.
 */
const SCENE_WIDTH = 1600;
const SCENE_HEIGHT = 900;

export default function E2EShopRoom() {
  const [params] = useSearchParams();
  const total = Math.max(0, Number(params.get("total") ?? PRODUCTS_PER_PAGE));
  const [page, setPage] = useState(0);
  const windowSize = useWindowSize();

  const allNodes = useMemo(() => Array.from({ length: total }, (_, index) => syntheticNode(index)), [total]);
  const totalPages = Math.max(1, Math.ceil(allNodes.length / PRODUCTS_PER_PAGE));
  const currentPage = Math.min(page, totalPages - 1);
  const shownNodes = allNodes.slice(currentPage * PRODUCTS_PER_PAGE, (currentPage + 1) * PRODUCTS_PER_PAGE);

  const viewpoint = getViewpoint("shop-wall");
  const camera = cameraForViewpoint(viewpoint, windowSize);
  const regionX = viewpoint.x - SCENE_WIDTH / 2;
  const regionY = viewpoint.y - SCENE_HEIGHT / 2;

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden" }}>
      <div
        data-testid="e2e-shop-room-world"
        style={{
          position: "absolute",
          inset: 0,
          transformOrigin: "0 0",
          transform: `translate3d(${-camera.x * camera.zoom}px, ${-camera.y * camera.zoom}px, 0) scale(${camera.zoom})`,
        }}
      >
        <div
          data-testid="e2e-shop-room-scene-box"
          style={{ position: "absolute", left: regionX, top: regionY, width: SCENE_WIDTH, height: SCENE_HEIGHT }}
        >
          <ShopRoomScene
            nodes={shownNodes}
            page={currentPage}
            totalPages={totalPages}
            onPrevPage={() => setPage((p) => Math.max(0, p - 1))}
            onNextPage={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          />
        </div>
      </div>
    </div>
  );
}
