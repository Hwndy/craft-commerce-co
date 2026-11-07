import { useMemo } from "react";

import { NodeLayer } from "@/canvas/NodeLayer";
import { Region } from "@/canvas/Region";
import type { CanvasNode, Rect } from "@/canvas/types";

import { collageBoundingBox, layoutCollage, type CollageLayoutMode } from "./lib/layout";
import type { CollagePhoto } from "./lib/queries";
import { useCollagePhotos } from "./lib/useCollagePhotos";
import { PhotoThumbnail } from "./PhotoThumbnail";

export interface CollageNode extends CanvasNode {
  photo: CollagePhoto;
}

export interface CollageProps {
  centerX: number;
  centerY: number;
  mode?: CollageLayoutMode;
  onOpenPhoto?: (id: string) => void;
}

const EMPTY_REGION_SIZE = 800;
const REGION_PADDING = 200;

/**
 * The Gallery's circular photo collage (docs/00-product-brief.md FR-3.1,
 * FR-3.2, FR-3.7). Lays out whatever published photos exist via
 * lib/layout.ts's phyllotaxis spiral, builds one CanvasNode per photo, and
 * renders them through T3's NodeLayer so culling and level-of-detail are
 * free. DOM nodes, not PixiJS — see docs/decisions.md for why (placeholder
 * photo counts are far under the spec's ~300-image/50fps threshold).
 */
export function Collage({ centerX, centerY, mode, onOpenPhoto }: CollageProps) {
  const { data: photos } = useCollagePhotos();

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
      { centerX, centerY, mode }
    );
    const layoutById = new Map(layouts.map((layout) => [layout.id, layout]));

    const nodes: CollageNode[] = photos.map((photo) => {
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
  }, [photos, centerX, centerY, mode]);

  return (
    <Region id="collage" title="Collage" x={rect.x} y={rect.y} width={rect.width} height={rect.height}>
      <NodeLayer
        nodes={nodes}
        renderNode={(node, lod) => (
          <div
            style={{
              position: "absolute",
              left: node.x - rect.x,
              top: node.y - rect.y,
              width: node.width,
              height: node.height,
              transform: `rotate(${node.rotation}deg)`,
            }}
          >
            <PhotoThumbnail photo={node.photo} lod={lod} onOpen={onOpenPhoto ? () => onOpenPhoto(node.photo.id) : undefined} />
          </div>
        )}
      />
    </Region>
  );
}
