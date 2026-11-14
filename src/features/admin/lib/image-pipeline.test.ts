import { afterEach, describe, expect, it, vi } from "vitest";

const { decodeImageMock, resizeAndEncodeMock, encodeBlurPlaceholderMock } = vi.hoisted(() => ({
  decodeImageMock: vi.fn(),
  resizeAndEncodeMock: vi.fn(),
  encodeBlurPlaceholderMock: vi.fn(),
}));
vi.mock("./image-codec", () => ({
  RENDITION_WIDTHS: [256, 640, 1280, 2048],
  decodeImage: decodeImageMock,
  resizeAndEncode: resizeAndEncodeMock,
  encodeBlurPlaceholder: encodeBlurPlaceholderMock,
}));

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

import { ImageUploadError, uploadImageMedia } from "./image-pipeline";

function makeFakeBitmap() {
  return { width: 3000, height: 2000, close: vi.fn() } as unknown as ImageBitmap & { close: ReturnType<typeof vi.fn> };
}

function makeFile(sizeBytes = 1024) {
  return new File([new Uint8Array(sizeBytes)], "belt.jpg", { type: "image/jpeg" });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("uploadImageMedia", () => {
  it("uploads all four renditions at the right widths and paths, then inserts the media row as ready with all four keys", async () => {
    const bitmap = makeFakeBitmap();
    decodeImageMock.mockResolvedValue(bitmap);
    resizeAndEncodeMock.mockImplementation(async (_bitmap, width: number) => new Blob([`webp-${width}`]));
    encodeBlurPlaceholderMock.mockResolvedValue("data:image/webp;base64,blur");
    fromStorageMock.mockReturnValue({ upload: uploadMock });
    uploadMock.mockResolvedValue({ error: null });
    fromTableMock.mockReturnValue({ upsert: upsertMock });
    upsertMock.mockResolvedValue({ error: null });

    const result = await uploadImageMedia({ file: makeFile(), storagePrefix: "photos/set-1", mediaId: "media-1" });

    expect(result).toEqual({ mediaId: "media-1" });
    expect(uploadMock).toHaveBeenCalledTimes(4);
    for (const width of [256, 640, 1280, 2048]) {
      expect(uploadMock).toHaveBeenCalledWith(
        `photos/set-1/media-1/${width}.webp`,
        expect.any(Blob),
        expect.objectContaining({ contentType: "image/webp", upsert: true })
      );
    }
    expect(uploadMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Blob),
      expect.objectContaining({ cacheControl: "31536000" })
    );
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "media-1",
        kind: "image",
        storage_path: "photos/set-1/media-1",
        status: "ready",
        blur_data_url: "data:image/webp;base64,blur",
        renditions: {
          "256": "photos/set-1/media-1/256.webp",
          "640": "photos/set-1/media-1/640.webp",
          "1280": "photos/set-1/media-1/1280.webp",
          "2048": "photos/set-1/media-1/2048.webp",
        },
      })
    );
    // The media row is the last call: only inserted once every rendition upload resolved.
    expect(upsertMock.mock.invocationCallOrder[0]).toBeGreaterThan(
      uploadMock.mock.invocationCallOrder[uploadMock.mock.invocationCallOrder.length - 1]
    );
    // The decoded bitmap's pixel data is released deterministically once done, not left to GC.
    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });

  it("rejects a file over 25 MB before attempting to decode it", async () => {
    const bigFile = makeFile(25 * 1024 * 1024 + 1);

    await expect(uploadImageMedia({ file: bigFile, storagePrefix: "photos/set-1" })).rejects.toThrow(
      /larger than 25 MB/
    );
    expect(decodeImageMock).not.toHaveBeenCalled();
  });

  it("on a rendition upload failure, throws with the widths that had already succeeded, never inserts the media row, and still releases the bitmap", async () => {
    const bitmap = makeFakeBitmap();
    decodeImageMock.mockResolvedValue(bitmap);
    resizeAndEncodeMock.mockResolvedValue(new Blob(["webp"]));
    fromStorageMock.mockReturnValue({ upload: uploadMock });
    uploadMock
      .mockResolvedValueOnce({ error: null }) // 256
      .mockResolvedValueOnce({ error: null }) // 640
      .mockResolvedValueOnce({ error: { message: "network error" } }); // 1280
    fromTableMock.mockReturnValue({ upsert: upsertMock });

    let caught: unknown;
    try {
      await uploadImageMedia({ file: makeFile(), storagePrefix: "photos/set-1", mediaId: "media-1" });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ImageUploadError);
    expect((caught as InstanceType<typeof ImageUploadError>).completedWidths).toEqual([256, 640]);
    expect(upsertMock).not.toHaveBeenCalled();
    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });

  it("retrying with skipWidths re-uses the same mediaId's paths without re-encoding the already-succeeded renditions", async () => {
    decodeImageMock.mockResolvedValue(makeFakeBitmap());
    resizeAndEncodeMock.mockResolvedValue(new Blob(["webp"]));
    encodeBlurPlaceholderMock.mockResolvedValue("data:image/webp;base64,blur");
    fromStorageMock.mockReturnValue({ upload: uploadMock });
    uploadMock.mockResolvedValue({ error: null });
    fromTableMock.mockReturnValue({ upsert: upsertMock });
    upsertMock.mockResolvedValue({ error: null });

    const result = await uploadImageMedia({
      file: makeFile(),
      storagePrefix: "photos/set-1",
      mediaId: "media-1",
      skipWidths: [256, 640],
    });

    expect(result).toEqual({ mediaId: "media-1" });
    // Only the two widths NOT already completed get re-encoded...
    expect(resizeAndEncodeMock).toHaveBeenCalledTimes(2);
    // ...but the final renditions map still has every width, at the same deterministic paths.
    expect(uploadMock).toHaveBeenCalledTimes(2);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        renditions: {
          "256": "photos/set-1/media-1/256.webp",
          "640": "photos/set-1/media-1/640.webp",
          "1280": "photos/set-1/media-1/1280.webp",
          "2048": "photos/set-1/media-1/2048.webp",
        },
      })
    );
  });

  it("generates a mediaId when none is supplied", async () => {
    decodeImageMock.mockResolvedValue(makeFakeBitmap());
    resizeAndEncodeMock.mockResolvedValue(new Blob(["webp"]));
    encodeBlurPlaceholderMock.mockResolvedValue("data:image/webp;base64,blur");
    fromStorageMock.mockReturnValue({ upload: uploadMock });
    uploadMock.mockResolvedValue({ error: null });
    fromTableMock.mockReturnValue({ upsert: upsertMock });
    upsertMock.mockResolvedValue({ error: null });

    const result = await uploadImageMedia({ file: makeFile(), storagePrefix: "photos/set-1" });

    expect(result.mediaId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
