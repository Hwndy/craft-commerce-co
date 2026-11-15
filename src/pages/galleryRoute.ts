/**
 * Parses the "photo/:id" tail of the /gallery/* splat route (App.tsx).
 * Pure, so the parsing itself doesn't need a router to test.
 */
export function photoIdFromSplat(splat: string | undefined): string | null {
  if (!splat) return null;
  const prefix = "photo/";
  return splat.startsWith(prefix) ? splat.slice(prefix.length) : null;
}

/**
 * Parses the "shop/:slug" tail of the /gallery/* splat route (T3) — same
 * splat, same reasoning as photoIdFromSplat's own comment: a real /shop/:slug
 * <Route> rendering a second Gallery element would remount the whole page
 * (React Router remounts on a matched-route change, even for the identical
 * element — see App.tsx's own comment), resetting the camera and this
 * page's reveal()/hide() state. App.tsx instead redirects a direct /shop/:slug
 * visit into this same splat (/gallery/shop/:slug) before Gallery ever
 * mounts, so there is only ever one route match, one Board, one <video>.
 */
export function productSlugFromSplat(splat: string | undefined): string | null {
  if (!splat) return null;
  const prefix = "shop/";
  return splat.startsWith(prefix) ? splat.slice(prefix.length) : null;
}

/**
 * Parses a splat that's a bare top-level region key — "contact" (T6,
 * docs/01-architecture.md's `/contact` → "Board focused on that region")
 * — distinct from photoIdFromSplat/productSlugFromSplat above, which
 * carry an id/slug after a fixed prefix. App.tsx redirects a direct
 * /contact visit into /gallery/contact (same one-hop pattern as
 * /shop/:slug → /gallery/shop/:slug, D-52); this is what Gallery.tsx reads
 * back out to know which viewpoint to land the camera on, instead of
 * always defaulting to "gallery".
 *
 * "about" was a second recognised key here until docs/decisions.md D-71's
 * Step 9 removed the About region outright — no longer recognised, so a
 * stale /gallery/about link (nothing redirects into it any more either)
 * falls through to the same "no specific region" default as a plain
 * /gallery visit, not a crash.
 */
export function initialViewpointKeyFromSplat(splat: string | undefined): "contact" | null {
  if (splat === "contact") return splat;
  return null;
}
