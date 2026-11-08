import { create } from "zustand";

import type { CollageLayoutMode } from "./lib/layout";

interface CollageViewState {
  layoutMode: CollageLayoutMode;
  /** null = every shoot. */
  activeShootId: string | null;
  setLayoutMode: (mode: CollageLayoutMode) => void;
  setActiveShootId: (id: string | null) => void;
}

/**
 * Shared between Collage.tsx (reads it to decide node positions/visibility)
 * and CollageChrome.tsx (renders the Circle/Diagonal-strips toggle and the
 * shoot-filter chips that write it) — the two can't share plain React state
 * directly since CollageChrome renders as a sibling of <Board>, not a
 * descendant (same `position: fixed` containing-block reason CanvasChrome
 * does, see Gallery.tsx's own comment / docs/decisions.md D-44).
 */
export const useCollageViewStore = create<CollageViewState>((set) => ({
  layoutMode: "circular",
  activeShootId: null,
  setLayoutMode: (layoutMode) => set({ layoutMode }),
  setActiveShootId: (activeShootId) => set({ activeShootId }),
}));
