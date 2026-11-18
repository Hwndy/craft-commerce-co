-- pgTAP tests for migration 0009_shop_merge_guided_path.
-- Confirms 'shop-wall' is labelled "The Shop" and still in the guided
-- path, 'shop-floor' is dropped from the guided path but keeps its own
-- position/label, and neither row's x/y moved.
--
-- Same caveat as migrations 0006/0008's own test files: `supabase db
-- reset` applies every migration in order and only *then* runs seed.sql,
-- so this migration's own UPDATE statements run against an empty table
-- here and are themselves no-ops in this environment; the values below
-- land correctly because supabase/seed.sql's own rows already carry the
-- new label/in_guided_path directly. This is still real regression
-- coverage (it fails if seed.sql's and this migration's own values ever
-- drift apart); this migration's actual job — updating the real,
-- already-live-in-production rows — can only be verified there, the same
-- way migrations 0006/0008's were.

begin;
create extension if not exists pgtap;

select plan(4);

select results_eq(
  $$ select label, in_guided_path from public.viewpoints where key = 'shop-wall' $$,
  $$ values ('The Shop'::text, true) $$,
  'shop-wall: relabelled to "The Shop", still in the guided path'
);

select results_eq(
  $$ select in_guided_path from public.viewpoints where key = 'shop-floor' $$,
  $$ values (false) $$,
  'shop-floor: dropped from the guided path'
);

select results_eq(
  $$ select x, y from public.viewpoints where key = 'shop-floor' $$,
  $$ values (2000::double precision, 1200::double precision) $$,
  'shop-floor: position unchanged by this migration'
);

select results_eq(
  $$ select x, y from public.viewpoints where key = 'shop-wall' $$,
  $$ values (2000::double precision, 1200::double precision) $$,
  'shop-wall: position unchanged by this migration'
);

select * from finish();
rollback;
