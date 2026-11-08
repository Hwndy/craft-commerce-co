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
