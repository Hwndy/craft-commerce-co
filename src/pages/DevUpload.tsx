import { MediaUploadField } from "@/features/admin/components/MediaUploadField";

/**
 * Dev-only route (not linked from the app, same `import.meta.env.DEV`
 * guard as DevCanvas.tsx/DevFilm.tsx) for manually sanity-checking T4's
 * upload pipeline + component with `npm run dev`, before T5/T6 have a
 * real Products/Photos form to embed MediaUploadField in.
 *
 * NOT reachable by the Playwright suite: `import.meta.env.DEV` is a
 * build-time constant, `false` in the production build CI's
 * `npm run preview` actually serves — confirmed directly (not assumed)
 * by rendering this exact route against a real local `vite preview` via
 * Playwright and seeing NotFound, the same way every visitor to this URL
 * in production would. A dev-route-based e2e harness was the original
 * plan for T4's own "e2e test uploading a fixture image" checklist line;
 * this finding is why that line is deferred to T5/T6 instead (see
 * docs/decisions.md and the PHASE-4 checklist's own note).
 */
export default function DevUpload() {
  return (
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>Upload pipeline (dev)</h1>
      <MediaUploadField kind="image" storagePrefix="dev-test/images" />
    </div>
  );
}
