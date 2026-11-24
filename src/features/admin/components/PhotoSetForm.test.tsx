import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  createMutateAsync,
  updateMutateAsync,
  deleteMutateAsync,
  addPhotoMutate,
  removePhotoMutate,
  updatePhotoMutate,
  reorderPhotoMutate,
  usePhotosForSetMock,
  useReorderPhotoMock,
} = vi.hoisted(() => ({
  createMutateAsync: vi.fn(),
  updateMutateAsync: vi.fn(),
  deleteMutateAsync: vi.fn(),
  addPhotoMutate: vi.fn(),
  removePhotoMutate: vi.fn(),
  updatePhotoMutate: vi.fn(),
  reorderPhotoMutate: vi.fn(),
  usePhotosForSetMock: vi.fn(),
  useReorderPhotoMock: vi.fn(),
}));

vi.mock("../lib/adminPhotos", () => ({
  useCreatePhotoSet: () => ({ mutateAsync: createMutateAsync }),
  useUpdatePhotoSet: () => ({ mutateAsync: updateMutateAsync }),
  useDeletePhotoSet: () => ({ mutateAsync: deleteMutateAsync }),
  useAddPhoto: () => ({ mutate: addPhotoMutate }),
  useRemovePhoto: () => ({ mutate: removePhotoMutate }),
  useUpdatePhoto: () => ({ mutate: updatePhotoMutate }),
  usePhotosForSet: usePhotosForSetMock,
  useReorderPhoto: useReorderPhotoMock,
}));

const { onMediaReadyRef } = vi.hoisted(() => ({ onMediaReadyRef: { current: null as ((r: unknown) => void) | null } }));
vi.mock("./MediaUploadField", () => ({
  MediaUploadField: (props: { onMediaReady?: (result: { mediaId: string; file: File }) => void }) => {
    onMediaReadyRef.current = (result) => props.onMediaReady?.(result as { mediaId: string; file: File });
    return <div data-testid="media-upload-field" />;
  },
}));

import { PhotoSetForm } from "./PhotoSetForm";

function withRouter(children: ReactNode) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

function photoSet() {
  return {
    id: "set-1",
    title: "Original title",
    location: "Studio",
    shootDate: "2026-01-01",
    sortOrder: 0,
    published: false,
  };
}

function photo(id: string, title: string, sortOrder: number) {
  return { id, setId: "set-1", mediaId: `media-${id}`, title, takenOn: null, sortOrder };
}

