/**
 * Parses the "photo/:id" tail of the /gallery/* splat route (App.tsx).
 * Pure, so the parsing itself doesn't need a router to test.
 */
export function photoIdFromSplat(splat: string | undefined): string | null {
  if (!splat) return null;
  const prefix = "photo/";
  return splat.startsWith(prefix) ? splat.slice(prefix.length) : null;
}
