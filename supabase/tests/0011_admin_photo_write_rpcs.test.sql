-- pgTAP tests for migration 0011_admin_photo_write_rpcs.
-- reorder_photo_sets / reorder_photos: the two RPCs that make an up/down
-- reorder atomic for the admin Photos screen (T6), same pattern as T5's
-- own reorder_products.
--
-- All fixtures and assertions are scoped to a 'pgtap-test-%' marker,
-- same convention as 0003/0010 (admin_product_write_rpcs)'s own test
-- files for these tables. (This file was numbered 0010 too until
-- rebasing onto main after T5, PR #38, merged first — see D-64/D-86.)
--
-- Learned from T5's own first attempt at this file (docs/decisions.md
-- D-85 update 6): verifying "the write was blocked/had no effect" must be
-- checked as `postgres` (bypasses RLS), not as the same restricted role
-- that made the write attempt — the fixture rows are unpublished, so the
-- public "select where published" policy can't see them either, and a
-- check run as that same role can't tell "blocked" apart from "happened,
-- but now also unreadable."

begin;
create extension if not exists pgtap;

select plan(14);

-- Fixture data, inserted as postgres (bypasses RLS: table owner).
insert into public.photo_sets (id, title, sort_order, published)
values
  ('00000000-0000-0000-0000-000000000400', 'pgtap-test: set a', 0, false),
  ('00000000-0000-0000-0000-000000000401', 'pgtap-test: set b', 1, false);

insert into public.media (id, kind, storage_path, status)
values ('00000000-0000-0000-0000-000000000402', 'image', 'photos/pgtap-test/one.webp', 'ready');

insert into public.photos (id, set_id, media_id, title, sort_order)
values
  ('00000000-0000-0000-0000-000000000410', '00000000-0000-0000-0000-000000000400', '00000000-0000-0000-0000-000000000402', 'pgtap-test: photo a', 0),
  ('00000000-0000-0000-0000-000000000411', '00000000-0000-0000-0000-000000000400', '00000000-0000-0000-0000-000000000402', 'pgtap-test: photo b', 1);

-- ===== anonymous: EXECUTE itself is revoked, regardless of RLS =====
set local role anon;

select throws_ok(
  $$ select public.reorder_photo_sets(
       array['00000000-0000-0000-0000-000000000400']::uuid[], array[9]::int[]
     ) $$,
  '42501', null,
  'anon: cannot execute reorder_photo_sets'
);

select throws_ok(
  $$ select public.reorder_photos(
       array['00000000-0000-0000-0000-000000000410']::uuid[], array[9]::int[]
     ) $$,
  '42501', null,
  'anon: cannot execute reorder_photos'
);

reset role;

-- ===== authenticated, non-admin: has EXECUTE, but the RLS each function
-- relies on (security invoker, not definer) still gates every statement
-- inside to is_admin() — so for a non-admin, the UPDATE always matches 0
-- of the 2 requested rows. The row-count guard added in review
-- (CodeRabbit, to reject a genuinely stale id) can't tell that apart
-- from an authorization-driven 0-match — both are "matched fewer rows
-- than asked for" — so a non-admin's call now raises too, instead of
-- the silent, documented no-op this block originally asserted. That's
-- an accepted, intentional side effect: the admin UI never lets a
-- non-admin reach this RPC in the first place, so this block exists
-- purely as defence-in-depth, and failing loudly here is no worse than
-- failing silently. The raise itself rolls back the UPDATE regardless
-- (Postgres statements are atomic), so the results_eq below — checked
-- as postgres, bypassing RLS — is now belt-and-braces, not load-bearing.
-- =====
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","app_metadata":{}}';

select throws_ok(
  $$ select public.reorder_photo_sets(
       array['00000000-0000-0000-0000-000000000400', '00000000-0000-0000-0000-000000000401']::uuid[],
       array[1, 0]::int[]
     ) $$,
  null, 'reorder_photo_sets matched 0 of 2 rows',
  'non-admin authenticated: reorder_photo_sets is rejected (RLS matches nothing)'
);

