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

// jsdom has no ResizeObserver either — shadcn's InputOTP (Phase 4 admin
// MFA screens: AdminLogin's challenge step, AdminMfaSetup's enrollment)
// observes its container to track focus/caret position, which nothing
// under test asserts on; a no-op is enough to let it mount at all.
if (typeof ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// jsdom implements neither of these either — ProductForm.tsx (Phase 4 T5)
// uses a local blob: URL to preview an uploaded video file before
// capturing a poster frame from it. Nothing under test asserts on a real
// blob URL's contents, only on the component's own state once one exists.
if (typeof URL.createObjectURL !== "function") {
  URL.createObjectURL = () => "blob:mock-url";
}
if (typeof URL.revokeObjectURL !== "function") {
  URL.revokeObjectURL = () => {};
}
