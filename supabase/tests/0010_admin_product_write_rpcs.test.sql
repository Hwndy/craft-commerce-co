-- pgTAP tests for migration 0010_admin_product_write_rpcs.
-- create_product_with_node / update_product_with_node /
-- delete_product_with_node / reorder_products: the four RPCs that wrap
-- adminProducts.ts's previously non-atomic multi-step writes (PR #38
-- review) in a single server-side transaction each.
--
-- All fixtures and assertions are scoped to a 'pgtap-test-%' marker rather
-- than counting/comparing whole tables, same convention as 0003's own test
-- file for these two tables.

begin;
create extension if not exists pgtap;

select plan(24);

-- Fixture data, inserted as postgres (bypasses RLS: table owner) — shared
-- by the anon/non-admin "blocked" tests below.
insert into public.products (id, slug, name, price_amount, zone, sort_order, published)
values ('00000000-0000-0000-0000-000000000200', 'pgtap-test-shared', 'pgtap-test: shared product', 55.00, 'floor', 0, false);

insert into public.canvas_nodes (id, region, node_type, ref_table, ref_id, x, y, width, height, published)
values ('00000000-0000-0000-0000-000000000201', 'shop-floor', 'product', 'products', '00000000-0000-0000-0000-000000000200', 1880, 2220, 240, 360, false);

-- ===== anonymous: EXECUTE itself is revoked, regardless of RLS =====
set local role anon;

select throws_ok(
  $$ select public.create_product_with_node(
       'pgtap-test-anon', 'pgtap-test: anon', 40, null, '[]'::jsonb,
       'available', 'floor', false, 0, 'shop-floor', 1880, 2220, 240, 360
     ) $$,
  '42501', null,
  'anon: cannot execute create_product_with_node'
);

select throws_ok(
  $$ select public.update_product_with_node(
       '00000000-0000-0000-0000-000000000200', 'pgtap-test-shared', 'x', 1, null, '[]'::jsonb,
       'available', 'floor', false, false, null, null, 'shop-floor'
     ) $$,
  '42501', null,
  'anon: cannot execute update_product_with_node'
);

select throws_ok(
  $$ select public.delete_product_with_node('00000000-0000-0000-0000-000000000200') $$,
  '42501', null,
  'anon: cannot execute delete_product_with_node'
);

select throws_ok(
  $$ select public.reorder_products(array['00000000-0000-0000-0000-000000000200']::uuid[], array[9]::int[]) $$,
  '42501', null,
  'anon: cannot execute reorder_products'
);

reset role;

-- ===== authenticated, non-admin: has EXECUTE, but the RLS each function
-- relies on (security invoker, not definer) still gates every statement
-- inside to is_admin() =====
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","app_metadata":{}}';

select throws_ok(
  $$ select public.create_product_with_node(
       'pgtap-test-non-admin', 'pgtap-test: non-admin', 40, null, '[]'::jsonb,
       'available', 'floor', false, 0, 'shop-floor', 1880, 2220, 240, 360
     ) $$,
  '42501', null,
  'non-admin authenticated: create_product_with_node is rejected (RLS insert check)'
);

-- UPDATE's USING clause hides the row entirely for a non-admin (0 rows
-- matched, not a constraint violation) — the function's own "not found"
-- check is what turns that into a visible error here, not a silent no-op.
select throws_ok(
  $$ select public.update_product_with_node(
       '00000000-0000-0000-0000-000000000200', 'pgtap-test-shared', 'pgtap-test: hijacked', 1, null, '[]'::jsonb,
       'available', 'floor', false, false, null, null, 'shop-floor'
     ) $$,
  'P0001', null,
  'non-admin authenticated: update_product_with_node is rejected (no visible row to update)'
);

-- DELETE's USING clause likewise hides the row — Postgres doesn't raise
-- for a 0-row DELETE, so this call itself succeeds; the row surviving is
-- the actual assertion.
select lives_ok(
  $$ select public.delete_product_with_node('00000000-0000-0000-0000-000000000200') $$,
  'non-admin authenticated: delete_product_with_node call does not raise'
);

-- Verified as postgres (bypasses RLS), not as the same non-admin role:
-- the fixture row is unpublished, so "public reads published products"
-- wouldn't show it to this role either way — checking as the restricted
-- role can't tell "blocked" apart from "deleted but also unreadable",
-- and gave a false failure here until caught running this against a
-- real local stack (no CI engine reproduces this; only `supabase test
-- db` does).
reset role;
select results_eq(
  $$ select id from public.products where id = '00000000-0000-0000-0000-000000000200' $$,
  $$ values ('00000000-0000-0000-0000-000000000200'::uuid) $$,
  'non-admin authenticated: delete_product_with_node left the row in place (RLS silently matched nothing)'
);

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","app_metadata":{}}';

select lives_ok(
  $$ select public.reorder_products(array['00000000-0000-0000-0000-000000000200']::uuid[], array[9]::int[]) $$,
  'non-admin authenticated: reorder_products call does not raise'
);

reset role;
select results_eq(
  $$ select sort_order from public.products where id = '00000000-0000-0000-0000-000000000200' $$,
  $$ values (0) $$,
  'non-admin authenticated: reorder_products left sort_order unchanged (RLS silently matched nothing)'
);

