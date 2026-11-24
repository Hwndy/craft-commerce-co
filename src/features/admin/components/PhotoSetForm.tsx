import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp } from "lucide-react";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

import {
  useAddPhoto,
  useCreatePhotoSet,
  useDeletePhotoSet,
  usePhotosForSet,
  useRemovePhoto,
  useReorderPhoto,
  useUpdatePhoto,
  useUpdatePhotoSet,
  type AdminPhotoRow,
  type AdminPhotoSetRow,
} from "../lib/adminPhotos";
import { useUnsavedChangesWarning } from "../lib/useUnsavedChangesWarning";
import { MediaUploadField } from "./MediaUploadField";

const metaSchema = z.object({
  title: z.string().min(1, "Title is required"),
  location: z.string(),
  shootDate: z.string(),
});

const editSchema = metaSchema.extend({ published: z.boolean() });
type EditValues = z.infer<typeof editSchema>;

function toDefaults(photoSet?: AdminPhotoSetRow): EditValues {
  return {
    title: photoSet?.title ?? "",
    location: photoSet?.location ?? "",
    shootDate: photoSet?.shootDate ?? "",
    published: photoSet?.published ?? false,
  };
}

export interface PhotoSetFormProps {
  /** Undefined = create mode (title/location/date only, no photos section
   * yet — see the two-step design below). Defined = edit mode. */
  photoSet?: AdminPhotoSetRow;
  /** Fires once create succeeds, with the real created row — AdminPhotos.tsx
   * then re-renders this same drawer with `photoSet` set, switching this
   * component into edit mode (remounted fresh via a changed `key`). */
  onCreated: (photoSet: AdminPhotoSetRow) => void;
  onClose: () => void;
}

export interface PhotoSetFormHandle {
  confirmClose: () => boolean;
}

/**
 * T6's photo set create/edit form (FR-7.3). A brand-new set only gets the
 * bare metadata fields and a Save button — no photos section yet, because
 * MediaUploadField needs a real, stable `photos/<setId>/...` storage
 * prefix, which doesn't exist until the set row itself does. Same
 * two-step shape as T5's ProductForm.tsx.
 *
 * Unlike products, every photo upload here writes immediately (useAddPhoto
 * inserts as soon as MediaUploadField reports a ready mediaId) — there's
 * no single poster/video field deferred to Save, so there's no
 * mediaWorkPending-blocks-Save class of race to guard against; the whole
 * photos section behaves like T5's own gallery-pictures field, which has
 * the same "writes immediately" shape.
 */
