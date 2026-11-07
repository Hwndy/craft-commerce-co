import { useEffect, useRef, useState, type ReactNode } from "react";

import { cullNodes, DEFAULT_CULL_MARGIN_FRACTION } from "./culling";
import { levelOfDetailForNode, type LevelOfDetail } from "./levelOfDetail";
import { useCameraStore } from "./store";
import type { CanvasNode } from "./types";

export interface NodeLayerProps<T extends CanvasNode> {
  nodes: T[];
  renderNode: (node: T, lod: LevelOfDetail) => ReactNode;
  marginFraction?: number;
  /** docs/02-canvas-spec.md §10: "recompute... throttled, during motion." */
  throttleMs?: number;
}

const DEFAULT_THROTTLE_MS = 150;

function computeVisibleNodes<T extends CanvasNode>(nodes: T[], marginFraction: number): T[] {
  const { camera, viewport } = useCameraStore.getState();
  if (viewport.width === 0 && viewport.height === 0) return nodes;
  return cullNodes(nodes, camera, viewport.width, viewport.height, marginFraction);
}

/**
 * Mounts only the nodes near the viewport (docs/02-canvas-spec.md §2, §10),
 * at the level of detail their on-screen width calls for (§5). Recomputes
 * on camera change, throttled — not via the React hook subscription Board's
 * own rAF loop deliberately avoids (that would re-render every frame during
 * a flight or drag), but via a manual, time-gated store subscription.
 */
export function NodeLayer<T extends CanvasNode>({
  nodes,
  renderNode,
  marginFraction = DEFAULT_CULL_MARGIN_FRACTION,
  throttleMs = DEFAULT_THROTTLE_MS,
}: NodeLayerProps<T>) {
  const [visible, setVisible] = useState<T[]>(() => computeVisibleNodes(nodes, marginFraction));
  const lastRunRef = useRef(0);
  const pendingFrameRef = useRef<number | null>(null);

  useEffect(() => {
    function recompute() {
      lastRunRef.current = Date.now();
      setVisible(computeVisibleNodes(nodes, marginFraction));
    }

    function scheduleRecompute() {
      const now = Date.now();
      const elapsed = now - lastRunRef.current;
      if (elapsed >= throttleMs) {
        recompute();
        return;
      }
      if (pendingFrameRef.current != null) return;
      pendingFrameRef.current = window.setTimeout(() => {
        pendingFrameRef.current = null;
        recompute();
      }, throttleMs - elapsed);
    }

    recompute();
    const unsubscribe = useCameraStore.subscribe(scheduleRecompute);
    return () => {
      unsubscribe();
      if (pendingFrameRef.current != null) window.clearTimeout(pendingFrameRef.current);
    };
  }, [nodes, marginFraction, throttleMs]);

  return (
    <div data-node-layer-count={visible.length}>
      {visible.map((node) => {
        const { camera } = useCameraStore.getState();
        return <div key={node.id}>{renderNode(node, levelOfDetailForNode(node.width, camera.zoom))}</div>;
      })}
    </div>
  );
}