-- ===== admin =====
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","app_metadata":{"role":"admin"}}';

select results_eq(
  $$ select slug, name from public.create_product_with_node(
       'pgtap-test-create-ok', 'pgtap-test: create ok', 40, null, '[]'::jsonb,
       'available', 'floor', false, 0, 'shop-floor', 1880, 2220, 240, 360
     ) $$,
  $$ values ('pgtap-test-create-ok'::text, 'pgtap-test: create ok'::text) $$,
  'admin: create_product_with_node returns the new product row'
);

select results_eq(
  $$ select n.region, n.ref_table from public.canvas_nodes n
     join public.products p on p.id = n.ref_id
     where p.slug = 'pgtap-test-create-ok' $$,
  $$ values ('shop-floor'::text, 'products'::text) $$,
  'admin: create_product_with_node also creates the linked canvas_nodes row'
);

-- Forces the second insert (canvas_nodes) to fail on a real not-null
-- violation, after the first insert (products) already succeeded.
select throws_ok(
  $$ select public.create_product_with_node(
       'pgtap-test-create-fail', 'pgtap-test: create fail', 40, null, '[]'::jsonb,
       'available', 'floor', false, 0, 'shop-floor', 1880, 2220, null, 360
     ) $$,
  '23502', null,
  'admin: create_product_with_node raises when the node insert violates a not-null constraint'
);

select is_empty(
  $$ select id from public.products where slug = 'pgtap-test-create-fail' $$,
  'admin: a failed create_product_with_node leaves no stranded product row (real rollback, not a compensating delete)'
);

select results_eq(
  $$ select name, zone from public.update_product_with_node(
       '00000000-0000-0000-0000-000000000200', 'pgtap-test-shared', 'pgtap-test: shared updated', 55, null, '[]'::jsonb,
       'available', 'wall', false, true, null, null, 'shop-wall'
     ) $$,
  $$ values ('pgtap-test: shared updated'::text, 'wall'::public.product_zone) $$,
  'admin: update_product_with_node updates the product row'
);

select results_eq(
  $$ select region, published from public.canvas_nodes where ref_table = 'products' and ref_id = '00000000-0000-0000-0000-000000000200' $$,
  $$ values ('shop-wall'::text, true) $$,
  'admin: update_product_with_node also updates the linked canvas_nodes row'
);

-- Forces the second update (canvas_nodes) to fail on a real not-null
-- violation, after the first update (products) already succeeded.
select throws_ok(
  $$ select public.update_product_with_node(
       '00000000-0000-0000-0000-000000000200', 'pgtap-test-shared', 'pgtap-test: should not stick', 999, null, '[]'::jsonb,
       'available', 'wall', false, true, null, null, null
     ) $$,
  '23502', null,
  'admin: update_product_with_node raises when the node update violates a not-null constraint'
);

select results_eq(
  $$ select name, price_amount from public.products where id = '00000000-0000-0000-0000-000000000200' $$,
  $$ values ('pgtap-test: shared updated'::text, 55.00::numeric) $$,
  'admin: a failed update_product_with_node leaves the product row unchanged'
);

select lives_ok(
  $$ select public.delete_product_with_node('00000000-0000-0000-0000-000000000200') $$,
  'admin: delete_product_with_node succeeds'
);

select is_empty(
  $$ select id from public.products where id = '00000000-0000-0000-0000-000000000200' $$,
  'admin: delete_product_with_node removes the product row'
);

select is_empty(
  $$ select id from public.canvas_nodes where ref_table = 'products' and ref_id = '00000000-0000-0000-0000-000000000200' $$,
  'admin: delete_product_with_node removes the linked canvas_nodes row'
);

insert into public.products (id, slug, name, price_amount, zone, sort_order, published)
values
  ('00000000-0000-0000-0000-000000000210', 'pgtap-test-reorder-a', 'pgtap-test: reorder a', 40.00, 'floor', 0, false),
  ('00000000-0000-0000-0000-000000000211', 'pgtap-test-reorder-b', 'pgtap-test: reorder b', 40.00, 'floor', 1, false);

select lives_ok(
  $$ select public.reorder_products(
       array['00000000-0000-0000-0000-000000000210', '00000000-0000-0000-0000-000000000211']::uuid[],
       array[1, 0]::int[]
     ) $$,
  'admin: reorder_products succeeds'
);

select results_eq(
  $$ select id, sort_order from public.products
     where id in ('00000000-0000-0000-0000-000000000210', '00000000-0000-0000-0000-000000000211')
     order by id $$,
  $$ values
      ('00000000-0000-0000-0000-000000000210'::uuid, 1),
      ('00000000-0000-0000-0000-000000000211'::uuid, 0) $$,
  'admin: reorder_products swaps both rows in one call'
);

select throws_ok(
  $$ select public.reorder_products(array['00000000-0000-0000-0000-000000000210']::uuid[], array[1, 2]::int[]) $$,
  null, 'p_ids and p_sort_orders must be the same length',
  'admin: reorder_products rejects mismatched array lengths'
);

reset role;

select * from finish();
rollback;