export const PhotoSetForm = forwardRef<PhotoSetFormHandle, PhotoSetFormProps>(function PhotoSetForm(
  { photoSet, onCreated, onClose },
  ref
) {
  const isEditing = !!photoSet;
  const createPhotoSet = useCreatePhotoSet();
  const updatePhotoSet = useUpdatePhotoSet();
  const deletePhotoSet = useDeletePhotoSet();
  const addPhoto = useAddPhoto();
  const removePhoto = useRemovePhoto();
  const updatePhoto = useUpdatePhoto();
  const reorderPhoto = useReorderPhoto(photoSet?.id ?? "");
  const {
    data: photos,
    isError: photosError,
    refetch: refetchPhotos,
  } = usePhotosForSet(photoSet?.id);

  const form = useForm<EditValues>({
    resolver: zodResolver(isEditing ? editSchema : metaSchema.extend({ published: z.boolean() })),
    defaultValues: toDefaults(photoSet),
  });
  const { confirmIfDirty } = useUnsavedChangesWarning(form.formState.isDirty);

  useImperativeHandle(ref, () => ({ confirmClose: confirmIfDirty }));

  async function onSubmit(values: EditValues) {
    const location = values.location.trim() || null;
    const shootDate = values.shootDate.trim() || null;

    try {
      if (!isEditing) {
        const created = await createPhotoSet.mutateAsync({ title: values.title, location, shootDate });
        // Resets the dirty baseline to the saved row — without this, the
        // typed-in values stay the form's own "dirty" baseline forever
        // (RHF's defaultValues were fixed at mount, before there was a
        // real row to default to), so closing right after a create would
        // wrongly prompt "unsaved changes?" (found in review, CodeRabbit).
        form.reset(toDefaults(created));
        onCreated(created);
        return;
      }

      await updatePhotoSet.mutateAsync({
        id: photoSet.id,
        title: values.title,
        location,
        shootDate,
        published: values.published,
      });
      onClose();
    } catch {
      // The mutation's own onError already toasts; this just stops the
      // rejection from escaping handleSubmit and leaves the drawer open
      // so the admin can retry (found in review, CodeRabbit).
    }
  }

  async function onDelete() {
    if (!photoSet) return;
    try {
      await deletePhotoSet.mutateAsync(photoSet.id);
      onClose();
    } catch {
      // Same reasoning as onSubmit's own catch above.
    }
  }

  function movePhoto(id: string, direction: "up" | "down") {
    if (!photos) return;
    reorderPhoto.mutate({ photos, id, direction });
  }

  function handleClose() {
    if (confirmIfDirty()) onClose();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-1">
        <div className="space-y-1">
          <label htmlFor="photoset-title" className="text-sm font-medium">
            Title
          </label>
          <Input id="photoset-title" {...form.register("title")} />
          {form.formState.errors.title && (
            <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="photoset-location" className="text-sm font-medium">
            Location
          </label>
          <Input id="photoset-location" {...form.register("location")} />
        </div>

        <div className="space-y-1">
          <label htmlFor="photoset-shoot-date" className="text-sm font-medium">
            Shoot date
          </label>
          <Input id="photoset-shoot-date" type="date" {...form.register("shootDate")} />
        </div>

        {isEditing && (
          <>
            <label className="flex items-center justify-between">
              <span className="text-sm font-medium">Published</span>
              <Switch
                checked={form.watch("published")}
                onCheckedChange={(checked) => form.setValue("published", checked, { shouldDirty: true })}
              />
            </label>

            <div className="space-y-2 border-t border-border pt-4">
              <span className="text-sm font-medium">Photos</span>
              {photosError ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                  <p className="text-destructive">Couldn't load photos.</p>
                  <Button
                    type="button"
                    variant="pill-outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => refetchPhotos()}
                  >
                    Try again
                  </Button>
                </div>
              ) : (
                photos &&
                photos.length > 0 && (
                  <ul className="space-y-2">
                    {photos.map((photo, index) => (
                      <PhotoListItem
                        key={photo.id}
                        photo={photo}
                        isFirst={index === 0}
                        isLast={index === photos.length - 1}
                        isReordering={reorderPhoto.isPending}
                        onMove={(direction) => movePhoto(photo.id, direction)}
                        onRemove={() => removePhoto.mutate({ id: photo.id, setId: photoSet.id })}
                        onSave={(values) => updatePhoto.mutate({ id: photo.id, setId: photoSet.id, ...values })}
                      />
                    ))}
                  </ul>
                )
              )}
              <MediaUploadField
                kind="image"
                storagePrefix={`photos/${photoSet.id}`}
                altText={form.watch("title")}
                onMediaReady={({ mediaId, file }) =>
                  addPhoto.mutate({
                    setId: photoSet.id,
                    mediaId,
                    title: file.name.replace(/\.[^.]+$/, ""),
                    takenOn: null,
                  })
                }
              />
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border p-4">
        {isEditing ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="pill-outline">
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete "{photoSet.title}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the set and its photos from the gallery and the board. This can't be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onDelete}>
                  Yes, delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button type="button" variant="pill-outline" onClick={handleClose}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="pill" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
});

interface PhotoListItemProps {
  photo: AdminPhotoRow;
  isFirst: boolean;
  isLast: boolean;
  /** Disables both move buttons while a reorder request is in flight —
   * each click sends the whole list's new order, and two quick clicks
   * sent before the first resolves aren't serialised, so the stored
   * order could end up different from what the admin last saw (found in
   * review, CodeRabbit, PR #38, on T5's identically-shaped reorder
   * buttons; applied here from the start). */
  isReordering: boolean;
  onMove: (direction: "up" | "down") => void;
  onRemove: () => void;
  onSave: (values: { title: string; takenOn: string | null }) => void;
}

function PhotoListItem({ photo, isFirst, isLast, isReordering, onMove, onRemove, onSave }: PhotoListItemProps) {
  const [title, setTitle] = useState(photo.title);
  const [takenOn, setTakenOn] = useState(photo.takenOn ?? "");
  // Tracks the last value *sent* to onSave, not the last value the query
  // cache happened to have fetched. useUpdatePhoto doesn't update the
  // cache optimistically, so `photo.title` stays unchanged until the
  // write round-trips; comparing against it meant typing A -> B -> A
  // again before that refetch landed made the second blur look like a
  // no-op, silently leaving "B" saved while the input showed "A" (found
  // in review, CodeRabbit).
  const lastSentRef = useRef({ title: photo.title, takenOn: photo.takenOn });

  function commit() {
    const nextTakenOn = takenOn.trim() || null;
    if (title !== lastSentRef.current.title || nextTakenOn !== lastSentRef.current.takenOn) {
      lastSentRef.current = { title, takenOn: nextTakenOn };
      onSave({ title, takenOn: nextTakenOn });
    }
  }

  return (
    <li className="flex items-center gap-2 rounded-md border border-border p-2">
      <div className="min-w-0 flex-1 space-y-1">
        <Input
          aria-label="Photo title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={commit}
        />
        <Input
          aria-label="Taken on"
          type="date"
          value={takenOn}
          onChange={(event) => setTakenOn(event.target.value)}
          onBlur={commit}
        />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="pill-outline"
          size="icon"
          aria-label={`Move "${photo.title}" up`}
          disabled={isFirst || isReordering}
          onClick={() => onMove("up")}
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="pill-outline"
          size="icon"
          aria-label={`Move "${photo.title}" down`}
          disabled={isLast || isReordering}
          onClick={() => onMove("down")}
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
        <Button type="button" variant="pill-outline" size="sm" onClick={onRemove}>
          Remove
        </Button>
      </div>
    </li>
  );
}
