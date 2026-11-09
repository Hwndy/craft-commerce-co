import { cameraCenter, cameraFromCenter } from "./math";
import type { Camera, Viewpoint } from "./types";

/**
 * Static fallback registry — used until `useViewpointsQuery()` (lib/
 * useViewpoints.ts) loads the real `viewpoints` table (migration 0002)
 * and calls `setViewpointsCache`, and again if that query ever fails
 * (offline, etc.). Keeps `landing`/`gallery` at the exact positions Phase
 * 1's entry sequence and gate flow were verified against, so this can
 * never silently move the camera somewhere those tests don't expect.
 * `collage` is included too (matching supabase/seed.sql exactly) because
 * Gallery.tsx's Collage region (T8) reads its centre synchronously at
 * mount — before the real query can possibly have resolved yet.
 * `shop-wall`/`shop-floor` are here for the exact same reason (T2): Gallery
 * renders both ShopRegion instances unconditionally alongside Collage, so
 * their `getViewpoint()` calls are just as synchronous and would otherwise
 * throw "Unknown viewpoint" on any render before ViewpointsBootstrap's
 * query resolves (a real crash, not a stale-camera-position question —
 * found in review). `shop` itself is deliberately left out: nothing calls
 * `getViewpoint("shop")` synchronously at render time today.
 * `about`/`contact` (T6) are here for the same reason again — Gallery
 * renders both unconditionally too, and `/about`/`/contact`'s own redirect
 * (App.tsx) calls `getViewpoint()` with one of these keys on mount.
 *
 * `sortOrder` values here are fallback-only — they only need to preserve
 * *relative* order among the handful of keys actually present (there's no
 * `shop` entry, so this registry's own numbering is already a compacted
 * subset, not a mirror of supabase/seed.sql's absolute numbers). Once the
 * real query resolves, `setViewpointsCache` below replaces this whole
 * object outright, seed.sql's own values and all — these never cross over
 * (noted in review, CodeRabbit, PR #3).
 *
 * `getViewpoint`/`listViewpoints` stay synchronous so every existing call
 * site (event handlers, non-component code like useBoardKeyboard.ts) keeps
 * working unchanged — only the data source behind them changes.
 */
const fallbackViewpoints: Record<string, Viewpoint> = {
  landing: {
    key: "landing",
    label: "Landing",
    x: 0,
    y: 0,
    zoom: 1,
    sortOrder: 0,
    inGuidedPath: true,
  },
  gallery: {
    key: "gallery",
    label: "Gallery",
    x: 2000,
    y: 0,
    zoom: 1,
    sortOrder: 1,
    inGuidedPath: true,
  },
  collage: {
    key: "collage",
    label: "Collage",
    x: 2000,
    y: 1200,
    zoom: 1,
    sortOrder: 2,
    inGuidedPath: true,
  },
  "shop-wall": {
    key: "shop-wall",
    label: "Shop (wall)",
    x: -2000,
    y: 0,
    zoom: 1,
    sortOrder: 3,
    inGuidedPath: true,
  },
  "shop-floor": {
    key: "shop-floor",
    label: "Shop (floor)",
    x: -2000,
    y: 1200,
    zoom: 1,
    sortOrder: 4,
    inGuidedPath: true,
  },
  about: {
    key: "about",
    label: "About",
    x: 0,
    y: -2000,
    zoom: 1,
    sortOrder: 5,
    inGuidedPath: true,
  },
  contact: {
    key: "contact",
    label: "Contact",
    x: 0,
    y: 2000,
    zoom: 1,
    sortOrder: 6,
    inGuidedPath: true,
  },
};

let cachedViewpoints: Record<string, Viewpoint> | null = null;

/** Called by useViewpointsQuery() once the real table has loaded. */
export function setViewpointsCache(viewpoints: Viewpoint[]): void {
  cachedViewpoints = Object.fromEntries(viewpoints.map((v) => [v.key, v]));
}

/** Test-only: clears the cache so a test can exercise the fallback path. */
export function clearViewpointsCache(): void {
  cachedViewpoints = null;
}

function activeViewpoints(): Record<string, Viewpoint> {
  return cachedViewpoints ?? fallbackViewpoints;
}

