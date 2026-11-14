import { supabase } from "@/lib/supabase";

import { decodeImage, encodeBlurPlaceholder, resizeAndEncode, RENDITION_WIDTHS } from "./image-codec";

export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

export type ImageUploadStatus = "pending" | "decoding" | "uploading" | "inserting" | "done" | "failed";

export interface ImageUploadProgress {
  status: ImageUploadStatus;
  error?: string;
}

export interface UploadImageOptions {
  file: File;
  /** Caller-supplied (e.g. `photos/<setId>` or `products/<productId>`) — T5/T6 decide their own folder shape. */
  storagePrefix: string;
  altText?: string;
  /**
   * Stable across retries of the same logical upload — generate once when
   * the file is first queued and pass the same value back in on retry.
   * Without this, a retry would mint a fresh id (and therefore fresh
   * storage paths), leaving any renditions that *did* upload on the
   * failed attempt permanently orphaned, since the media row — the only
   * thing that ever references them — is inserted only after full
   * success.
   */
  mediaId?: string;
  /**
   * Widths already uploaded successfully in a prior attempt for this
   * mediaId — retry passes these back in (from `ImageUploadError`'s own
   * `completedWidths`) so it only re-decodes/re-resizes/re-uploads what
   * actually failed. Uploading is idempotent either way (`upsert: true`,
   * same deterministic path every attempt), so this is a pure efficiency
   * gain, not a correctness requirement.
   */
  skipWidths?: readonly number[];
  onProgress?: (progress: ImageUploadProgress) => void;
}

export interface UploadImageResult {
  mediaId: string;
}

export class ImageUploadError extends Error {
  constructor(message: string, public readonly completedWidths: number[]) {
    super(message);
    this.name = "ImageUploadError";
  }
}

/**
 * Mirrors scripts/seed-photos.ts's shape exactly (same widths, WebP
 * quality, cache headers, blur placeholder, insert-only-after-all-
 * succeed) using native browser APIs in place of sharp. The rendition
 * keys ("256"/"640"/"1280"/"2048") are a contract already load-bearing in
 * merged Phase 2/3 code (PhotoThumbnail.tsx, PhotoViewer.tsx,
 * ShopRegion.tsx, ProductOverlay.tsx all read these exact string keys).
 */
export async function uploadImageMedia({
  file,
  storagePrefix,
  altText,
  mediaId = crypto.randomUUID(),
  skipWidths = [],
  onProgress,
}: UploadImageOptions): Promise<UploadImageResult> {
  const report = (status: ImageUploadStatus, error?: string) => onProgress?.({ status, error });

  if (file.size > MAX_IMAGE_BYTES) {
    const message = `"${file.name}" is larger than 25 MB.`;
    report("failed", message);
    throw new ImageUploadError(message, []);
  }

  const prefix = `${storagePrefix}/${mediaId}`;
  const renditions: Record<string, string> = {};
  const completed: number[] = [];
  let bitmap: ImageBitmap;

  try {
    report("decoding");
    bitmap = await decodeImage(file);
  } catch (err) {
    const message = describeError(err, "Couldn't read this image.");
    report("failed", message);
    throw new ImageUploadError(message, []);
  }

  try {
    report("uploading");
    for (const width of RENDITION_WIDTHS) {
      const path = `${prefix}/${width}.webp`;
      if (!skipWidths.includes(width)) {
        const blob = await resizeAndEncode(bitmap, width);
        await uploadToSiteMedia(path, blob, "image/webp");
      }
      renditions[String(width)] = path;
      completed.push(width);
    }

    const blurDataUrl = await encodeBlurPlaceholder(bitmap);

    report("inserting");
    const { error } = await supabase.from("media").upsert({
      id: mediaId,
      kind: "image",
      storage_path: prefix,
      width: bitmap.width,
      height: bitmap.height,
      alt_text: altText ?? null,
      blur_data_url: blurDataUrl,
      renditions,
      status: "ready",
    });
    if (error) throw error;

    report("done");
    return { mediaId };
  } catch (err) {
    const message = describeError(err, "Couldn't upload this image.");
    report("failed", message);
    throw new ImageUploadError(message, completed);
  }
}

async function uploadToSiteMedia(path: string, blob: Blob, contentType: string): Promise<void> {
  const { error } = await supabase.storage.from("site-media").upload(path, blob, {
    contentType,
    cacheControl: "public, max-age=31536000, immutable",
    upsert: true,
  });
  if (error) throw error;
}

function describeError(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}
