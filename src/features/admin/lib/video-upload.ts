import { supabase } from "@/lib/supabase";

export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export type VideoUploadStatus = "pending" | "uploading" | "inserting" | "done" | "failed";

export interface VideoUploadProgress {
  status: VideoUploadStatus;
  error?: string;
}

export interface UploadVideoOptions {
  file: File;
  /** Caller-supplied (e.g. `products/<productId>`) — T5 decides its own folder shape later. */
  storagePrefix: string;
  /** Stable across retries — same reasoning as image-pipeline.ts's own `mediaId` option. */
  mediaId?: string;
  onProgress?: (progress: VideoUploadProgress) => void;
}

export interface UploadVideoResult {
  mediaId: string;
}

export class VideoUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VideoUploadError";
  }
}

const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);

/**
 * Direct upload, no transcoding — AGENTS.md's "no automatic film
 * transcoding in the admin" extends to product videos too (building a
 * client-side HLS encoder would need a new, heavy dependency not on the
 * approved list), and docs/decisions.md D-06 already says product videos
 * are short MP4 loops, not HLS. ProductOverlay.tsx's own playback side was
 * fixed to match (Phase 4 T4, found while building this pipeline): it
 * plays `media.storage_path` directly via a plain `<video src>` once
 * there's no `hls_master`, instead of only ever trying HLS.
 */
export async function uploadVideoMedia({
  file,
  storagePrefix,
  mediaId = crypto.randomUUID(),
  onProgress,
}: UploadVideoOptions): Promise<UploadVideoResult> {
  const report = (status: VideoUploadStatus, error?: string) => onProgress?.({ status, error });

  if (file.size > MAX_VIDEO_BYTES) {
    const message = `"${file.name}" is larger than 100 MB.`;
    report("failed", message);
    throw new VideoUploadError(message);
  }
  if (!ALLOWED_VIDEO_TYPES.has(file.type)) {
    const message = `"${file.name}" must be an MP4 or WebM video.`;
    report("failed", message);
    throw new VideoUploadError(message);
  }

  const extension = file.type === "video/webm" ? "webm" : "mp4";
  const path = `${storagePrefix}/${mediaId}/video.${extension}`;

  try {
    report("uploading");
    const { error: uploadError } = await supabase.storage.from("site-media").upload(path, file, {
      contentType: file.type,
      cacheControl: "public, max-age=31536000, immutable",
      upsert: true,
    });
    if (uploadError) throw uploadError;

    report("inserting");
    const { error: insertError } = await supabase.from("media").upsert({
      id: mediaId,
      kind: "video",
      storage_path: path,
      status: "ready",
    });
    if (insertError) throw insertError;

    report("done");
    return { mediaId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't upload this video.";
    report("failed", message);
    throw new VideoUploadError(message);
  }
}

/**
 * Captures the <video> element's current frame as a File, for the admin
 * to then upload via uploadImageMedia() as a completely ordinary image.
 * Deliberately produces that rather than a new, separate poster
 * mechanism: ProductOverlay.tsx/ShopRegion.tsx both already read a
 * product's poster from `product.poster.renditions[...]` — a regular
 * multi-rendition media row via `products.poster_media_id` — not any
 * video-specific poster field. Seeking to the admin's chosen timestamp
 * (and waiting for the `seeked` event) is the caller's job, before
 * calling this; it only ever reads whatever frame is current.
 */
export async function captureVideoFrame(video: HTMLVideoElement, fileName = "poster.png"): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get a 2D canvas context.");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Could not capture this frame."))),
      "image/png"
    );
  });
  return new File([blob], fileName, { type: "image/png" });
}
