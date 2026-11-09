import { useMemo, useState } from "react";

import { NodeLayer } from "@/canvas/NodeLayer";
import { Region } from "@/canvas/Region";
import type { CanvasNode, Rect } from "@/canvas/types";

import { useCollageViewStore } from "./collageViewStore";
import { collageBoundingBox, layoutCollage } from "./lib/layout";
import type { CollagePhoto } from "./lib/queries";
import { useCollagePhotos } from "./lib/useCollagePhotos";
import { PhotoThumbnail } from "./PhotoThumbnail";

export interface CollageNode extends CanvasNode {
  photo: CollagePhoto;
}

export interface CollageProps {
  centerX: number;
  centerY: number;
  onOpenPhoto?: (id: string) => void;
}

const EMPTY_REGION_SIZE = 800;
const REGION_PADDING = 200;

// The owner's own "strips" sketch (docs/decisions.md D-62): clicking a
// photo should visibly rise up out of its stack before the full-screen
// viewer opens, not just jump straight there. Kept short and only in
// "strips" mode — "circular" mode's photos aren't stacked, so there's
// nothing to rise out of. AGENTS.md rule 6: reduced motion is a
// requirement, so a visitor who prefers it skips straight to opening.
export const RISE_DURATION_MS = 180;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
}

/**
 * The Gallery's circular photo collage (docs/00-product-brief.md FR-3.1,
 * FR-3.2, FR-3.7). Lays out whatever published photos exist via
 * lib/layout.ts's phyllotaxis spiral, builds one CanvasNode per photo, and
 * renders them through T3's NodeLayer so culling and level-of-detail are
 * free. DOM nodes, not PixiJS — see docs/decisions.md for why (placeholder
 * photo counts are far under the spec's ~300-image/50fps threshold).
 *
 * Layout positions are always computed from *every* published photo, never
 * just the shoot-filtered subset (docs/decisions.md D-45) — so switching
 * the active shoot only shows/hides nodes, it never reflows the ones that
 * stay visible, and the Region's own world bounds (and therefore the
 * minimap/camera limits) don't change as the filter changes either.
 */
export function Collage({ centerX, centerY, onOpenPhoto }: CollageProps) {
  const { data: photos } = useCollagePhotos();
  const layoutMode = useCollageViewStore((s) => s.layoutMode);
  const activeShootId = useCollageViewStore((s) => s.activeShootId);
  const [risingId, setRisingId] = useState<string | null>(null);

  function handleOpen(id: string) {
    if (!onOpenPhoto) return;
    if (layoutMode !== "strips" || prefersReducedMotion()) {
      onOpenPhoto(id);
      return;
    }
    setRisingId(id);
    window.setTimeout(() => {
      setRisingId(null);
      onOpenPhoto(id);
    }, RISE_DURATION_MS);
  }

  const { nodes, rect } = useMemo(() => {
    const emptyRect: Rect = {
      x: centerX - EMPTY_REGION_SIZE / 2,
      y: centerY - EMPTY_REGION_SIZE / 2,
      width: EMPTY_REGION_SIZE,
      height: EMPTY_REGION_SIZE,
    };
    if (!photos || photos.length === 0) {
      return { nodes: [] as CollageNode[], rect: emptyRect };
    }

    const layouts = layoutCollage(
      photos.map((photo) => ({
        id: photo.id,
        aspectRatio: photo.media.width && photo.media.height ? photo.media.width / photo.media.height : 1,
      })),
      { centerX, centerY, mode: layoutMode }
    );
    const layoutById = new Map(layouts.map((layout) => [layout.id, layout]));

    const nodes: CollageNode[] = photos
      .filter((photo) => activeShootId == null || photo.shoot.id === activeShootId)
      .map((photo) => {
        const layout = layoutById.get(photo.id)!;
        return {
          id: photo.id,
          region: "collage",
          type: "image",
          x: layout.x,
          y: layout.y,
          width: layout.width,
          height: layout.height,
          rotation: layout.rotation,
          layer: 0,
          zoomMin: 0,
          zoomMax: Number.POSITIVE_INFINITY,
          photo,
        };
      });

    const bbox = collageBoundingBox(layouts);
    const rect: Rect = {
      x: bbox.x - REGION_PADDING,
      y: bbox.y - REGION_PADDING,
      width: bbox.width + REGION_PADDING * 2,
      height: bbox.height + REGION_PADDING * 2,
    };
    return { nodes, rect };
  }, [photos, centerX, centerY, layoutMode, activeShootId]);

  return (
    <Region id="collage" title="Collage" x={rect.x} y={rect.y} width={rect.width} height={rect.height}>
      <NodeLayer
        nodes={nodes}
        renderNode={(node, lod) => {
          const isRising = node.id === risingId;
          // "collage-spin" (index.css) owns `transform` continuously in
          // circular mode (the owner's "pictures... spinning" flair) — the
          // rise transition below is strips-mode-only, so the two never
          // actually fight over the same element, but skipping the
          // transition declaration here too avoids any transform/animation
          // interaction quirks while the spin keyframe is running.
          const isCircular = layoutMode === "circular";
          return (
            <div
              className={isCircular ? "collage-spin" : undefined}
              style={{
                position: "absolute",
                left: node.x - rect.x,
                top: node.y - rect.y,
                width: node.width,
                height: node.height,
                transform: isRising
                  ? `rotate(${node.rotation}deg) translateY(-28px) scale(1.08)`
                  : `rotate(${node.rotation}deg)`,
                transition: isCircular ? undefined : `transform ${RISE_DURATION_MS}ms ease-out`,
                zIndex: isRising ? 10 : undefined,
              }}
            >
              <PhotoThumbnail photo={node.photo} lod={lod} onOpen={onOpenPhoto ? () => handleOpen(node.photo.id) : undefined} />
            </div>
          );
        }}
      />
    </Region>
  );
}
