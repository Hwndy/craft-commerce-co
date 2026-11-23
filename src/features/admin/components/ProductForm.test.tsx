import type { Ref } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AdminProductRow } from "../lib/adminProducts";

const {
  createMutateAsync,
  updateMutateAsync,
  deleteMutateAsync,
  addPictureMutate,
  removePictureMutate,
  useProductPictures,
  captureVideoFrame,
  uploadImageMedia,
} = vi.hoisted(() => ({
  createMutateAsync: vi.fn(),
  updateMutateAsync: vi.fn(),
  deleteMutateAsync: vi.fn(),
  addPictureMutate: vi.fn(),
  removePictureMutate: vi.fn(),
  useProductPictures: vi.fn(),
  captureVideoFrame: vi.fn(),
  uploadImageMedia: vi.fn(),
}));

vi.mock("../lib/adminProducts", async () => {
  const actual = await vi.importActual<typeof import("../lib/adminProducts")>("../lib/adminProducts");
  return {
    ...actual,
    useCreateProduct: () => ({ mutateAsync: createMutateAsync }),
    useUpdateProduct: () => ({ mutateAsync: updateMutateAsync }),
    useDeleteProduct: () => ({ mutateAsync: deleteMutateAsync }),
    useAddProductPicture: () => ({ mutate: addPictureMutate }),
    useRemoveProductPicture: () => ({ mutate: removePictureMutate }),
    useProductPictures,
  };
});
vi.mock("../lib/image-pipeline", () => ({ uploadImageMedia }));
vi.mock("../lib/video-upload", () => ({ captureVideoFrame }));

const mediaUploadSpy = vi.hoisted(() => vi.fn());
vi.mock("./MediaUploadField", () => ({
  MediaUploadField: (props: {
    kind: string;
    storagePrefix: string;
    onMediaReady: (result: { mediaId: string; file: File }) => void;
    onPendingChange?: (pending: boolean) => void;
    disabled?: boolean;
  }) => {
    mediaUploadSpy(props);
    return (
      <>
        <button
          type="button"
          disabled={props.disabled}
          onClick={() =>
            props.onMediaReady({
              mediaId: `media-${props.kind}`,
              file: new File(["x"], `${props.kind}.bin`, { type: props.kind === "video" ? "video/mp4" : "image/webp" }),
            })
          }
        >
          Simulate {props.kind} upload
        </button>
        <button type="button" onClick={() => props.onPendingChange?.(true)}>
          Simulate {props.kind} pending
        </button>
      </>
    );
  },
}));

import { ProductForm, type ProductFormHandle, type ProductFormProps } from "./ProductForm";

function renderForm(props: ProductFormProps, ref?: Ref<ProductFormHandle>) {
  return render(
    <MemoryRouter>
      <ProductForm {...props} ref={ref} />
    </MemoryRouter>
  );
}

afterEach(() => {
  vi.clearAllMocks();
  useProductPictures.mockReturnValue({ data: [] });
});
useProductPictures.mockReturnValue({ data: [] });

function product(overrides: Partial<AdminProductRow> = {}): AdminProductRow {
  return {
    id: "p1",
    slug: "sample-belt",
    name: "Sample Belt",
    priceAmount: 40,
    priceCurrency: "GBP",
    description: "A belt.",
    bullets: ["First bullet"],
    status: "available",
    zone: "floor",
    onSale: false,
    sortOrder: 0,
    posterMediaId: null,
    videoMediaId: null,
    published: false,
    ...overrides,
  };
}

