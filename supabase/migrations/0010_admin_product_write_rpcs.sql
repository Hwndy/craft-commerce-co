-- Migration 0010_admin_product_write_rpcs (Phase 4 T5 follow-up)
--
-- PR #38 review (CodeRabbit) found that adminProducts.ts's useCreateProduct,
-- useUpdateProduct, useDeleteProduct and useReorderProduct each make two or
-- more sequential supabase-js/PostgREST calls that aren't atomic: a failure
-- after the first call commits leaves the products row and its matching
-- canvas_nodes row (or, for reorder, two products rows) inconsistent.
-- docs/decisions.md D-85's "Update" section accepted this as a known gap
-- rather than inventing a transaction mechanism unreviewed, mid-PR, for a
-- pattern no part of this codebase used yet (every other write path here is
-- a direct client call under RLS) — and flagged a dedicated Postgres RPC,
-- wrapping each operation in a real server-side transaction, as the proper
-- follow-up. This migration is that follow-up.
--
-- Each function below wraps one of those four operations in a single
-- plpgsql function body: if any statement inside raises, the whole function
-- aborts and nothing it already wrote is kept — the same guarantee a single
-- SQL statement already has, just extended across the two (or more)
-- statements each operation needs. None of them are `security definer`:
-- they run as `security invoker` (the implicit default, named explicitly
-- here), so they execute under the *calling* user's own role, and the
-- existing admin RLS policies on `products`/`canvas_nodes` (migrations
-- 0002/0003, `for all to authenticated using (is_admin()) with check
-- (is_admin())`) apply to every statement inside exactly as if adminProducts.ts
-- had called `.from(...)` directly — these functions add atomicity, not a
-- new privilege. `set search_path = public` pins the schema search path
-- (the same defence every function in this codebase already applies,
-- definer or not — an unpinned search_path is addressable by whoever can
-- create objects earlier in the caller's path).
--
-- Still deliberately out of scope here (not asked for by the review thread
-- this migration closes, and each is its own separate concern): the
-- `nextSortOrder()` read-then-insert race on concurrent product creation,
-- and the slug-uniqueness retry loop (both stay client-side in
-- adminProducts.ts, calling create/update_product_with_node once per
-- attempt — each attempt is already one atomic call).

create or replace function public.create_product_with_node(
  p_slug text,
  p_name text,
  p_price_amount numeric,
  p_description text,
  p_bullets jsonb,
  p_status public.product_status,
  p_zone public.product_zone,
  p_on_sale boolean,
  p_sort_order int,
  p_region text,
  p_node_x double precision,
  p_node_y double precision,
  p_node_width double precision,
  p_node_height double precision
) returns public.products
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_product public.products;
begin
  insert into public.products (
    slug, name, price_amount, description, bullets,
    status, zone, on_sale, published, sort_order
  ) values (
    p_slug, p_name, p_price_amount, p_description, p_bullets,
    p_status, p_zone, p_on_sale, false, p_sort_order
  )
  returning * into v_product;

  -- canvas_nodes has no DB-level FK to products (ref_id is a plain,
  -- polymorphic uuid — D-85) — this is the row that makes the new product
  -- actually show up in the room. x/y/width/height are fixed placeholders
  -- (D-85's "fourth correction": ShopRoomScene.tsx lays products out with
  -- its own CSS grid, keyed only by region) passed in rather than hardcoded
  -- here, so adminProducts.ts stays the one place that value lives.
  insert into public.canvas_nodes (
    region, node_type, ref_table, ref_id, x, y, width, height, published
  ) values (
    p_region, 'product', 'products', v_product.id, p_node_x, p_node_y, p_node_width, p_node_height, false
  );

  return v_product;
end;
$$;

create or replace function public.update_product_with_node(
  p_id uuid,
  p_slug text,
  p_name text,
  p_price_amount numeric,
  p_description text,
  p_bullets jsonb,
  p_status public.product_status,
  p_zone public.product_zone,
  p_on_sale boolean,
  p_published boolean,
  p_poster_media_id uuid,
  p_video_media_id uuid,
  p_region text
) returns public.products
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_product public.products;
begin
  update public.products set
    slug = p_slug,
    name = p_name,
    price_amount = p_price_amount,
    description = p_description,
    bullets = p_bullets,
    status = p_status,
    zone = p_zone,
    on_sale = p_on_sale,
    published = p_published,
    poster_media_id = p_poster_media_id,
    video_media_id = p_video_media_id
  where id = p_id
  returning * into v_product;

  if not found then
    raise exception 'Product % not found', p_id;
  end if;

  -- Keeps the linked canvas_nodes row's region/published mirroring the
  -- product's own zone/published (fetchProductNodes() filters on both
  -- independently — D-85) — the write this migration's own review thread
  -- flagged as non-atomic with the update above.
  update public.canvas_nodes set
    region = p_region,
    published = p_published
  where ref_table = 'products' and ref_id = p_id;

  return v_product;
end;
$$;

create or replace function public.delete_product_with_node(p_id uuid) returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.canvas_nodes where ref_table = 'products' and ref_id = p_id;
  -- Cascades product_media (migration 0003's own `on delete cascade`); the
  -- underlying media rows/Storage files are left behind, same documented,
  -- accepted gap as before (D-85) — unrelated to this migration's own
  -- atomicity fix.
  delete from public.products where id = p_id;
end;
$$;

-- Two parallel arrays rather than a jsonb array of pairs: reorderSwap()
-- (adminProducts.ts, unchanged by this migration) already computes exactly
-- this shape client-side — normally one {id, sortOrder} pair per end of the
-- swap, or the whole list's new order when it had to self-heal a tie — and
-- `unnest(..., ...)` turns both arrays into one multi-row update, still a
-- single statement regardless of how many rows it touches.
create or replace function public.reorder_products(p_ids uuid[], p_sort_orders int[]) returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if array_length(p_ids, 1) is distinct from array_length(p_sort_orders, 1) then
    raise exception 'p_ids and p_sort_orders must be the same length';
  end if;

  update public.products p
  set sort_order = u.sort_order
  from unnest(p_ids, p_sort_orders) as u(id, sort_order)
  where p.id = u.id;
end;
$$;

-- Admin-only, called from the browser's authenticated client (not a service-
-- role script) — RLS inside each function still gates every statement to
-- is_admin(), same reasoning as migration 0004's own revoke/grant comment:
-- a Supabase project's bootstrap already grants EXECUTE on every new
-- public-schema function directly to anon/authenticated/service_role
-- (ALTER DEFAULT PRIVILEGES), so revoking from anon has to be explicit here
-- too.
revoke all on function public.create_product_with_node(
  text, text, numeric, text, jsonb, public.product_status, public.product_zone, boolean, int, text,
  double precision, double precision, double precision, double precision
) from public, anon;
grant execute on function public.create_product_with_node(
  text, text, numeric, text, jsonb, public.product_status, public.product_zone, boolean, int, text,
  double precision, double precision, double precision, double precision
) to authenticated;

revoke all on function public.update_product_with_node(
  uuid, text, text, numeric, text, jsonb, public.product_status, public.product_zone, boolean, boolean, uuid, uuid, text
) from public, anon;
grant execute on function public.update_product_with_node(
  uuid, text, text, numeric, text, jsonb, public.product_status, public.product_zone, boolean, boolean, uuid, uuid, text
) to authenticated;

revoke all on function public.delete_product_with_node(uuid) from public, anon;
grant execute on function public.delete_product_with_node(uuid) to authenticated;

revoke all on function public.reorder_products(uuid[], int[]) from public, anon;
grant execute on function public.reorder_products(uuid[], int[]) to authenticated;