reset role;
select results_eq(
  $$ select id, sort_order from public.photo_sets
     where id in ('00000000-0000-0000-0000-000000000400', '00000000-0000-0000-0000-000000000401')
     order by id $$,
  $$ values
      ('00000000-0000-0000-0000-000000000400'::uuid, 0),
      ('00000000-0000-0000-0000-000000000401'::uuid, 1) $$,
  'non-admin authenticated: reorder_photo_sets left sort_order unchanged (RLS silently matched nothing)'
);

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","app_metadata":{}}';

select throws_ok(
  $$ select public.reorder_photos(
       array['00000000-0000-0000-0000-000000000410', '00000000-0000-0000-0000-000000000411']::uuid[],
       array[1, 0]::int[]
     ) $$,
  null, 'reorder_photos matched 0 of 2 rows',
  'non-admin authenticated: reorder_photos is rejected (RLS matches nothing)'
);

reset role;
select results_eq(
  $$ select id, sort_order from public.photos
     where id in ('00000000-0000-0000-0000-000000000410', '00000000-0000-0000-0000-000000000411')
     order by id $$,
  $$ values
      ('00000000-0000-0000-0000-000000000410'::uuid, 0),
      ('00000000-0000-0000-0000-000000000411'::uuid, 1) $$,
  'non-admin authenticated: reorder_photos left sort_order unchanged (RLS silently matched nothing)'
);

-- ===== admin =====
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","app_metadata":{"role":"admin"}}';

select lives_ok(
  $$ select public.reorder_photo_sets(
       array['00000000-0000-0000-0000-000000000400', '00000000-0000-0000-0000-000000000401']::uuid[],
       array[1, 0]::int[]
     ) $$,
  'admin: reorder_photo_sets succeeds'
);

select results_eq(
  $$ select id, sort_order from public.photo_sets
     where id in ('00000000-0000-0000-0000-000000000400', '00000000-0000-0000-0000-000000000401')
     order by id $$,
  $$ values
      ('00000000-0000-0000-0000-000000000400'::uuid, 1),
      ('00000000-0000-0000-0000-000000000401'::uuid, 0) $$,
  'admin: reorder_photo_sets swaps both rows in one call'
);

select throws_ok(
  $$ select public.reorder_photo_sets(array['00000000-0000-0000-0000-000000000400']::uuid[], array[1, 2]::int[]) $$,
  null, 'p_ids and p_sort_orders must be the same length',
  'admin: reorder_photo_sets rejects mismatched array lengths'
);

select lives_ok(
  $$ select public.reorder_photos(
       array['00000000-0000-0000-0000-000000000410', '00000000-0000-0000-0000-000000000411']::uuid[],
       array[1, 0]::int[]
     ) $$,
  'admin: reorder_photos succeeds'
);

select results_eq(
  $$ select id, sort_order from public.photos
     where id in ('00000000-0000-0000-0000-000000000410', '00000000-0000-0000-0000-000000000411')
     order by id $$,
  $$ values
      ('00000000-0000-0000-0000-000000000410'::uuid, 1),
      ('00000000-0000-0000-0000-000000000411'::uuid, 0) $$,
  'admin: reorder_photos swaps both rows in one call'
);

select throws_ok(
  $$ select public.reorder_photos(array['00000000-0000-0000-0000-000000000410']::uuid[], array[1, 2]::int[]) $$,
  null, 'p_ids and p_sort_orders must be the same length',
  'admin: reorder_photos rejects mismatched array lengths'
);

-- Found in review (CodeRabbit): a p_ids entry that matches no row (here,
-- one real id plus one that was never inserted) must not be reported as
-- a successful reorder.
select throws_ok(
  $$ select public.reorder_photo_sets(
       array['00000000-0000-0000-0000-000000000400', '00000000-0000-0000-0000-000000000499']::uuid[],
       array[0, 1]::int[]
     ) $$,
  null, 'reorder_photo_sets matched 1 of 2 rows',
  'admin: reorder_photo_sets rejects a partial match'
);

select throws_ok(
  $$ select public.reorder_photos(
       array['00000000-0000-0000-0000-000000000410', '00000000-0000-0000-0000-000000000499']::uuid[],
       array[0, 1]::int[]
     ) $$,
  null, 'reorder_photos matched 1 of 2 rows',
  'admin: reorder_photos rejects a partial match'
);

reset role;

select * from finish();
rollback;