describe("ProductForm — create mode", () => {
  it("has no slug/published fields or media sections", () => {
    renderForm({ onCreated: vi.fn(), onClose: vi.fn() });
    expect(screen.queryByLabelText("Slug")).not.toBeInTheDocument();
    expect(screen.queryByText("Published")).not.toBeInTheDocument();
    expect(screen.queryByText("Poster picture")).not.toBeInTheDocument();
  });

  it("creates the product and calls onCreated with the real result", async () => {
    const created = product({ id: "new-id" });
    createMutateAsync.mockResolvedValue(created);
    const onCreated = vi.fn();
    const user = userEvent.setup();

    renderForm({ onCreated: onCreated, onClose: vi.fn() });
    await user.type(screen.getByLabelText("Name"), "New Belt");
    await user.clear(screen.getByLabelText("Price (GBP)"));
    await user.type(screen.getByLabelText("Price (GBP)"), "55");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(createMutateAsync).toHaveBeenCalled());
    expect(createMutateAsync.mock.calls[0][0]).toMatchObject({ name: "New Belt", priceAmount: 55 });
    expect(onCreated).toHaveBeenCalledWith(created);
  });
});

describe("ProductForm — edit mode", () => {
  it("shows the slug and published fields and the media sections", () => {
    renderForm({ product: product(), onCreated: vi.fn(), onClose: vi.fn() });
    expect(screen.getByLabelText("Slug")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByText("Poster picture")).toBeInTheDocument();
    expect(screen.getByText("Gallery pictures")).toBeInTheDocument();
    expect(screen.getByText("Turntable video")).toBeInTheDocument();
  });

  it("adds and removes bullet rows", async () => {
    const user = userEvent.setup();
    renderForm({ product: product({ bullets: ["Only bullet"] }), onCreated: vi.fn(), onClose: vi.fn() });

    expect(screen.getByDisplayValue("Only bullet")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add bullet" }));
    const bulletInputs = screen.getAllByRole("textbox").filter((el) => (el as HTMLInputElement).name?.startsWith("bullets."));
    expect(bulletInputs).toHaveLength(2);

    await user.click(screen.getAllByRole("button", { name: "Remove bullet" })[0]);
    expect(screen.queryByDisplayValue("Only bullet")).not.toBeInTheDocument();
  });

  it("saves with the poster id set after the poster upload fires, and closes", async () => {
    updateMutateAsync.mockResolvedValue(product());
    const onClose = vi.fn();
    const user = userEvent.setup();

    renderForm({ product: product(), onCreated: vi.fn(), onClose: onClose });
    // Two MediaUploadField kind="image" instances exist (poster, gallery) —
    // the poster one is the first rendered.
    await user.click(screen.getAllByRole("button", { name: "Simulate image upload" })[0]);
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalled());
    expect(updateMutateAsync.mock.calls[0][0]).toMatchObject({ id: "p1", posterMediaId: "media-image" });
    expect(onClose).toHaveBeenCalled();
  });

  it("only offers 'Capture this frame as the poster' once a video is uploaded and no poster is set", async () => {
    const user = userEvent.setup();
    renderForm({ product: product(), onCreated: vi.fn(), onClose: vi.fn() });

    expect(screen.queryByRole("button", { name: /Capture this frame/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Simulate video upload" }));
    expect(screen.getByRole("button", { name: /Capture this frame/ })).toBeInTheDocument();
  });

  it("does not offer 'Capture this frame as the poster' once a poster is already set", async () => {
    const user = userEvent.setup();
    renderForm({ product: product({ posterMediaId: "existing-poster" }), onCreated: vi.fn(), onClose: vi.fn() });

    await user.click(screen.getByRole("button", { name: "Simulate video upload" }));
    expect(screen.queryByRole("button", { name: /Capture this frame/ })).not.toBeInTheDocument();
  });

  it("deletes the product after confirming, and closes", async () => {
    deleteMutateAsync.mockResolvedValue("p1");
    const onClose = vi.fn();
    const user = userEvent.setup();

    renderForm({ product: product(), onCreated: vi.fn(), onClose: onClose });
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Yes, delete" }));

    await waitFor(() => expect(deleteMutateAsync).toHaveBeenCalledWith("p1"));
    expect(onClose).toHaveBeenCalled();
  });

  it("lists an already-attached gallery picture with a Remove button", () => {
    useProductPictures.mockReturnValue({ data: [{ id: "pm1", mediaId: "media-1", sortOrder: 0 }] });
    renderForm({ product: product(), onCreated: vi.fn(), onClose: vi.fn() });
    expect(screen.getByText(/media-1/)).toBeInTheDocument();
  });

  it("disables Published until a poster exists, and enables it once one is uploaded", async () => {
    const user = userEvent.setup();
    renderForm({ product: product(), onCreated: vi.fn(), onClose: vi.fn() });

    expect(screen.getByRole("switch", { name: "Published" })).toBeDisabled();
    await user.click(screen.getAllByRole("button", { name: "Simulate image upload" })[0]);
    expect(screen.getByRole("switch", { name: "Published" })).not.toBeDisabled();
  });

  it("leaves Published enabled when the product already has a poster", () => {
    renderForm({ product: product({ posterMediaId: "existing-poster" }), onCreated: vi.fn(), onClose: vi.fn() });
    expect(screen.getByRole("switch", { name: "Published" })).not.toBeDisabled();
  });

  it("disables Save while a MediaUploadField reports a pending upload", async () => {
    const user = userEvent.setup();
    renderForm({ product: product(), onCreated: vi.fn(), onClose: vi.fn() });

    expect(screen.getByRole("button", { name: "Save" })).not.toBeDisabled();
    await user.click(screen.getAllByRole("button", { name: "Simulate image pending" })[0]);
    expect(screen.getByRole("button", { name: "Waiting for uploads…" })).toBeDisabled();
  });

  it("counts an uploaded-but-unsaved poster as a real unsaved change", async () => {
    const formRef = { current: null as ProductFormHandle | null };
    const user = userEvent.setup();
    renderForm({ product: product(), onCreated: vi.fn(), onClose: vi.fn() }, formRef);

    // Nothing changed yet — safe to close without asking.
    expect(formRef.current!.confirmClose()).toBe(true);

    await user.click(screen.getAllByRole("button", { name: "Simulate image upload" })[0]);
    // The poster id changed locally but hasn't been Saved — confirmClose
    // must now go through window.confirm rather than reporting "clean".
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    expect(formRef.current!.confirmClose()).toBe(false);
    expect(confirmSpy).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  // Found in review (CodeRabbit, PR #38): mediaIsDirty only flips once an
  // upload's own onMediaReady fires — closing in the gap between
  // "upload started" and "upload finished" skipped the warning entirely,
  // and the eventual result had nowhere left to land.
  it("treats a still-in-flight upload as requiring confirmation to close, even before it resolves", async () => {
    const formRef = { current: null as ProductFormHandle | null };
    const user = userEvent.setup();
    renderForm({ product: product(), onCreated: vi.fn(), onClose: vi.fn() }, formRef);

    expect(formRef.current!.confirmClose()).toBe(true);

    await user.click(screen.getAllByRole("button", { name: "Simulate image pending" })[0]);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    expect(formRef.current!.confirmClose()).toBe(false);
    expect(confirmSpy).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  // Found in review (CodeRabbit, PR #38): the poster/video fields read
  // their mediaId out of plain component state only when Save is
  // clicked — a file picked mid-submit can finish *after* that read
  // already happened, landing nowhere once the form closes.
  it("disables the poster and video upload fields (not the gallery one) while a save is submitting", async () => {
    let resolveUpdate!: (value: AdminProductRow) => void;
    updateMutateAsync.mockImplementation(() => new Promise((resolve) => (resolveUpdate = resolve)));
    const user = userEvent.setup();
    renderForm({ product: product(), onCreated: vi.fn(), onClose: vi.fn() });

    await user.click(screen.getByRole("button", { name: "Save" }));

    const latestProps = (prefix: string) =>
      mediaUploadSpy.mock.calls
        .map(([props]) => props)
        .filter((p) => p.storagePrefix === prefix)
        .at(-1);

    await waitFor(() => {
      expect(latestProps("products/p1/poster")?.disabled).toBe(true);
    });
    expect(latestProps("products/p1/video")?.disabled).toBe(true);
    expect(latestProps("products/p1/pictures")?.disabled).toBeFalsy();

    resolveUpdate(product());
  });
});
