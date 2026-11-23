import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

import { reorderSwap } from "./reorderSwap";
import { useOptimisticMutation } from "./useOptimisticMutation";

export const ADMIN_PHOTO_SETS_QUERY_KEY = ["admin", "photo-sets"] as const;

export interface AdminPhotoSetRow {
  id: string;
  title: string;
  location: string | null;
  shootDate: string | null;
  sortOrder: number;
  published: boolean;
}

type PhotoSetRow = Database["public"]["Tables"]["photo_sets"]["Row"];

function mapPhotoSetRow(row: PhotoSetRow): AdminPhotoSetRow {
  return {
    id: row.id,
    title: row.title,
    location: row.location,
    shootDate: row.shoot_date,
    sortOrder: row.sort_order,
    published: row.published,
  };
}

/** Every photo set, published or not — unlike the public Collage's own
 * fetchCollagePhotos() (shop/lib/queries.ts's sibling for the gallery),
 * which only ever reads published sets. The admin list needs to see and
 * manage drafts too. */
export function useAdminPhotoSets() {
  return useQuery({
    queryKey: ADMIN_PHOTO_SETS_QUERY_KEY,
    queryFn: async (): Promise<AdminPhotoSetRow[]> => {
      const { data, error } = await supabase.from("photo_sets").select("*").order("sort_order").order("id");
      if (error) throw error;
      return (data ?? []).map(mapPhotoSetRow);
    },
  });
}

/** Same reasoning as T5's adminProducts.ts `nextSortOrder()`: without
 * this, every newly created set would share the column's own `0` default,
 * and reorderSwap() would see both ends already equal. New sets go to the
 * end of the real order instead. */
async function nextPhotoSetSortOrder(): Promise<number> {
  const { data, error } = await supabase
    .from("photo_sets")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data?.[0]?.sort_order ?? -1) + 1;
}

export interface CreatePhotoSetInput {
  title: string;
  location: string | null;
  shootDate: string | null;
}

/** Creates the bare set row only — no `published` yet (an empty set with
 * no photos is a valid, if pointless, published entry per this task's own
 * chosen default; see docs/decisions.md), no photos section yet either,
 * since MediaUploadField's `photos/<setId>/...` storage prefix needs a
 * real id first. `AdminPhotos.tsx` reopens the drawer in edit mode for the
 * created row, same two-step shape as T5's own ProductForm. Single
 * insert — no second table to keep in sync, so no RPC needed here (unlike
 * T5's products+canvas_nodes create). */
export function useCreatePhotoSet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePhotoSetInput): Promise<AdminPhotoSetRow> => {
      const sortOrder = await nextPhotoSetSortOrder();
      const { data, error } = await supabase
        .from("photo_sets")
        .insert({
          title: input.title,
          location: input.location,
          shoot_date: input.shootDate,
          published: false,
          sort_order: sortOrder,
        })
        .select()
        .single();
      if (error) throw error;
      return mapPhotoSetRow(data);
    },
    onSuccess: (created) => {
      queryClient.setQueryData<AdminPhotoSetRow[]>(ADMIN_PHOTO_SETS_QUERY_KEY, (previous) => [
        ...(previous ?? []),
        created,
      ]);
    },
    onError: () => {
      toast("Couldn't create the photo set — please try again.");
    },
  });
}

export interface UpdatePhotoSetInput {
  id: string;
  title: string;
  location: string | null;
  shootDate: string | null;
  published: boolean;
}

/** A single update — no linked row to keep in sync (photo_sets has
 * nothing equivalent to products' canvas_nodes row), so this is already
 * atomic as one statement. */
