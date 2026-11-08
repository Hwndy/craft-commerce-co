import "@testing-library/jest-dom";

// jsdom implements neither of these (same reason src/canvas/Board.tsx
// guards `typeof ResizeObserver === "undefined"` before using it) — Radix
// UI's Select (T6, EnquiryForm's "About a product" picker) calls both while
// opening/scrolling its listbox, and throws "is not a function" without
// them. Harmless no-ops: nothing under test asserts on real scroll
// position or pointer capture state, only on what the open/selected item
// ends up being.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
