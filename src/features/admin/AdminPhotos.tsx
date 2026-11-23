import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";

import { fetchPublishedFilm, FILM_QUERY_KEY } from "../film/lib/queries";
import { AdminEditDrawer } from "./components/AdminEditDrawer";
import { AdminList } from "./components/AdminList";
import { PhotoSetForm, type PhotoSetFormHandle } from "./components/PhotoSetForm";
import { useAdminPhotoSets, useReorderPhotoSet, type AdminPhotoSetRow } from "./lib/adminPhotos";

/** One drawer "session" per open/new — a fresh random token each time, so
 * a late-resolving create/update/delete from a session the admin has
 * since closed or replaced can't act on whatever session is open now.
 * Found in review (CodeRabbit, PR #38) on T5's identically-shaped
 * drawer: its first fix scoped callbacks by comparing against the
 * literal `"new"` string, which still let two concurrent "new product"
 * drafts collide (both used the same token) — a real per-session token
 * avoids that from the start. */
interface EditSession {
  token: string;
  photoSet: AdminPhotoSetRow | "new";
}

/**
 * T6's real Photos admin (FR-7.3) — replaces AdminSectionPlaceholder.
 * Same list+drawer shape as T5's AdminProducts.tsx, plus a read-only
 * "Current film" card (brief: "show the current film read-only, with its
 * version and a note that replacing it is developer-assisted, D-09") —
 * reuses the public fetchPublishedFilm() as-is, since the admin only
 * needs to see the same published film a visitor would.
 */
export default function AdminPhotos() {
  const { data: photoSets, isLoading, isError, refetch } = useAdminPhotoSets();
  const { data: film } = useQuery({ queryKey: FILM_QUERY_KEY, queryFn: fetchPublishedFilm });
  const reorder = useReorderPhotoSet();
  const [editing, setEditing] = useState<EditSession | null>(null);
  const formRef = useRef<PhotoSetFormHandle>(null);

  function moveSet(id: string, direction: "up" | "down") {
    if (!photoSets) return;
    reorder.mutate({ photoSets, id, direction });
  }

  function openNew() {
    setEditing({ token: crypto.randomUUID(), photoSet: "new" });
  }

  function openEdit(photoSet: AdminPhotoSetRow) {
    setEditing({ token: crypto.randomUUID(), photoSet });
  }

  // Same guard as T5's AdminProducts.tsx: the Sheet's own X/Escape/overlay
  // dismissal all call this too, not just a footer action, so it has to
  // go through confirmClose() itself rather than assuming only one path
  // closes the drawer.
  function requestClose() {
    if (formRef.current && !formRef.current.confirmClose()) return;
    setEditing(null);
  }

  return (
    <main className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-heading">Photos</h1>
        <Button variant="pill" onClick={openNew}>
          New photo set
        </Button>
      </div>

      {film && (
        <div className="mb-4 rounded-md border border-border p-4 text-sm">
          <p className="font-medium">Current film: {film.title}</p>
          <p className="text-muted-foreground">
            Version {film.version}. Replacing the film is developer-assisted — ask a developer to run the upload
            script rather than uploading a new file here.
          </p>
        </div>
      )}

      {isError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <p className="text-destructive">Couldn't load photo sets.</p>
          <Button type="button" variant="pill-outline" size="sm" className="mt-2" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <AdminList<AdminPhotoSetRow>
          items={photoSets ?? []}
          isLoading={isLoading}
          searchPlaceholder="Search photo sets…"
          getSearchText={(photoSet) => `${photoSet.title} ${photoSet.location ?? ""}`}
          getKey={(photoSet) => photoSet.id}
          emptyState={<p className="text-sm text-muted-foreground">No photo sets yet.</p>}
          renderItem={(photoSet) => {
            const index = (photoSets ?? []).findIndex((p) => p.id === photoSet.id);
            const isFirst = index === 0;
            const isLast = index === (photoSets?.length ?? 0) - 1;
            return (
              <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openEdit(photoSet)}>
                  <p className="truncate font-medium">{photoSet.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {photoSet.location ?? "No location"}
                    {!photoSet.published && " · Unpublished"}
                  </p>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="pill-outline"
                    size="icon"
                    aria-label={`Move "${photoSet.title}" up`}
                    disabled={isFirst || reorder.isPending}
                    onClick={() => moveSet(photoSet.id, "up")}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="pill-outline"
                    size="icon"
                    aria-label={`Move "${photoSet.title}" down`}
                    disabled={isLast || reorder.isPending}
                    onClick={() => moveSet(photoSet.id, "down")}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          }}
        />
      )}

      <AdminEditDrawer
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) requestClose();
        }}
        title={editing?.photoSet === "new" ? "New photo set" : editing?.photoSet.title ?? ""}
        description={editing?.photoSet === "new" ? "Add the basic details first — photos come after saving." : undefined}
      >
        {editing !== null && (
          <PhotoSetForm
            ref={formRef}
            key={editing.token}
            photoSet={editing.photoSet === "new" ? undefined : editing.photoSet}
            onCreated={(created) =>
              setEditing((current) => (current?.token === editing.token ? { token: editing.token, photoSet: created } : current))
            }
            onClose={() => setEditing((current) => (current?.token === editing.token ? null : current))}
          />
        )}
      </AdminEditDrawer>
    </main>
  );
}