export function useUpdatePhotoSet() {
  return useOptimisticMutation<AdminPhotoSetRow, UpdatePhotoSetInput, AdminPhotoSetRow[]>({
    queryKey: ADMIN_PHOTO_SETS_QUERY_KEY,
    mutationFn: async (input) => {
      const { data, error } = await supabase
        .from("photo_sets")
        .update({
          title: input.title,
          location: input.location,
          shoot_date: input.shootDate,
          published: input.published,
        })
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return mapPhotoSetRow(data);
    },
    updateCache: (previous, variables) =>
      (previous ?? []).map((item) => (item.id === variables.id ? { ...item, ...variables } : item)),
    errorMessage: () => "Couldn't save the change — please try again.",
  });
}

/** Deletes the set row only — `photos.set_id references photo_sets(id)
 * on delete cascade` (migration 0002) already removes its photos rows in
 * the same statement, so this is atomic without an RPC. The underlying
 * `media` rows/Storage files are left behind, same documented, accepted
 * gap as T5's own useDeleteProduct (docs/decisions.md D-85) — Storage
 * cleanup stays a manual, owner-invoked concern. */
export function useDeletePhotoSet() {
  return useOptimisticMutation<string, string, AdminPhotoSetRow[]>({
    queryKey: ADMIN_PHOTO_SETS_QUERY_KEY,
    mutationFn: async (id) => {
      const { error } = await supabase.from("photo_sets").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    updateCache: (previous, id) => (previous ?? []).filter((item) => item.id !== id),
    errorMessage: () => "Couldn't delete the photo set — please try again.",
  });
}

export interface ReorderPhotoSetVariables {
  photoSets: AdminPhotoSetRow[];
  id: string;
  direction: "up" | "down";
}

function applyPhotoSetSwap(
  previous: AdminPhotoSetRow[] | undefined,
  variables: ReorderPhotoSetVariables
): AdminPhotoSetRow[] {
  const swap = reorderSwap(variables.photoSets, variables.id, variables.direction);
  if (!swap) return previous ?? [];
  return (previous ?? [])
    .map((item) => {
      const match = swap.find((s) => s.id === item.id);
      return match ? { ...item, sortOrder: match.sortOrder } : item;
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** One call to migration 0011's `reorder_photo_sets` RPC, whatever the
 * size of `swap` (reorderSwap() always renumbers the whole list by new
 * position) — a single `update ... from unnest(...)` statement
 * server-side, so a partial write is never possible. */
export function useReorderPhotoSet() {
  return useOptimisticMutation<ReturnType<typeof reorderSwap>, ReorderPhotoSetVariables, AdminPhotoSetRow[]>({
    queryKey: ADMIN_PHOTO_SETS_QUERY_KEY,
    mutationFn: async (variables) => {
      const swap = reorderSwap(variables.photoSets, variables.id, variables.direction);
      if (!swap) return null;

      const { error } = await supabase.rpc("reorder_photo_sets", {
        p_ids: swap.map((s) => s.id),
        p_sort_orders: swap.map((s) => s.sortOrder),
      });
      if (error) throw error;

      return swap;
    },
    updateCache: applyPhotoSetSwap,
    errorMessage: () => "Couldn't reorder the photo sets — please try again.",
  });
}

export interface AdminPhotoRow {
  id: string;
  setId: string;
  mediaId: string;
  title: string;
  takenOn: string | null;
  sortOrder: number;
}

type PhotoRow = Database["public"]["Tables"]["photos"]["Row"];

function mapPhotoRow(row: PhotoRow): AdminPhotoRow {
  return {
    id: row.id,
    setId: row.set_id,
    mediaId: row.media_id,
    title: row.title,
    takenOn: row.taken_on,
    sortOrder: row.sort_order,
  };
}

export const ADMIN_PHOTOS_QUERY_KEY = (setId: string) => ["admin", "photos", setId] as const;

/** Every photo in one set, in sort order — only fetched once a set
 * exists (PhotoSetForm doesn't call this during the no-photos create
 * step). */
export function usePhotosForSet(setId: string | undefined) {
  return useQuery({
    queryKey: ADMIN_PHOTOS_QUERY_KEY(setId ?? ""),
    queryFn: async (): Promise<AdminPhotoRow[]> => {
      const { data, error } = await supabase
        .from("photos")
        .select("*")
        .eq("set_id", setId as string)
        .order("sort_order")
        .order("id");
      if (error) throw error;
      return (data ?? []).map(mapPhotoRow);
    },
    enabled: !!setId,
  });
}

export interface AddPhotoInput {
  setId: string;
  mediaId: string;
  title: string;
  takenOn: string | null;
  sortOrder: number;
}

/** Adds one photo. Not run through useOptimisticMutation: the real
 * `photos` row id (needed to remove/reorder it again later) only exists
 * after the insert succeeds — same reasoning as T5's own
 * useAddProductPicture. */
export function useAddPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddPhotoInput) => {
      const { error } = await supabase.from("photos").insert({
        set_id: input.setId,
        media_id: input.mediaId,
        title: input.title,
        taken_on: input.takenOn,
        sort_order: input.sortOrder,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ADMIN_PHOTOS_QUERY_KEY(variables.setId) });
    },
    onError: () => {
      toast("Couldn't add that photo — please try again.");
    },
  });
}

