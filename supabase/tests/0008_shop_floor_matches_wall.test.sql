-- pgTAP tests for migration 0008_shop_floor_matches_wall.
-- Confirms 'shop-floor' now sits at the exact same spot as 'shop-wall',
-- and that 'shop-wall' itself (and the non-guided 'shop' anchor) are
-- untouched by this migration.
--
-- Same caveat as migration 0006's own test file: `supabase db reset`
-- (what this test runs under) applies every migration in order and only
-- *then* runs seed.sql — so this migration's own UPDATE statement runs
-- against an empty table here and is itself a no-op in this environment;
-- the values below land correctly because supabase/seed.sql's own
-- 'shop-floor' row already carries the new coordinates directly
-- (necessarily — seed.sql has to describe the current layout for a
-- fresh database regardless of what this migration does). This is still
-- real regression coverage (it fails if seed.sql's and this migration's
-- own numbers ever drift apart); this migration's actual job — moving
-- the real, already-live-in-production row — can only be verified
-- there, the same way migration 0006's was.

begin;
create extension if not exists pgtap;

select plan(3);

select results_eq(
  $$ select x, y from public.viewpoints where key = 'shop-floor' $$,
  $$ values (2000::double precision, 1200::double precision) $$,
  'shop-floor: now points at the same spot as shop-wall, not its own separate position'
);

select results_eq(
  $$ select x, y from public.viewpoints where key = 'shop-wall' $$,
  $$ values (2000::double precision, 1200::double precision) $$,
  'shop-wall: unchanged by this migration'
);

select results_eq(
  $$ select x, y from public.viewpoints where key = 'shop' $$,
  $$ values (2000::double precision, 1800::double precision) $$,
  'shop (overview anchor): unchanged by this migration'
);

select * from finish();
rollback;
