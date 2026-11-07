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
      style={{
        width: "100%",
        height: "100%",
        border: "none",
        padding: 0,
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
