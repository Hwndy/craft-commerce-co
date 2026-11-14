import { useEffect } from "react";

/**
 * Every /admin/* route needs this (T2) — no SEO/meta tooling exists in
 * this app yet (docs/01-architecture.md §6 defers that mechanism to
 * Phase 5), so this is a deliberately minimal, dependency-free tag
 * insert/remove rather than pulling in a head-management library for one
 * meta tag.
 */
export function NoIndex() {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  return null;
}
