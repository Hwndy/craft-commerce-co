import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Ref } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { useAdminPhotoSetsMock, reorderMutateMock, useReorderPhotoSetMock } = vi.hoisted(() => ({
  useAdminPhotoSetsMock: vi.fn(),
  reorderMutateMock: vi.fn(),
  useReorderPhotoSetMock: vi.fn(),
}));
vi.mock("./lib/adminPhotos", () => ({
  useAdminPhotoSets: useAdminPhotoSetsMock,
  useReorderPhotoSet: useReorderPhotoSetMock,
}));

const { fetchPublishedFilmMock } = vi.hoisted(() => ({ fetchPublishedFilmMock: vi.fn() }));
vi.mock("../film/lib/queries", () => ({
  fetchPublishedFilm: fetchPublishedFilmMock,
  FILM_QUERY_KEY: ["film"],
}));

const { photoSetFormPropsSpy } = vi.hoisted(() => ({ photoSetFormPropsSpy: vi.fn() }));
vi.mock("./components/PhotoSetForm", async () => {
  const { forwardRef, useImperativeHandle } = await import("react");
  return {
    // forwardRef with an always-true confirmClose: AdminPhotos.tsx's
    // requestClose() can call formRef.current.confirmClose() without
    // needing a real dirty-check for these list/drawer-focused tests.
    PhotoSetForm: forwardRef(function PhotoSetFormStub(
      props: { photoSet?: { title: string }; onCreated: (p: unknown) => void; onClose: () => void },
      ref: Ref<{ confirmClose: () => boolean }>
    ) {
      photoSetFormPropsSpy(props);
      useImperativeHandle(ref, () => ({ confirmClose: () => true }));
      return (
        <div data-testid="photo-set-form">
          <span>Form for: {props.photoSet ? props.photoSet.title : "new"}</span>
          <button type="button" onClick={() => props.onCreated({ id: "created-1", title: "Created set" })}>
            Simulate created
          </button>
          <button type="button" onClick={props.onClose}>
            Simulate close
          </button>
        </div>
      );
    }),
  };
});

import AdminPhotos from "./AdminPhotos";

function photoSet(id: string, title: string, sortOrder: number) {
  return { id, title, location: null, shootDate: null, sortOrder, published: true };
}

// AdminPhotos.tsx calls the real @tanstack/react-query useQuery() for the
// "current film" card (fetchPublishedFilm itself is mocked above, but
// useQuery needs a real QueryClient in context regardless).
function renderAdminPhotos() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminPhotos />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  useReorderPhotoSetMock.mockReturnValue({ mutate: reorderMutateMock, isPending: false });
  // Real useQuery() runs against this mock (see renderAdminPhotos()); it
  // warns if the queryFn resolves to undefined, which a bare vi.fn()
  // would do for any test that doesn't care about the film card.
  fetchPublishedFilmMock.mockResolvedValue(null);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("AdminPhotos", () => {
  it("renders the photo set list", () => {
    useAdminPhotoSetsMock.mockReturnValue({
      data: [photoSet("a", "Set A", 0), photoSet("b", "Set B", 1)],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useReorderPhotoSetMock.mockReturnValue({ mutate: reorderMutateMock, isPending: false });

    renderAdminPhotos();
    expect(screen.getByText("Set A")).toBeInTheDocument();
    expect(screen.getByText("Set B")).toBeInTheDocument();
  });

  it("shows an empty state when there are no photo sets", () => {
    useAdminPhotoSetsMock.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: vi.fn() });
    renderAdminPhotos();
    expect(screen.getByText("No photo sets yet.")).toBeInTheDocument();
  });

  it("shows an error state with a retry action, not the empty state", () => {
    const refetch = vi.fn();
    useAdminPhotoSetsMock.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch });
    renderAdminPhotos();
    expect(screen.getByText("Couldn't load photo sets.")).toBeInTheDocument();
    expect(screen.queryByText("No photo sets yet.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Try again"));
    expect(refetch).toHaveBeenCalled();
  });

  it("moves a set up/down via the reorder hook, disabled at the list ends", () => {
    useAdminPhotoSetsMock.mockReturnValue({
      data: [photoSet("a", "Set A", 0), photoSet("b", "Set B", 1)],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderAdminPhotos();
    fireEvent.click(screen.getByLabelText('Move "Set B" up'));
    expect(reorderMutateMock).toHaveBeenCalledWith({
      photoSets: [photoSet("a", "Set A", 0), photoSet("b", "Set B", 1)],
      id: "b",
      direction: "up",
    });
    expect(screen.getByLabelText('Move "Set A" up')).toBeDisabled();
    expect(screen.getByLabelText('Move "Set B" down')).toBeDisabled();
  });

  it("disables both reorder buttons while a reorder is pending", () => {
    useAdminPhotoSetsMock.mockReturnValue({
      data: [photoSet("a", "Set A", 0), photoSet("b", "Set B", 1)],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useReorderPhotoSetMock.mockReturnValue({ mutate: reorderMutateMock, isPending: true });

    renderAdminPhotos();
    expect(screen.getByLabelText('Move "Set A" down')).toBeDisabled();
    expect(screen.getByLabelText('Move "Set B" up')).toBeDisabled();
  });

  it("shows the current film's title and version when one is published", async () => {
    useAdminPhotoSetsMock.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: vi.fn() });
    fetchPublishedFilmMock.mockResolvedValue({
      id: "film-1",
      title: "The Making Of",
      version: 2,
      captionsPath: null,
      media: { id: "m", hlsMaster: null, posterPath: null, spritePath: null, spriteMeta: null, durationS: null },
    });

    renderAdminPhotos();
    expect(await screen.findByText(/Current film: The Making Of/)).toBeInTheDocument();
    expect(screen.getByText(/Version 2/)).toBeInTheDocument();
    expect(screen.getByText(/developer-assisted/)).toBeInTheDocument();
  });

  it("opens a new-set drawer, then switches into edit mode once create resolves", () => {
    useAdminPhotoSetsMock.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: vi.fn() });

    renderAdminPhotos();
    fireEvent.click(screen.getByText("New photo set"));
    expect(screen.getByTestId("photo-set-form")).toBeInTheDocument();
    expect(screen.getByText("Form for: new")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Simulate created"));
    expect(screen.getByText("Form for: Created set")).toBeInTheDocument();
  });

  it("doesn't let a stale drawer session's callback close or replace the session now open", () => {
    useAdminPhotoSetsMock.mockReturnValue({
      data: [photoSet("a", "Set A", 0), photoSet("b", "Set B", 1)],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderAdminPhotos();
    fireEvent.click(screen.getByText("Set A"));
    const staleProps = photoSetFormPropsSpy.mock.calls.at(-1)![0] as { onClose: () => void };

    // Switch to a different session (B) before A's own stale onClose fires.
    fireEvent.click(screen.getByText("Set B"));
    expect(screen.getByText("Form for: Set B")).toBeInTheDocument();

    staleProps.onClose();
    // B's drawer must still be open, not closed by A's late callback.
    expect(screen.getByTestId("photo-set-form")).toBeInTheDocument();
  });
});
