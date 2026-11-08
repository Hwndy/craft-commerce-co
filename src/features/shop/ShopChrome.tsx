import { useEffect, useState } from "react";

import { nearestViewpoint } from "@/canvas/nearestViewpoint";
import { useCameraStore } from "@/canvas/store";
import { listViewpoints } from "@/canvas/viewpoints";

const POLL_MS = 200;
const SHOP_REGION_KEYS = new Set(["shop-wall", "shop-floor"]);

/**
 * Fixed, screen-anchored chrome for the Shop screens — breadcrumb, tagline
 * and the "buy by email" helper text, all the owner's own copy from their
 * design mockup (docs/decisions.md D-45), not guessed (AGENTS.md rule 10).
 * Shown for either Shop region (wall or floor), same reasoning as
 * CollageChrome's own single-region gate, just a 2-key set instead of 1.
 *
 * No Circle/Diagonal-style layout toggle or zoom cluster here — unlike the
 * collage, Shop has nothing equivalent to add (positions are curated, not
 * a layout mode to switch between), so this chrome stays deliberately
 * small.
 *
 * Sits at `top-20`, not `top-0` — CanvasChrome's own top bar (logo +
 * Guided/Explore + List view) already occupies the full-width `inset-x-0
 * top-0` band at all times, so stacking this breadcrumb row directly on
 * top of it overlapped both ends (found in review, same "clear
 * CanvasChrome's fixed elements" rule CollageChrome's own comment states).
 */
export function ShopChrome() {
  const [isNearShop, setIsNearShop] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => {
      // Read fresh each tick, not once at mount — see docs/decisions.md's
      // CollageChrome addendum for why a mount-time snapshot of
      // listViewpoints() is the wrong call here.
      const viewpoints = listViewpoints();
      const { camera, viewport } = useCameraStore.getState();
      const current = nearestViewpoint(camera, viewpoints, viewport.width, viewport.height);
      setIsNearShop(!!current && SHOP_REGION_KEYS.has(current.key));
    }, POLL_MS);
    return () => window.clearInterval(interval);
  }, []);

  if (!isNearShop) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[55] font-body text-sm text-foreground">
      <div data-shop-chrome className="pointer-events-auto absolute inset-x-0 top-20 flex items-start justify-between gap-3 px-4">
        <div className="flex items-baseline gap-2">
          <span className="font-heading text-sm font-bold uppercase tracking-wider">Shop</span>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Handcrafted belts · repurposed bike tyre, sand-cast aluminium
          </span>
        </div>
        <p className="hidden text-xs text-muted-foreground md:block">Buy by email — tap a belt to see it turn</p>
      </div>
    </div>
  );
}
