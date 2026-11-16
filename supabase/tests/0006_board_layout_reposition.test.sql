-- pgTAP tests for migration 0006_board_layout_reposition.
-- Confirms the six repositioned viewpoints, and the region-label
-- canvas_nodes placeholders in the regions that moved, land exactly where
-- the client feedback plan (docs/decisions.md D-71, Step 6) describes,
-- and that 'landing' is untouched. ('about' was the other untouched
-- viewpoint this migration left alone — not checked here any more since
-- migration 0007 removes it outright, so by the time any test file runs
-- in this same `db reset`, it no longer exists to assert against; 0007's
-- own test file covers its removal instead.)
--
-- What this *can't* exercise: `supabase db reset` (what this test runs
-- under) applies every migration in order and only *then* runs seed.sql
-- — so migration 0006's own UPDATE statements run against an empty
-- table here and are themselves a no-op in this environment; the values
-- below land correctly because supabase/seed.sql's inserts already carry
-- the new, post-reposition coordinates directly (necessarily — seed.sql
-- has to describe the current layout for a fresh database regardless of
-- what migration 0006 does). This test is still real regression coverage
-- (it fails if seed.sql's and migration 0006's own numbers ever drift
-- apart), but migration 0006's actual job — translating the real,
-- already-live-in-production viewpoints/canvas_nodes rows, including the
-- 8 real RIYO product nodes (D-70), which only ever exist in production,
-- never in this local fixture — can only be verified there, applied the
-- same way Step 0's price/unpublish change was (the REST API; this
-- sandbox has no direct Postgres access to production to prove it here).

begin;
create extension if not exists pgtap;

select plan(9);

select results_eq(
  $$ select x, y from public.viewpoints where key = 'gallery' $$,
  $$ values (-2000::double precision, -1200::double precision) $$,
  'gallery: moved to the new top-left position'
);

select results_eq(
  $$ select x, y from public.viewpoints where key = 'collage' $$,
  $$ values (2000::double precision, -1200::double precision) $$,
  'collage: moved to the new top-right position, same row as gallery'
);

select results_eq(
  $$ select x, y from public.viewpoints where key = 'shop' $$,
  $$ values (2000::double precision, 1800::double precision) $$,
  'shop (overview anchor): moved to the new bottom-right position'
);

select results_eq(
  $$ select x, y from public.viewpoints where key = 'shop-wall' $$,
  $$ values (2000::double precision, 1200::double precision) $$,
  'shop-wall: moved to sit above the shop anchor in the new quadrant'
);

-- Superseded by migration 0008_shop_floor_matches_wall (docs/
-- decisions.md D-71's "sixth correction") — shop-floor no longer sits
-- below the shop anchor on its own; it points at the exact same spot
-- shop-wall does. This migration's own job (moving it to 1200 below the
-- anchor, same spatial relationship as gallery/collage) was correct at
-- the time; 0008's own test file covers the current, real value instead.
select results_eq(
  $$ select x, y from public.viewpoints where key = 'shop-floor' $$,
  $$ values (2000::double precision, 1200::double precision) $$,
  'shop-floor: superseded by migration 0008 — now matches shop-wall, not its own separate position'
);

select results_eq(
  $$ select x, y from public.viewpoints where key = 'contact' $$,
  $$ values (-2000::double precision, 1200::double precision) $$,
  'contact: moved to the new bottom-left position'
);

select results_eq(
  $$ select x, y from public.viewpoints where key = 'landing' $$,
  $$ values (0::double precision, 0::double precision) $$,
  'landing: left exactly where it was'
);

select results_eq(
  $$ select x, y from public.canvas_nodes where region = 'collage' and node_type = 'region-label' $$,
  $$ values (1600::double precision, -1500::double precision) $$,
  'collage region-label: shifted by the same translation as the collage viewpoint'
);

select results_eq(
  $$ select x, y from public.canvas_nodes where region = 'shop-floor' and node_type = 'region-label' $$,
  $$ values (1600::double precision, 2100::double precision) $$,
  'shop-floor region-label: shifted by the same translation as the shop-floor viewpoint'
);

select * from finish();
rollback;
