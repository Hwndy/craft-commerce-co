# Spatial canvas engine specification

## 1. Concepts

- **World**: an unbounded 2D plane in world units (1 unit = 1 CSS px at zoom 1).
- **Camera**: `{ x, y, zoom }` where `x, y` is the world coordinate shown at the top-left of the viewport.
- **Viewpoint**: a named camera (`landing`, `gallery`, `collage`, `shop`, `about`, `contact`, plus per-photo and per-product viewpoints). Stored in the `viewpoints` table and used by routes, guided mode and the minimap.
- **Region**: a rectangle in the world with a title and a set of nodes.
- **Node**: a positioned piece of content.

```ts
export type Camera = { x: number; y: number; zoom: number };
export type Viewpoint = Camera & { key: string; label: string; sortOrder: number };
export type NodeType = 'image' | 'video' | 'text' | 'product' | 'button' | 'link' | 'region-label';
export interface CanvasNode {
  id: string; region: string; type: NodeType;
  x: number; y: number; width: number; height: number; rotation: number; layer: number;
  zoomMin: number; zoomMax: number;
  ref?: { table: string; id: string };
}
```

## 2. Maths (all pure functions in `src/canvas/math.ts`, with unit tests)

- Screen to world: `wx = cam.x + sx / cam.zoom`, `wy = cam.y + sy / cam.zoom`.
- World to screen: `sx = (wx - cam.x) * cam.zoom`.
- **Zoom about a screen point** `(sx, sy)` to `z2` (clamped to limits): `before = screenToWorld(sx, sy)`, then `cam.x = before.x - sx / z2`, `cam.y = before.y - sy / z2`, `cam.zoom = z2`.
- **Fit a world rectangle** `r` into a viewport `(vw, vh)` with padding factor `p` (for example 0.9): `zoom = min(vw / r.w, vh / r.h) * p`, `x = r.cx - vw / (2 * zoom)`, `y = r.cy - vh / (2 * zoom)`.
- **Visible world rectangle**: `[cam.x, cam.y, vw / zoom, vh / zoom]`. Culling mounts nodes whose rectangles intersect the visible rectangle expanded by a margin (for example 25% each side).
- **Flight interpolation** between cameras `a` and `b` for `t` in 0..1 (eased): interpolate `log(zoom)` linearly and interpolate the **centre** of the viewport in world space with an ease-in-out curve, then convert back to `x, y`. This keeps the motion feeling like a camera rather than a slide. Duration scales with distance (for example 900 to 2200 ms).
- Zoom limits: about 0.15 to 6 (tune per device). Pan limits: keep at least one region on screen.

## 3. Rendering

- A viewport element (`position: fixed; inset: 0; height: 100dvh; overflow: hidden; touch-action: none`) contains a world element with `transform: translate3d(-x*zoom px, -y*zoom px, 0) scale(zoom)` and `transform-origin: 0 0`. Nodes are absolutely positioned in world units.
- Update the transform from a single `requestAnimationFrame` loop that reads the camera store, not through React state on every frame.
- Text stays crisp at high zoom by re-rendering at the final scale when the camera settles (swap `scale` for font-size and size values if blurriness appears, record the choice).

## 4. Input

- Library: `@use-gesture/react` for drag, pinch and wheel (non-passive listeners).
- Mouse: drag to pan, wheel to zoom about the pointer, double-click to zoom in on a node or region.
- Touch: one finger pans, two fingers pinch (zoom about the midpoint). Add inertia from the drag velocity with exponential decay.
- Keyboard: arrows pan, `+` and `-` zoom, `0` returns to the home viewpoint, Tab moves focus between nodes (focus brings the node into view), Enter enters a region or opens a node, Esc zooms out one level.
- Trackpad pinch arrives as `wheel` with `ctrlKey`; treat it as zoom and prevent browser zoom on the board only.
- Safari: call `preventDefault` on `gesturestart`, `gesturechange` and `gestureend` for the board element.
- Edge-swipe and pull-to-refresh: `overscroll-behavior: none` on `html` and `body` while the board is mounted.

## 5. Semantic zoom and entering regions

- Each node has `zoomMin` and `zoomMax`. Below `zoomMin` it renders nothing; its **level of detail** is chosen by on-screen width (`width * zoom`): under 80 px placeholder, under 400 px thumbnail, otherwise full.
- A region **enters** when its on-screen area covers 70% of the viewport and the camera has been stable for 250 ms. Entering mounts the region's full-screen mode (film layer, photo viewer, product overlay) and updates the URL. Leaving restores the previous camera.

## 6. Guided mode

- Ordered list of viewpoints marked `in_guided_path`. Next and Previous fly between them. A progress indicator shows position in the path. Switching to Explore keeps the camera where it is; switching back flies to the nearest path viewpoint.
- First-time visitors start in Guided mode; the choice is remembered in `localStorage`.

## 7. URL and camera sync

- Route to viewpoint: on route change, fly to that route's viewpoint (instant when reduced motion or on first load).
- Camera to route: when the camera settles for 600 ms inside a region, `replace` the URL with that region's route. Do not push a history entry for every pan; push only on entering a region, a photo or a product.
- Back and forward replay viewpoints.

## 8. Minimap and orientation

A small overview in a corner shows regions as rectangles and the visible area as an outline; tapping it flies the camera. Always show the current region title and a "Home" control.

## 9. Accessibility

- Nodes are focusable DOM elements in reading order; a visible focus ring; focus moves the camera.
- `/list` renders every region's content as semantic HTML with headings and links. A "List view" button is always visible.
- `prefers-reduced-motion`: flights become instant, inertia is off, parallax is off.
- Live region announces region changes ("Entering Shop").

## 10. Performance

- Culling index: a uniform grid (cell size about 1000 world units). Recompute visible cells on camera settle and, throttled, during motion.
- Videos not in view pause and release their source. Images use blur placeholders and `decoding="async"`.
- Collage: DOM nodes are fine up to about 300 images. Above that, or if panning drops below 50 fps on the test device, move the collage thumbnails to a PixiJS layer (instanced sprites from a texture atlas) while keeping the full-screen viewer in the DOM. Record the decision.
- Target: 60 fps panning on a 2021 mid-range Android phone and iPhone 12 or newer.