export interface UpdatePhotoInput {
  id: string;
  setId: string;
  title: string;
  takenOn: string | null;
}

/** Edits a photo's own title/date — a single update, no media change. */
export function useUpdatePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdatePhotoInput) => {
      const { error } = await supabase
        .from("photos")
        .update({ title: input.title, taken_on: input.takenOn })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ADMIN_PHOTOS_QUERY_KEY(variables.setId) });
    },
    onError: () => {
      toast("Couldn't save that change — please try again.");
    },
  });
}

/** Removes one photo row. The underlying `media` row/Storage file is
 * left, same documented, accepted gap as useDeletePhotoSet's own
 * comment. */
export function useRemovePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; setId: string }) => {
      const { error } = await supabase.from("photos").delete().eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ADMIN_PHOTOS_QUERY_KEY(variables.setId) });
    },
    onError: () => {
      toast("Couldn't remove that photo — please try again.");
    },
  });
}

export interface ReorderPhotoVariables {
  photos: AdminPhotoRow[];
  id: string;
  direction: "up" | "down";
}

function applyPhotoSwap(previous: AdminPhotoRow[] | undefined, variables: ReorderPhotoVariables): AdminPhotoRow[] {
  const swap = reorderSwap(variables.photos, variables.id, variables.direction);
  if (!swap) return previous ?? [];
  return (previous ?? [])
    .map((item) => {
      const match = swap.find((s) => s.id === item.id);
      return match ? { ...item, sortOrder: match.sortOrder } : item;
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Takes `setId` as its own parameter (same shape as usePhotosForSet),
 * not inside the mutation's variables — a caller already knows which
 * set's photos it's reordering for this hook instance's whole lifetime
 * (PhotoSetForm's own `product`-style prop), so the query key
 * useOptimisticMutation needs can be fixed per instance, same pattern as
 * useReorderPhotoSet()/T5's useReorderProduct(). One call to migration
 * 0011's `reorder_photos` RPC. */
export function useReorderPhoto(setId: string) {
  return useOptimisticMutation<ReturnType<typeof reorderSwap>, ReorderPhotoVariables, AdminPhotoRow[]>({
    queryKey: ADMIN_PHOTOS_QUERY_KEY(setId),
    mutationFn: async (variables) => {
      const swap = reorderSwap(variables.photos, variables.id, variables.direction);
      if (!swap) return null;

      const { error } = await supabase.rpc("reorder_photos", {
        p_ids: swap.map((s) => s.id),
        p_sort_orders: swap.map((s) => s.sortOrder),
      });
      if (error) throw error;

      return swap;
    },
    updateCache: applyPhotoSwap,
    errorMessage: () => "Couldn't reorder the photos — please try again.",
  });
}
