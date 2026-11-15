import { create } from "zustand";

interface CollageViewState {
  /** null = every shoot. */
  activeShootId: string | null;
  setActiveShootId: (id: string | null) => void;
}

/**
 * Shared between Collage.tsx (reads it to decide node visibility) and
 * CollageChrome.tsx (renders the shoot-filter chips that write it) — the
 * two can't share plain React state directly since CollageChrome renders
 * as a sibling of <Board>, not a descendant (same `position: fixed`
 * containing-block reason CanvasChrome does, see Gallery.tsx's own comment
 * / docs/decisions.md D-44).
 *
 * Used to also hold a `layoutMode` (Circle vs Diagonal strips) — removed
 * per the client's own feedback (docs/decisions.md D-71): the collage is
 * diagonal strips only now, so there's no longer a choice to store.
 * lib/layout.ts's `phyllotaxisLayout`/`"circular"` mode is left in place,
 * just unused by this app — a tested, working algorithm, not dead weight
 * worth deleting outright for a request that was about removing a toggle,
 * not the underlying code.
 */
export const useCollageViewStore = create<CollageViewState>((set) => ({
  activeShootId: null,
  setActiveShootId: (activeShootId) => set({ activeShootId }),
}));
