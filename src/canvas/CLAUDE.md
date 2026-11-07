# Canvas engine rules

- `src/canvas` must never import from `src/features`. Features import from the canvas, never the reverse (see root `CLAUDE.md`). If a canvas file needs feature-specific behaviour, expose a hook/registration point here and let the feature call into it — not the other way round.
- The world transform is driven by a single `requestAnimationFrame` loop reading `useCameraStore.getState()` directly (`Board.tsx`), not by subscribing to the store and re-rendering React every frame. Any new per-frame visual state (culling, LOD) follows the same pattern — read state imperatively inside the loop, don't put it in React state that changes every frame.
- `src/canvas/viewpoints.ts`'s `getViewpoint`/`listViewpoints` are the stable call-site API; swapping the static registry for the `viewpoints` table (Phase 2) must not change their signatures.
- All camera/zoom maths lives in `math.ts` as pure functions with unit tests — never inline the zoom-about-a-point or flight-interpolation formulas elsewhere.
