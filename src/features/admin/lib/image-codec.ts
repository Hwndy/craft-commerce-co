/**
 * The actual browser-API-touching step of the upload pipeline — kept
 * separate from image-pipeline.ts specifically so its unit tests can
 * `vi.mock` this module wholesale (this codebase's established
 * convention, e.g. AdminGuard.test.tsx mocking ./lib/auth/./lib/mfa
 * whole-module) rather than mocking one export inside a bigger module.
 * jsdom has none of createImageBitmap/canvas/real image decoding, so
 * this file only ever runs for real in an actual browser (the e2e spec,
 * and real CI).
 */

export const RENDITION_WIDTHS = [256, 640, 1280, 2048] as const;

const RENDITION_QUALITY = 0.82;
const BLUR_WIDTH = 16;
const BLUR_QUALITY = 0.4;

/** EXIF-correct decode — `imageOrientation: "from-image"` is why the brief names this exact API. */
export async function decodeImage(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: "from-image" });
}

/**
 * Resizes to `targetWidth` (never upscaling past the source's own width —
 * scripts/seed-photos.ts's `withoutEnlargement` equivalent) and encodes as
 * WebP at the renditions' shared quality.
 */
export async function resizeAndEncode(bitmap: ImageBitmap, targetWidth: number): Promise<Blob> {
  const canvas = drawResized(bitmap, targetWidth);
  return encodeWebp(canvas, RENDITION_QUALITY);
}

/**
 * The placeholder, matching scripts/seed-photos.ts's intent (a tiny,
 * heavily-degraded swatch inlined as a data URL, no network round-trip
 * before the real thumbnail loads) rather than its exact pixel algorithm:
 * resizing all the way down to 16px already discards essentially every
 * real detail, so this skips an explicit blur filter (canvas 2D context's
 * `filter` property has patchy cross-browser support) rather than take on
 * that risk for a visually negligible difference at this size.
 */
export async function encodeBlurPlaceholder(bitmap: ImageBitmap): Promise<string> {
  const canvas = drawResized(bitmap, BLUR_WIDTH);
  const blob = await encodeWebp(canvas, BLUR_QUALITY);
  return blobToDataUrl(blob);
}

function drawResized(bitmap: ImageBitmap, targetWidth: number): HTMLCanvasElement {
  const width = Math.min(targetWidth, bitmap.width);
  const height = Math.max(1, Math.round((bitmap.height / bitmap.width) * width));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get a 2D canvas context.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  return canvas;
}

function encodeWebp(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas WebP encoding failed."))),
      "image/webp",
      quality
    );
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the blob."));
    reader.readAsDataURL(blob);
  });
}