// Found in review (CodeRabbit): these need to be beforeEach, not
// afterEach — a test run alone (e.g. via `it.only`) is the first test to
// run, so an afterEach from a *previous* test never happens and these
// mocks would still be unset when it renders.
beforeEach(() => {
  usePhotosForSetMock.mockReturnValue({ data: [] });
  useReorderPhotoMock.mockReturnValue({ mutate: reorderPhotoMutate, isPending: false });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("PhotoSetForm", () => {
  it("create mode: has no photos section or published switch", () => {
    usePhotosForSetMock.mockReturnValue({ data: undefined });
    render(withRouter(<PhotoSetForm onCreated={vi.fn()} onClose={vi.fn()} />));
    expect(screen.getByLabelText("Title")).toBeInTheDocument();
    expect(screen.queryByText("Published")).not.toBeInTheDocument();
    expect(screen.queryByText("Photos")).not.toBeInTheDocument();
  });

  it("create mode: submitting calls useCreatePhotoSet and onCreated with the result", async () => {
    createMutateAsync.mockResolvedValue({ id: "new-set", title: "New set", location: null, shootDate: null, sortOrder: 2, published: false });
    const onCreated = vi.fn();
    usePhotosForSetMock.mockReturnValue({ data: undefined });

    render(withRouter(<PhotoSetForm onCreated={onCreated} onClose={vi.fn()} />));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New set" } });
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() =>
      expect(createMutateAsync).toHaveBeenCalledWith({ title: "New set", location: null, shootDate: null })
    );
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: "new-set" })));
  });

  it("edit mode: shows the published switch and existing photos", () => {
    usePhotosForSetMock.mockReturnValue({ data: [photo("p1", "First", 0), photo("p2", "Second", 1)] });
    render(withRouter(<PhotoSetForm photoSet={photoSet()} onCreated={vi.fn()} onClose={vi.fn()} />));
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByDisplayValue("First")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Second")).toBeInTheDocument();
  });

  it("edit mode: submitting calls useUpdatePhotoSet with the form values and then onClose", async () => {
    const onClose = vi.fn();
    updateMutateAsync.mockResolvedValue(undefined);
    usePhotosForSetMock.mockReturnValue({ data: [] });

    render(withRouter(<PhotoSetForm photoSet={photoSet()} onCreated={vi.fn()} onClose={onClose} />));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Updated title" } });
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() =>
      expect(updateMutateAsync).toHaveBeenCalledWith({
        id: "set-1",
        title: "Updated title",
        location: "Studio",
        shootDate: "2026-01-01",
        published: false,
      })
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("deleting confirms, then calls useDeletePhotoSet and onClose", async () => {
    const onClose = vi.fn();
    deleteMutateAsync.mockResolvedValue(undefined);
    usePhotosForSetMock.mockReturnValue({ data: [] });

    render(withRouter(<PhotoSetForm photoSet={photoSet()} onCreated={vi.fn()} onClose={onClose} />));
    fireEvent.click(screen.getByText("Delete"));
    fireEvent.click(screen.getByText("Yes, delete"));

    await waitFor(() => expect(deleteMutateAsync).toHaveBeenCalledWith("set-1"));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("editing a photo's title on blur calls useUpdatePhoto", () => {
    usePhotosForSetMock.mockReturnValue({ data: [photo("p1", "First", 0)] });
    render(withRouter(<PhotoSetForm photoSet={photoSet()} onCreated={vi.fn()} onClose={vi.fn()} />));

    const titleInput = screen.getByDisplayValue("First");
    fireEvent.change(titleInput, { target: { value: "Renamed" } });
    fireEvent.blur(titleInput);

    expect(updatePhotoMutate).toHaveBeenCalledWith({ id: "p1", setId: "set-1", title: "Renamed", takenOn: null });
  });

  it("removing a photo calls useRemovePhoto with its id and set id", () => {
    usePhotosForSetMock.mockReturnValue({ data: [photo("p1", "First", 0)] });
    render(withRouter(<PhotoSetForm photoSet={photoSet()} onCreated={vi.fn()} onClose={vi.fn()} />));

    fireEvent.click(screen.getByText("Remove"));
    expect(removePhotoMutate).toHaveBeenCalledWith({ id: "p1", setId: "set-1" });
  });

  it("moving a photo calls useReorderPhoto with the current photo list", () => {
    const photos = [photo("p1", "First", 0), photo("p2", "Second", 1)];
    usePhotosForSetMock.mockReturnValue({ data: photos });
    render(withRouter(<PhotoSetForm photoSet={photoSet()} onCreated={vi.fn()} onClose={vi.fn()} />));

    fireEvent.click(screen.getByLabelText('Move "Second" up'));
    expect(reorderPhotoMutate).toHaveBeenCalledWith({ photos, id: "p2", direction: "up" });
  });

  it("disables both move buttons on every photo while a reorder is pending", () => {
    usePhotosForSetMock.mockReturnValue({ data: [photo("p1", "First", 0), photo("p2", "Second", 1)] });
    useReorderPhotoMock.mockReturnValue({ mutate: reorderPhotoMutate, isPending: true });

    render(withRouter(<PhotoSetForm photoSet={photoSet()} onCreated={vi.fn()} onClose={vi.fn()} />));
    expect(screen.getByLabelText('Move "First" down')).toBeDisabled();
    expect(screen.getByLabelText('Move "Second" up')).toBeDisabled();
  });

  it("adding a photo via MediaUploadField calls useAddPhoto", () => {
    // No sortOrder in this call any more (found in review, CodeRabbit):
    // useAddPhoto's own mutationFn allocates it from the database, not
    // from this stale in-memory photos.length, so a real gap in the
    // stored order or two uploads from the same render don't collide.
    usePhotosForSetMock.mockReturnValue({ data: [photo("p1", "First", 0)] });
    render(withRouter(<PhotoSetForm photoSet={photoSet()} onCreated={vi.fn()} onClose={vi.fn()} />));

    onMediaReadyRef.current?.({ mediaId: "media-2", file: new File(["x"], "belt.jpg", { type: "image/jpeg" }) });

    expect(addPhotoMutate).toHaveBeenCalledWith({
      setId: "set-1",
      mediaId: "media-2",
      title: "belt",
      takenOn: null,
    });
  });

  it("create mode: a failed create leaves the drawer open for retry", async () => {
    createMutateAsync.mockRejectedValue(new Error("network error"));
    const onCreated = vi.fn();
    usePhotosForSetMock.mockReturnValue({ data: undefined });

    render(withRouter(<PhotoSetForm onCreated={onCreated} onClose={vi.fn()} />));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New set" } });
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => expect(createMutateAsync).toHaveBeenCalled());
    expect(onCreated).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Title")).toBeInTheDocument();
  });

  it("edit mode: a failed save leaves the drawer open for retry", async () => {
    const onClose = vi.fn();
    updateMutateAsync.mockRejectedValue(new Error("network error"));
    usePhotosForSetMock.mockReturnValue({ data: [] });

    render(withRouter(<PhotoSetForm photoSet={photoSet()} onCreated={vi.fn()} onClose={onClose} />));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Updated title" } });
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
  });

  it("editing a photo twice before the fetched value refreshes still saves the second edit", () => {
    // Regression for a bug found in review (CodeRabbit): comparing
    // against the fetched `photo.title` instead of the last value sent
    // meant typing A -> B -> A again, both before useUpdatePhoto's own
    // invalidation refetch landed, made the second blur look like a
    // no-op — "B" stayed saved while the input showed "A" with no way to
    // re-trigger a save short of editing again.
    usePhotosForSetMock.mockReturnValue({ data: [photo("p1", "Original", 0)] });
    render(withRouter(<PhotoSetForm photoSet={photoSet()} onCreated={vi.fn()} onClose={vi.fn()} />));

    const titleInput = screen.getByDisplayValue("Original");
    fireEvent.change(titleInput, { target: { value: "Changed" } });
    fireEvent.blur(titleInput);
    fireEvent.change(titleInput, { target: { value: "Original" } });
    fireEvent.blur(titleInput);

    expect(updatePhotoMutate).toHaveBeenNthCalledWith(1, { id: "p1", setId: "set-1", title: "Changed", takenOn: null });
    expect(updatePhotoMutate).toHaveBeenNthCalledWith(2, { id: "p1", setId: "set-1", title: "Original", takenOn: null });
  });
});
