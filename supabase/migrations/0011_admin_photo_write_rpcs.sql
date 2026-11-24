-- Migration 0011_admin_photo_write_rpcs (Phase 4 T6)
--
-- Phase 4 T5's own review (PR #38, CodeRabbit) found that sequential
-- supabase-js writes used to persist an up/down reorder (one .update()
-- call per moved row) aren't atomic: a failure after the first call
-- commits leaves two rows sharing one sort_order until the next reorder
-- click self-heals it. That task's own follow-up, migration
-- 0010_admin_product_write_rpcs.sql (PR #38, merged to main first —
-- this migration was numbered 0010 too while both PRs were still open,
-- and renumbered to 0011 on rebase, per docs/decisions.md D-64's own
-- 0004 renumbering precedent), added a `reorder_products` RPC wrapping
-- the whole list's rewrite in one statement. T6 applies that same
-- pattern from the start, for both admin reorder operations it needs:
-- the photo sets list, and the photos within one set.
--
-- `security invoker` (the implicit default, named explicitly): each
-- function runs as whichever role calls it, so the existing admin RLS on
-- `photo_sets`/`photos` (migration 0002, `for all to authenticated using
-- (is_admin()) with check (is_admin())`) applies to the statement inside
-- exactly as if the client had called `.from(...).update(...)` directly —
-- this adds atomicity across rows, not a new privilege. `set search_path
-- = public` pins the schema search path (same defence every function in
-- this codebase already applies). `revoke ... from anon` is explicit:
-- migration 0004's own precedent — a fresh Supabase project's bootstrap
-- grants EXECUTE on every new function to anon/authenticated/service_role
-- directly (ALTER DEFAULT PRIVILEGES), not just PUBLIC.

-- Both functions also reject a partial match (found in review,
-- CodeRabbit): if one of p_ids was deleted, or no longer visible under
-- RLS, since the list the client sent the call from was built, the
-- UPDATE just matches fewer rows and still returns success — the admin
-- would see "reordered" for a swap that wasn't actually fully applied.
-- Comparing the matched row count against cardinality(p_ids) and raising
-- turns that into a normal failure the client already retries from a
-- fresh fetch, same as any other RPC error.

create or replace function public.reorder_photo_sets(p_ids uuid[], p_sort_orders int[]) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_matched int;
begin
  if array_length(p_ids, 1) is distinct from array_length(p_sort_orders, 1) then
    raise exception 'p_ids and p_sort_orders must be the same length';
  end if;

  update public.photo_sets p
  set sort_order = u.sort_order
  from unnest(p_ids, p_sort_orders) as u(id, sort_order)
  where p.id = u.id;

  get diagnostics v_matched = row_count;
  if v_matched != cardinality(p_ids) then
    raise exception 'reorder_photo_sets matched % of % rows', v_matched, cardinality(p_ids);
  end if;
end;
$$;

create or replace function public.reorder_photos(p_ids uuid[], p_sort_orders int[]) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_matched int;
begin
  if array_length(p_ids, 1) is distinct from array_length(p_sort_orders, 1) then
    raise exception 'p_ids and p_sort_orders must be the same length';
  end if;

  update public.photos p
  set sort_order = u.sort_order
  from unnest(p_ids, p_sort_orders) as u(id, sort_order)
  where p.id = u.id;

  get diagnostics v_matched = row_count;
  if v_matched != cardinality(p_ids) then
    raise exception 'reorder_photos matched % of % rows', v_matched, cardinality(p_ids);
  end if;
end;
$$;

revoke all on function public.reorder_photo_sets(uuid[], int[]) from public, anon;
grant execute on function public.reorder_photo_sets(uuid[], int[]) to authenticated;

revoke all on function public.reorder_photos(uuid[], int[]) from public, anon;
grant execute on function public.reorder_photos(uuid[], int[]) to authenticated;
