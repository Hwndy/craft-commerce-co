import type { LevelOfDetail } from "@/canvas/levelOfDetail";
import { siteMediaUrl } from "@/lib/storage";

import type { CollagePhoto } from "./lib/queries";

export interface PhotoThumbnailProps {
  photo: CollagePhoto;
  lod: LevelOfDetail;
  onOpen?: () => void;
}

/**
 * docs/00-product-brief.md FR-3.7 / phases/PHASE-2-canvas-and-collage.md T8:
 * blur placeholder at the "placeholder" tier (no network fetch — it's
 * already inlined by scripts/seed-photos.ts), 256px at "thumbnail", 640px
 * once zoomed in to "full". 1280/2048 are reserved for T9's full-screen
 * viewer, never requested here.
 */
const RENDITION_FOR_LOD: Record<LevelOfDetail, string | null> = {
  placeholder: null,
  thumbnail: "256",
  full: "640",
};

export function PhotoThumbnail({ photo, lod, onOpen }: PhotoThumbnailProps) {
  const renditionKey = RENDITION_FOR_LOD[lod];
  const renditionPath = renditionKey ? photo.media.renditions[renditionKey] : undefined;
  const src = renditionPath ? siteMediaUrl(renditionPath) : undefined;
  const label = photo.takenOn ? `${photo.title}, ${photo.takenOn}` : photo.title;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      data-photo-id={photo.id}
      // Client feedback (docs/decisions.md): hover raises the thumbnail
      // slightly, distinct from Collage.tsx's own click-triggered rise
      // (which still runs on click/tap, where there's no hover at all —
      // touch devices get that as their equivalent). motion-reduce: disables
      // it for anyone who prefers reduced motion, matching AGENTS.md rule 6.
      // ring-offset-2/ring-offset-background are scoped to focus-visible
      // only (not the base state) — Tailwind's ring-offset utility paints
      // its offset box-shadow unconditionally once applied, regardless of
      // the ring colour's own opacity, so having it outside focus-visible
      // drew a permanent near-black (--background) frame around every
      // photo at all times. Moving both to focus-visible keeps the real
      // accessibility requirement (a visible keyboard-focus ring, AGENTS.md
      // rule 6) without that frame showing up for every unfocused photo.
      className="h-full w-full border-0 p-0 outline-none ring-2 ring-transparent transition-[box-shadow,transform] duration-150 hover:-translate-y-1.5 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      style={{
        cursor: onOpen ? "pointer" : "default",
        backgroundColor: "#111",
        backgroundImage: photo.media.blurDataUrl ? `url(${photo.media.blurDataUrl})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {src && (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      )}
    </button>
  );
}
