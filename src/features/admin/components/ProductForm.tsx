import { zodResolver } from "@hookform/resolvers/zod";
import { Minus, Plus } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import {
  useAddProductPicture,
  useCreateProduct,
  useDeleteProduct,
  useProductPictures,
  useRemoveProductPicture,
  useUpdateProduct,
  type AdminProductRow,
  type ProductStatus,
  type ProductZone,
} from "../lib/adminProducts";
import { uploadImageMedia } from "../lib/image-pipeline";
import { useUnsavedChangesWarning } from "../lib/useUnsavedChangesWarning";
import { captureVideoFrame } from "../lib/video-upload";
import { MediaUploadField } from "./MediaUploadField";

const STATUS_OPTIONS: { value: ProductStatus; label: string }[] = [
  { value: "available", label: "Available" },
  { value: "made_to_order", label: "Made to order" },
  { value: "sold", label: "Sold" },
];

const ZONE_OPTIONS: { value: ProductZone; label: string }[] = [
  { value: "wall", label: "Wall" },
  { value: "floor", label: "Floor" },
];

const metaSchema = z.object({
  name: z.string().min(1, "Name is required"),
  priceAmount: z.coerce.number().positive("Price must be greater than zero"),
  description: z.string(),
  bullets: z.array(z.object({ value: z.string().min(1, "Bullet can't be empty") })),
  status: z.enum(["available", "sold", "made_to_order"]),
  zone: z.enum(["wall", "floor"]),
  onSale: z.boolean(),
});
type MetaValues = z.infer<typeof metaSchema>;

// Edit mode adds the two fields a brand-new product doesn't have yet:
// a real slug (auto-derived at create time, below) and published (not
// offered during create — a product with no poster yet shouldn't be
// publishable; see the component doc comment).
const editSchema = metaSchema.extend({
  slug: z.string().min(1, "Slug is required"),
  published: z.boolean(),
});
type EditValues = z.infer<typeof editSchema>;

function toMetaDefaults(product?: AdminProductRow): MetaValues {
  return {
    name: product?.name ?? "",
    priceAmount: product?.priceAmount ?? 0,
    description: product?.description ?? "",
    bullets: (product?.bullets ?? []).map((value) => ({ value })),
    status: product?.status ?? "available",
    zone: product?.zone ?? "floor",
    onSale: product?.onSale ?? false,
  };
}

export interface ProductFormProps {
  /** Undefined = create mode (name/price/etc only, no media section —
   * see the two-step design below). Defined = edit mode. */
  product?: AdminProductRow;
  /** Fires once create succeeds, with the real created row — AdminProducts.tsx
   * then re-renders this same drawer with `product` set, switching this
   * component straight into edit mode (remounted fresh via a changed `key`,
   * so there's no in-component create→edit transition state to manage here). */
  onCreated: (product: AdminProductRow) => void;
  onClose: () => void;
}

export interface ProductFormHandle {
  /** True = the caller may close/unmount this form now (either clean, or
   * the admin confirmed discarding changes). False = keep it open —
   * found in review (CodeRabbit, PR #38): AdminProducts.tsx's drawer can
   * also be dismissed by the Sheet's own X/Escape/overlay click, none of
   * which went through this form's own confirmIfDirty() before this. */
  confirmClose: () => boolean;
}

/**
 * T5's product create/edit form (FR-7.2). A brand-new product only gets
 * the bare metadata fields and a Save button — no MediaUploadField section
 * yet, because MediaUploadField needs a real, stable `products/<id>/...`
 * storage prefix, which doesn't exist until the product row itself does.
 * Saving that minimal form creates the product (useCreateProduct, which
 * also creates its matching canvas_nodes row — see docs/decisions.md on
 * this task) and hands the real row back via `onCreated`; AdminProducts.tsx
 * then reopens this same drawer in edit mode for that id, where the poster/
 * gallery/video sections — and `published` — become available. This avoids
 * orphaned Storage uploads for a "new product" draft the admin abandons
 * without saving, since nothing can be uploaded before the product exists.
 */
