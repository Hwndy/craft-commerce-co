import { useEffect, useState } from "react";

const POLL_MS = 250;

interface DebugStats {
  frameTimeMs: number | null;
  zoom: number | null;
  mountedNodeCount: number | null;
}

function readStats(): DebugStats {
  const viewport = document.querySelector("[data-camera-zoom]");
  const nodeLayer = document.querySelector("[data-node-layer-count]");
  return {
    frameTimeMs: viewport ? Number(viewport.getAttribute("data-frame-time-ms")) || null : null,
    zoom: viewport ? Number(viewport.getAttribute("data-camera-zoom")) : null,
    mountedNodeCount: nodeLayer ? Number(nodeLayer.getAttribute("data-node-layer-count")) : null,
  };
}

/**
 * Frame time, mounted node count and zoom — docs/02-canvas-spec.md §3's
 * "a dev overlay (toggle with a query flag)". Polls the DOM attributes
 * Board.tsx/NodeLayer.tsx already write rather than subscribing to the
 * camera store directly, so this never adds its own per-frame React
 * update to the render path.
 */
export function DebugOverlay() {
  const [stats, setStats] = useState<DebugStats>(() => readStats());

  useEffect(() => {
    const interval = window.setInterval(() => setStats(readStats()), POLL_MS);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        bottom: 12,
        right: 12,
        zIndex: 100,
        background: "rgba(0,0,0,0.75)",
        color: "#0f0",
        fontFamily: "monospace",
        fontSize: 11,
        padding: "6px 10px",
        borderRadius: 6,
        pointerEvents: "none",
        lineHeight: 1.6,
      }}
    >
      <div>frame: {stats.frameTimeMs != null ? `${stats.frameTimeMs.toFixed(1)}ms` : "—"}</div>
      <div>zoom: {stats.zoom != null ? stats.zoom.toFixed(2) : "—"}</div>
      <div>nodes: {stats.mountedNodeCount ?? "—"}</div>
    </div>
  );
}

/** docs/02-canvas-spec.md §3: toggled with a query flag, e.g. ?debug=1. */
export function isDebugOverlayEnabled(search: string = window.location.search): boolean {
  return new URLSearchParams(search).get("debug") === "1";
}
