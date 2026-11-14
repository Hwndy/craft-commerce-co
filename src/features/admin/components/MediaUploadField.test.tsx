import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { uploadImageMediaMock } = vi.hoisted(() => ({ uploadImageMediaMock: vi.fn() }));
vi.mock("../lib/image-pipeline", async () => {
  const actual = await vi.importActual<typeof import("../lib/image-pipeline")>("../lib/image-pipeline");
  return { ...actual, uploadImageMedia: uploadImageMediaMock };
});

const { uploadVideoMediaMock } = vi.hoisted(() => ({ uploadVideoMediaMock: vi.fn() }));
vi.mock("../lib/video-upload", async () => {
  const actual = await vi.importActual<typeof import("../lib/video-upload")>("../lib/video-upload");
  return { ...actual, uploadVideoMedia: uploadVideoMediaMock };
});

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

import { ImageUploadError } from "../lib/image-pipeline";
import { MediaUploadField } from "./MediaUploadField";

function selectFile(name = "belt.jpg", type = "image/jpeg") {
  const input = screen.getByLabelText("Choose images to upload") as HTMLInputElement;
  const file = new File(["data"], name, { type });
  fireEvent.change(input, { target: { files: [file] } });
  return file;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("MediaUploadField", () => {
  it("shows a row with a pending/uploading status and then Done once the upload resolves", async () => {
    let resolveUpload: (value: { mediaId: string }) => void = () => {};
    uploadImageMediaMock.mockImplementation(
      ({ onProgress }: { onProgress?: (p: { status: string }) => void }) =>
        new Promise((resolve) => {
          onProgress?.({ status: "uploading" });
          resolveUpload = () => resolve({ mediaId: "media-1" });
        })
    );

    render(<MediaUploadField kind="image" storagePrefix="photos/set-1" />);
    selectFile();

    await waitFor(() => expect(screen.getByText("belt.jpg")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("Uploading…")).toBeInTheDocument());

    resolveUpload({ mediaId: "media-1" });
    await waitFor(() => expect(screen.getByText("Done")).toBeInTheDocument());
  });

  it("calls onMediaReady with the resulting mediaId and file once an upload succeeds", async () => {
    uploadImageMediaMock.mockResolvedValue({ mediaId: "media-1" });
    const onMediaReady = vi.fn();

    render(<MediaUploadField kind="image" storagePrefix="photos/set-1" onMediaReady={onMediaReady} />);
    const file = selectFile();

    await waitFor(() =>
      expect(onMediaReady).toHaveBeenCalledWith({ mediaId: expect.any(String), file })
    );
  });

  it("shows the error and a Retry button on a failed row, and toasts the failure", async () => {
    uploadImageMediaMock.mockRejectedValueOnce(new ImageUploadError("Couldn't upload this image.", [256, 640]));

    render(<MediaUploadField kind="image" storagePrefix="photos/set-1" />);
    selectFile();

    await waitFor(() => expect(screen.getByText("Couldn't upload this image.")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(toastMock).toHaveBeenCalledWith(expect.stringContaining("Couldn't upload this image."));
  });

  // Found in review (CodeRabbit, PR #11): nothing previously marked a
  // retried row "Queued" until pump() actually got to it, so its Retry
  // button stayed visible and clickable in the meantime — two clicks
  // landing before the row re-rendered as "Queued" could enqueue the
  // same mediaId twice, and pump() would then run two concurrent
  // uploadImageMedia() calls for it once slots freed up.
  it("ignores a second Retry click for the same row before it's re-rendered as Queued", async () => {
    uploadImageMediaMock.mockRejectedValueOnce(new ImageUploadError("network error", []));
    let resolveRetry: (value: { mediaId: string }) => void = () => {};
    uploadImageMediaMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRetry = () => resolve({ mediaId: "media-1" });
        })
    );

    render(<MediaUploadField kind="image" storagePrefix="photos/set-1" />);
    selectFile();
    await waitFor(() => expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument());

    const retryButton = screen.getByRole("button", { name: "Retry" });
    fireEvent.click(retryButton);
    fireEvent.click(retryButton);

    expect(uploadImageMediaMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Queued")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();

    resolveRetry({ mediaId: "media-1" });
    await waitFor(() => expect(screen.getByText("Done")).toBeInTheDocument());
    expect(uploadImageMediaMock).toHaveBeenCalledTimes(2);
  });

  it("retrying calls the pipeline again with the same mediaId and the previously-completed widths to skip", async () => {
    uploadImageMediaMock.mockRejectedValueOnce(new ImageUploadError("network error", [256, 640]));
    uploadImageMediaMock.mockResolvedValueOnce({ mediaId: "media-1" });

    render(<MediaUploadField kind="image" storagePrefix="photos/set-1" />);
    selectFile();

    await waitFor(() => expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument());
    const firstCallArgs = uploadImageMediaMock.mock.calls[0][0];

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(uploadImageMediaMock).toHaveBeenCalledTimes(2));
    const secondCallArgs = uploadImageMediaMock.mock.calls[1][0];
    expect(secondCallArgs.mediaId).toBe(firstCallArgs.mediaId);
    expect(secondCallArgs.skipWidths).toEqual([256, 640]);

    await waitFor(() => expect(screen.getByText("Done")).toBeInTheDocument());
  });

  // Found in review (CodeRabbit, PR #11, Major): with no cap, selecting
  // many large files would decode/upload all of them at once.
  it("runs at most 3 uploads at a time, starting the next one as a slot frees up", async () => {
    const resolvers: Array<() => void> = [];
    uploadImageMediaMock.mockImplementation(
      ({ onProgress }: { onProgress?: (p: { status: string }) => void }) =>
        new Promise<{ mediaId: string }>((resolve) => {
          onProgress?.({ status: "uploading" });
          resolvers.push(() => resolve({ mediaId: "media" }));
        })
    );

    render(<MediaUploadField kind="image" storagePrefix="photos/set-1" />);
    const input = screen.getByLabelText("Choose images to upload") as HTMLInputElement;
    const files = [1, 2, 3, 4, 5].map((n) => new File(["data"], `photo-${n}.jpg`, { type: "image/jpeg" }));
    fireEvent.change(input, { target: { files } });

    await waitFor(() => expect(uploadImageMediaMock).toHaveBeenCalledTimes(3));
    expect(screen.getAllByText("Queued")).toHaveLength(2);

    resolvers[0]();
    await waitFor(() => expect(uploadImageMediaMock).toHaveBeenCalledTimes(4));

    resolvers[1]();
    resolvers[2]();
    resolvers[3]();
    await waitFor(() => expect(uploadImageMediaMock).toHaveBeenCalledTimes(5));
  });

  it("uses the video pipeline and accept type when kind is video", async () => {
    uploadVideoMediaMock.mockResolvedValue({ mediaId: "video-1" });

    render(<MediaUploadField kind="video" storagePrefix="products/p1" />);
    const input = screen.getByLabelText("Choose a video to upload") as HTMLInputElement;
    expect(input.accept).toBe("video/mp4,video/webm");

    const file = new File(["data"], "turntable.mp4", { type: "video/mp4" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(uploadVideoMediaMock).toHaveBeenCalled());
    expect(uploadImageMediaMock).not.toHaveBeenCalled();
  });
});
