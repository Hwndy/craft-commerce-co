import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  fullyParallel: true,
  reporter: "list",
  // CI runners share CPU across all 4 projects running in parallel, which
  // occasionally starves the camera store's rAF loop or a keyboard/pointer
  // event round-trip for longer than even the gesture specs' already-
  // generous timeouts (see e2e/canvas-gestures.spec.ts) — never reproduced
  // locally outside a full-suite run under load. `trace: "on-first-retry"`
  // below only does anything with retries actually enabled.
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
    // Collage's circular mode spins every photo continuously (index.css's
    // collage-spin, docs/decisions.md D-62) — Playwright's click
    // actionability check requires an element's bounding box to stop
    // changing, which a perpetually-rotating element never does, so every
    // photo-viewer.spec.ts click on a collage thumbnail timed out (found via
    // real CI on PR #5). Defaulting the whole suite to reduced motion
    // disables that animation the same way a real reduced-motion visitor's
    // browser would, which is what every spec here already implicitly
    // assumes (none asserts the animation itself); a spec that needs the
    // opposite can still call page.emulateMedia({ reducedMotion: "no-preference" }).
    reducedMotion: "reduce",
  },
  webServer: {
    command: "npm run preview -- --port 4173 --host 127.0.0.1",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 13"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
  ],
});
