import { afterEach, describe, expect, it, vi } from "vitest";

const { uploadMock, upsertMock, fromStorageMock, fromTableMock } = vi.hoisted(() => ({
  uploadMock: vi.fn(),
  upsertMock: vi.fn(),
  fromStorageMock: vi.fn(),
  fromTableMock: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    storage: { from: fromStorageMock },
    from: fromTableMock,
  },
}));

import { uploadVideoMedia, VideoUploadError } from "./video-upload";

function makeVideoFile(sizeBytes = 1024, type = "video/mp4") {
  return new File([new Uint8Array(sizeBytes)], "turntable.mp4", { type });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("uploadVideoMedia", () => {
  it("uploads the raw file as-is and inserts a video media row with no renditions", async () => {
    fromStorageMock.mockReturnValue({ upload: uploadMock });
    uploadMock.mockResolvedValue({ error: null });
    fromTableMock.mockReturnValue({ upsert: upsertMock });
    upsertMock.mockResolvedValue({ error: null });

    const file = makeVideoFile();
    const result = await uploadVideoMedia({ file, storagePrefix: "products/p1", mediaId: "video-1" });

    expect(result).toEqual({ mediaId: "video-1" });
    expect(uploadMock).toHaveBeenCalledWith(
      "products/p1/video-1/video.mp4",
      file,
      expect.objectContaining({ contentType: "video/mp4", cacheControl: "31536000", upsert: true })
    );
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "video-1",
        kind: "video",
        storage_path: "products/p1/video-1/video.mp4",
        status: "ready",
      })
    );
  });

  it("names a .webm file's path correctly", async () => {
    fromStorageMock.mockReturnValue({ upload: uploadMock });
    uploadMock.mockResolvedValue({ error: null });
    fromTableMock.mockReturnValue({ upsert: upsertMock });
    upsertMock.mockResolvedValue({ error: null });

    await uploadVideoMedia({
      file: makeVideoFile(1024, "video/webm"),
      storagePrefix: "products/p1",
      mediaId: "video-1",
    });

    expect(uploadMock).toHaveBeenCalledWith(
      "products/p1/video-1/video.webm",
      expect.anything(),
      expect.objectContaining({ contentType: "video/webm" })
    );
  });

  it("rejects a file over 50 MB before attempting to upload it", async () => {
    const bigFile = makeVideoFile(50 * 1024 * 1024 + 1);

    await expect(uploadVideoMedia({ file: bigFile, storagePrefix: "products/p1" })).rejects.toThrow(
      /larger than 50 MB/
    );
    expect(fromStorageMock).not.toHaveBeenCalled();
  });

  it("rejects a file that isn't MP4 or WebM", async () => {
    const badFile = makeVideoFile(1024, "video/quicktime");

    await expect(uploadVideoMedia({ file: badFile, storagePrefix: "products/p1" })).rejects.toThrow(
      /must be an MP4 or WebM video/
    );
    expect(fromStorageMock).not.toHaveBeenCalled();
  });

  it("throws VideoUploadError and never inserts the media row when the storage upload fails", async () => {
    fromStorageMock.mockReturnValue({ upload: uploadMock });
    uploadMock.mockResolvedValue({ error: { message: "network error" } });
    fromTableMock.mockReturnValue({ upsert: upsertMock });

    await expect(
      uploadVideoMedia({ file: makeVideoFile(), storagePrefix: "products/p1", mediaId: "video-1" })
    ).rejects.toBeInstanceOf(VideoUploadError);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("reports progress through decoding/uploading/inserting/done", async () => {
    fromStorageMock.mockReturnValue({ upload: uploadMock });
    uploadMock.mockResolvedValue({ error: null });
    fromTableMock.mockReturnValue({ upsert: upsertMock });
    upsertMock.mockResolvedValue({ error: null });

    const statuses: string[] = [];
    await uploadVideoMedia({
      file: makeVideoFile(),
      storagePrefix: "products/p1",
      mediaId: "video-1",
      onProgress: (p) => statuses.push(p.status),
    });

    expect(statuses).toEqual(["uploading", "inserting", "done"]);
  });
});
