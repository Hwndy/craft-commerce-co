import { AlertCircle, CheckCircle2, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

// Found in review (CodeRabbit, PR #11, Major): with no cap, selecting many
// large photos decoded and uploaded all of them at once — each pipeline
// keeps its decoded ImageBitmap alive for the whole upload, so e.g. 40
// full-resolution camera photos could exhaust the browser's memory.
const MAX_CONCURRENT_UPLOADS = 3;

import { Button } from "@/components/ui/button";

import { ImageUploadError, uploadImageMedia, type ImageUploadStatus } from "../lib/image-pipeline";
import { uploadVideoMedia, type VideoUploadStatus } from "../lib/video-upload";

type QueuedFileStatus = ImageUploadStatus | VideoUploadStatus;

interface QueuedFile {
  file: File;
  mediaId: string;
  status: QueuedFileStatus;
  error?: string;
  completedWidths?: number[];
}

export interface MediaUploadFieldProps {
  kind: "image" | "video";
  /** e.g. `photos/<setId>` or `products/<productId>` — T5/T6 decide their own folder shape. */
  storagePrefix: string;
  altText?: string;
  onMediaReady?: (result: { mediaId: string; file: File }) => void;
}

const STATUS_LABEL: Record<QueuedFileStatus, string> = {
  pending: "Queued",
  decoding: "Reading…",
  uploading: "Uploading…",
  inserting: "Saving…",
  done: "Done",
  failed: "Failed",
};

/**
 * T3's "consistent patterns" brief (list+search, edit drawer, optimistic
 * updates, error toasts) extended to T4's own upload pipeline: domain-
 * agnostic (T5/T6 each wire this to their own real Products/Photos form
 * later, passing their own storagePrefix) — per-file progress, a retry
 * button on a failed row, and a sonner toast() on every failure (matching
 * the project-wide convention, e.g. useOptimisticMutation.ts) in addition
 * to the inline retry, not instead of it.
 */
export function MediaUploadField({ kind, storagePrefix, altText, onMediaReady }: MediaUploadFieldProps) {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef<Array<{ file: File; mediaId: string; skipWidths: number[] }>>([]);
  const activeCountRef = useRef(0);

  function updateItem(mediaId: string, patch: Partial<QueuedFile>) {
    setQueue((items) => items.map((item) => (item.mediaId === mediaId ? { ...item, ...patch } : item)));
  }

  // Keeps at most MAX_CONCURRENT_UPLOADS pipelines running; everything
  // else stays queued (shown as "Queued" via the existing "pending"
  // status) until a slot frees up.
  function pump() {
    while (activeCountRef.current < MAX_CONCURRENT_UPLOADS && pendingRef.current.length > 0) {
      const next = pendingRef.current.shift();
      if (!next) break;
      activeCountRef.current += 1;
      void runUpload(next.file, next.mediaId, next.skipWidths).finally(() => {
        activeCountRef.current -= 1;
        pump();
      });
    }
  }

  function enqueue(file: File, mediaId: string, skipWidths: number[] = []) {
    pendingRef.current.push({ file, mediaId, skipWidths });
    pump();
  }

  async function runUpload(file: File, mediaId: string, skipWidths: number[] = []) {
    updateItem(mediaId, { status: "pending", error: undefined });
    try {
      if (kind === "image") {
        await uploadImageMedia({
          file,
          storagePrefix,
          altText,
          mediaId,
          skipWidths,
          onProgress: (progress) => updateItem(mediaId, { status: progress.status }),
        });
      } else {
        await uploadVideoMedia({
          file,
          storagePrefix,
          mediaId,
          onProgress: (progress) => updateItem(mediaId, { status: progress.status }),
        });
      }
      updateItem(mediaId, { status: "done" });
      onMediaReady?.({ mediaId, file });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed.";
      const completedWidths = err instanceof ImageUploadError ? err.completedWidths : undefined;
      updateItem(mediaId, { status: "failed", error: message, completedWidths });
      toast(`Couldn't upload "${file.name}" — ${message}`);
    }
  }

  function onFilesSelected(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      const mediaId = crypto.randomUUID();
      setQueue((items) => [...items, { file, mediaId, status: "pending" }]);
      enqueue(file, mediaId);
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  function onRetry(item: QueuedFile) {
    enqueue(item.file, item.mediaId, item.completedWidths ?? []);
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={kind === "image" ? "image/*" : "video/mp4,video/webm"}
        aria-label={kind === "image" ? "Choose images to upload" : "Choose a video to upload"}
        onChange={(event) => onFilesSelected(event.target.files)}
        className="block text-sm"
      />
      {queue.length > 0 && (
        <ul className="space-y-2">
          {queue.map((item) => (
            <li
              key={item.mediaId}
              className="flex items-center justify-between gap-3 rounded-md border border-border p-2 text-sm"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <StatusIcon status={item.status} />
                <span className="truncate">{item.file.name}</span>
              </div>
              <div className="flex items-center gap-2 whitespace-nowrap text-muted-foreground">
                {item.status === "failed" ? (
                  <>
                    <span className="text-destructive">{item.error}</span>
                    <Button type="button" variant="pill-outline" size="sm" onClick={() => onRetry(item)}>
                      Retry
                    </Button>
                  </>
                ) : (
                  STATUS_LABEL[item.status]
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: QueuedFileStatus }) {
  if (status === "done") return <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />;
  if (status === "failed") return <AlertCircle className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />;
  if (status === "pending") return <Upload className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />;
  return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />;
}