export const ProductForm = forwardRef<ProductFormHandle, ProductFormProps>(function ProductForm(
  { product, onCreated, onClose },
  ref
) {
  const isEditing = !!product;
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const addPicture = useAddProductPicture();
  const removePicture = useRemoveProductPicture();
  const { data: pictures } = useProductPictures(product?.id);

  const [posterMediaId, setPosterMediaId] = useState<string | null>(product?.posterMediaId ?? null);
  const [videoMediaId, setVideoMediaId] = useState<string | null>(product?.videoMediaId ?? null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [capturingPoster, setCapturingPoster] = useState(false);
  // One flag per MediaUploadField instance — true while that field's own
  // queue still has something decoding/uploading/inserting. Found in
  // review (CodeRabbit, PR #38): without this, clicking Save right after
  // starting an upload could submit before the real mediaId existed,
  // closing the form with the upload's own result then landing nowhere.
  const [posterUploadPending, setPosterUploadPending] = useState(false);
  const [pictureUploadPending, setPictureUploadPending] = useState(false);
  const [videoUploadPending, setVideoUploadPending] = useState(false);
  const mediaWorkPending = capturingPoster || posterUploadPending || pictureUploadPending || videoUploadPending;
  const videoRef = useRef<HTMLVideoElement>(null);

  // The uploaded video's own File, kept only so the admin can scrub a
  // native <video> preview and capture a frame from it locally — never
  // re-uploaded, just read via a local blob: URL. Revoked whenever it's
  // replaced or the form unmounts, same hygiene as any other object URL.
  useEffect(() => {
    return () => {
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    };
  }, [videoPreviewUrl]);

  const form = useForm<EditValues>({
    resolver: zodResolver(isEditing ? editSchema : metaSchema.extend({ slug: z.string(), published: z.boolean() })),
    defaultValues: {
      ...toMetaDefaults(product),
      slug: product?.slug ?? "",
      published: product?.published ?? false,
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "bullets" });
  // form.formState.isDirty only tracks the react-hook-form fields —
  // posterMediaId/videoMediaId are plain component state (driven by async
  // upload callbacks, not typed fields), so a poster/video attached but
  // not yet Saved wouldn't otherwise count as a real unsaved change
  // (found in review, CodeRabbit, PR #38).
  const mediaIsDirty =
    posterMediaId !== (product?.posterMediaId ?? null) || videoMediaId !== (product?.videoMediaId ?? null);
  // mediaWorkPending (an upload still decoding/uploading, or a frame
  // capture in progress) is included too — found in review (CodeRabbit,
  // PR #38): mediaIsDirty only flips once an upload's own onMediaReady
  // fires, so closing the drawer in the gap between "upload started" and
  // "upload finished" skipped the warning entirely, and the eventual
  // result had nowhere left to land.
  const { confirmIfDirty } = useUnsavedChangesWarning(form.formState.isDirty || mediaIsDirty || mediaWorkPending);

  useImperativeHandle(ref, () => ({ confirmClose: confirmIfDirty }));

  async function onSubmit(values: EditValues) {
    const bullets = values.bullets.map((b) => b.value);

    if (!isEditing) {
      const created = await createProduct.mutateAsync({
        name: values.name,
        priceAmount: values.priceAmount,
        description: values.description || null,
        bullets,
        status: values.status,
        zone: values.zone,
        onSale: values.onSale,
      });
      onCreated(created);
      return;
    }

    await updateProduct.mutateAsync({
      id: product.id,
      name: values.name,
      slug: values.slug,
      priceAmount: values.priceAmount,
      description: values.description || null,
      bullets,
      status: values.status,
      zone: values.zone,
      onSale: values.onSale,
      published: values.published,
      posterMediaId,
      videoMediaId,
    });
    onClose();
  }

  async function onDelete() {
    if (!product) return;
    await deleteProduct.mutateAsync(product.id);
    onClose();
  }

  async function captureFrameAsPoster() {
    if (!videoRef.current || !product) return;
    setCapturingPoster(true);
    try {
      const frameFile = await captureVideoFrame(videoRef.current);
      const result = await uploadImageMedia({ file: frameFile, storagePrefix: `products/${product.id}/poster` });
      setPosterMediaId(result.mediaId);
    } catch {
      // uploadImageMedia/captureVideoFrame already report their own
      // specific failure via MediaUploadField's own toast convention
      // elsewhere; this path has no progress UI to report through, so a
      // plain console warning is the honest "something went wrong, try
      // the ordinary upload instead" signal rather than a silent no-op.
      console.warn("Couldn't capture a poster frame from the video.");
    } finally {
      setCapturingPoster(false);
    }
  }

  function handleClose() {
    if (confirmIfDirty()) onClose();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-1">
        <div className="space-y-1">
          <label htmlFor="product-name" className="text-sm font-medium">
            Name
          </label>
          <Input id="product-name" {...form.register("name")} />
          {form.formState.errors.name && (
            <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
          )}
        </div>

        {isEditing && (
          <div className="space-y-1">
            <label htmlFor="product-slug" className="text-sm font-medium">
              Slug
            </label>
            <Input id="product-slug" {...form.register("slug")} />
            {form.formState.errors.slug && (
              <p className="text-sm text-destructive">{form.formState.errors.slug.message}</p>
            )}
          </div>
        )}

        <div className="space-y-1">
          <label htmlFor="product-price" className="text-sm font-medium">
            Price (GBP)
          </label>
          <Input id="product-price" type="number" step="0.01" min="0" {...form.register("priceAmount")} />
          {form.formState.errors.priceAmount && (
            <p className="text-sm text-destructive">{form.formState.errors.priceAmount.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="product-description" className="text-sm font-medium">
            Description
          </label>
          <Textarea id="product-description" rows={3} {...form.register("description")} />
        </div>

        <div className="space-y-2">
          <span className="text-sm font-medium">Bullet points</span>
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-center gap-2">
              <Input {...form.register(`bullets.${index}.value` as const)} />
              <Button type="button" variant="pill-outline" size="icon" aria-label="Remove bullet" onClick={() => remove(index)}>
                <Minus className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="pill-outline" size="sm" onClick={() => append({ value: "" })}>
            <Plus className="h-4 w-4" /> Add bullet
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <span className="text-sm font-medium">Status</span>
            <Select
              value={form.watch("status")}
              onValueChange={(value) => form.setValue("status", value as ProductStatus, { shouldDirty: true })}
            >
              <SelectTrigger aria-label="Status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <span className="text-sm font-medium">Zone</span>
            <Select
              value={form.watch("zone")}
              onValueChange={(value) => form.setValue("zone", value as ProductZone, { shouldDirty: true })}
            >
              <SelectTrigger aria-label="Zone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ZONE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <label className="flex items-center justify-between">
          <span className="text-sm font-medium">On sale</span>
          <Switch
            checked={form.watch("onSale")}
            onCheckedChange={(checked) => form.setValue("onSale", checked, { shouldDirty: true })}
          />
        </label>

        {isEditing && (
          <>
            <label className="flex items-center justify-between">
              <span className="text-sm font-medium">Published</span>
              <Switch
                checked={form.watch("published")}
                // D-85's own stated intent ("a product with no poster
                // shouldn't be publishable") was never actually enforced
                // in the UI — found in review (CodeRabbit, PR #38).
                disabled={!posterMediaId}
                onCheckedChange={(checked) => form.setValue("published", checked, { shouldDirty: true })}
              />
            </label>
            {!posterMediaId && (
              <p className="text-xs text-muted-foreground">Add a poster picture below before publishing.</p>
            )}

            <div className="space-y-2 border-t border-border pt-4">
              <span className="text-sm font-medium">Poster picture</span>
              {posterMediaId && <p className="text-xs text-muted-foreground">Poster set (media {posterMediaId}).</p>}
              <MediaUploadField
                kind="image"
                storagePrefix={`products/${product.id}/poster`}
                altText={form.watch("name")}
                onMediaReady={({ mediaId }) => setPosterMediaId(mediaId)}
                onPendingChange={setPosterUploadPending}
                disabled={form.formState.isSubmitting}
              />
            </div>

            <div className="space-y-2 border-t border-border pt-4">
              <span className="text-sm font-medium">Gallery pictures</span>
              {pictures && pictures.length > 0 && (
                <ul className="space-y-1">
                  {pictures.map((picture) => (
                    <li key={picture.id} className="flex items-center justify-between text-sm">
                      <span>Picture (media {picture.mediaId})</span>
                      <Button
                        type="button"
                        variant="pill-outline"
                        size="sm"
                        onClick={() => removePicture.mutate({ id: picture.id, productId: product.id })}
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <MediaUploadField
                kind="image"
                storagePrefix={`products/${product.id}/pictures`}
                altText={form.watch("name")}
                onMediaReady={({ mediaId }) =>
                  addPicture.mutate({ productId: product.id, mediaId, sortOrder: pictures?.length ?? 0 })
                }
                onPendingChange={setPictureUploadPending}
              />
            </div>

            <div className="space-y-2 border-t border-border pt-4">
              <span className="text-sm font-medium">Turntable video</span>
              <MediaUploadField
                kind="video"
                storagePrefix={`products/${product.id}/video`}
                onMediaReady={({ mediaId, file }) => {
                  setVideoMediaId(mediaId);
                  if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
                  setVideoPreviewUrl(URL.createObjectURL(file));
                }}
                onPendingChange={setVideoUploadPending}
                disabled={form.formState.isSubmitting}
              />
              {videoPreviewUrl && (
                <div className="space-y-2">
                  {/* A locally-scrubbed upload preview, never shown to a real site visitor — no captions track needed. */}
                  <video ref={videoRef} src={videoPreviewUrl} controls muted className="w-full rounded-md" />
                  {!posterMediaId && (
                    <Button type="button" variant="pill-outline" size="sm" disabled={capturingPoster} onClick={captureFrameAsPoster}>
                      {capturingPoster ? "Capturing…" : "Capture this frame as the poster"}
                    </Button>
                  )}
                </div>
              )}
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
                <AlertDialogTitle>Delete "{product.name}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the product from the shop and the board. This can't be undone.
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
        <Button type="submit" variant="pill" disabled={form.formState.isSubmitting || mediaWorkPending}>
          {mediaWorkPending ? "Waiting for uploads…" : form.formState.isSubmitting ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
});