export function getViewpoint(key: string): Viewpoint {
  const viewpoint = activeViewpoints()[key];
  if (!viewpoint) {
    throw new Error(`Unknown viewpoint: ${key}`);
  }
  return viewpoint;
}

export function listViewpoints(): Viewpoint[] {
  return Object.values(activeViewpoints()).sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Region keys whose own Region placement treats the viewpoint's x/y as the
 * panel's *centre* — distinct from Gallery/Collage, where a flyTo/
 * setCamera(viewpoint) call landing with that same x/y as the camera's own
 * top-left is the already-tested, intentional behaviour (interpolateCamera
 * in math.ts is built to end there exactly; e2e/product-overlay.spec.ts's
 * revealBoard() already asserts that literally for "collage"). About and
 * Contact (T6) were the first case where a visitor can land directly on a
 * region whose real, immediately-readable content — not hidden behind a
 * modal or the film layer — must actually be centred the moment they
 * arrive, rather than left mostly off-screen above/left of the viewport
 * (found in review, Greptile/CodeRabbit, PR #3).
 *
 * shop-wall/shop-floor (T2) turned out to need the same treatment, found
 * afterwards by the owner: unlike Collage's many generative, spread-out
 * photos (where landing on one quadrant of a large browsable field and
 * panning the rest is reasonable), each Shop region is seeded with exactly
 * one small, curated product card, deliberately centred on the region's
 * own viewpoint coordinate (scripts/seed-products.ts's own comment: "centred
 * on supabase/seed.sql's 'shop-floor' viewpoint"). Landing with that
 * coordinate as the camera's raw top-left instead cropped roughly half of
 * that single card (and left most of the screen empty board) on arrival —
 * the same root cause as the pre-fix About/Contact bug, just milder to
 * notice because something (the card's own bottom-right quadrant) was
 * still visible rather than nothing at all.
 */
const CENTERED_REGION_KEYS = new Set(["about", "contact", "shop-wall", "shop-floor"]);

/**
 * The camera to use when flying to or setting `viewpoint` directly —
 * every call site that takes a Viewpoint off this registry and hands it
 * to the camera store (Gallery.tsx's initial mount, FilmStage's Continue
 * handoff, CanvasChrome's minimap/region-tab clicks and Home button,
 * useGuidedModeStore's next/previous/setMode) should go through this
 * rather than passing the raw viewpoint straight through, so the
 * CENTERED_REGION_KEYS exception above only has to be decided in one
 * place. A no-op (returns `viewpoint` itself) for every other region.
 */
export function cameraForViewpoint(viewpoint: Viewpoint, viewport: { width: number; height: number }): Camera {
  if (!CENTERED_REGION_KEYS.has(viewpoint.key)) return viewpoint;
  return cameraFromCenter(viewpoint, viewpoint.zoom, viewport.width, viewport.height);
}

/**
 * The true world point `viewpoint`'s camera actually centres the viewport
 * on once landed, at viewport size (vw, vh) — the counterpart "nearest
 * viewpoint to the current camera" comparisons need, instead of a raw
 * `cameraCenter(viewpoint, vw, vh)` call (which assumes the viewpoint's
 * own x/y is already a landed camera position: true for every region
 * except About/Contact). Without this, `nearestViewpoint()` and
 * `nearestGuidedIndex()` — unaware of `cameraForViewpoint()`'s own
 * CENTERED_REGION_KEYS exception above — compared the real, now-correctly-
 * centred Contact camera against the *wrong* candidate centres, so the
 * page showed the wrong "you are at" region name and switching Explore
 * → Guided flew away from Contact entirely (found in review, Greptile, PR
 * #3, on this very fix).
 *
 * For a centred region this is simply the viewpoint's own x/y (that's the
 * definition `cameraForViewpoint` computes backward from via
 * `cameraFromCenter`); for every other region it's unchanged —
 * `cameraCenter(viewpoint, vw, vh)`, exactly as before this fix.
 */
export function viewpointCenter(viewpoint: Viewpoint, vw: number, vh: number): { x: number; y: number } {
  if (CENTERED_REGION_KEYS.has(viewpoint.key)) return { x: viewpoint.x, y: viewpoint.y };
  return cameraCenter(viewpoint, vw, vh);
}
