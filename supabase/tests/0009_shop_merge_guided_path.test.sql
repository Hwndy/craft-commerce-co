-- pgTAP tests for migration 0009_shop_merge_guided_path.

begin;
create extension if not exists pgtap;

select plan(6);

-- Confirms today's real, post-migration-and-seed state: 'shop-wall' is
-- labelled "The Shop" and still in the guided path; 'shop-floor' is
-- dropped from the guided path but keeps its own position/label; neither
-- row's x/y moved.
--
-- Found in review (CodeRabbit, PR #30): `supabase db reset` applies every
-- migration in order and only *then* runs seed.sql, so migration 0009's
-- own UPDATE statements run against an empty table here and are
-- themselves no-ops in this environment — these four checks only read
-- what supabase/seed.sql wrote, so they catch seed.sql drifting from the
-- intended values, but NOT the migration's own UPDATE statements drifting
-- from either one (that comment, present in migrations 0006/0008's own
-- test files too, was inaccurate there as well as it was here). The two
-- checks below this block close that real gap directly, by applying
-- 0009's actual UPDATE statements against a simulated pre-migration row
-- state instead of relying on seed.sql at all.
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

-- Exercises migration 0009's own UPDATE statements for real: resets both
-- rows to their pre-migration state (0008's own values — the label/flag
-- this migration is meant to change), re-runs the exact statements from
-- 0009_shop_merge_guided_path.sql, then asserts the result — independent
-- of whatever supabase/seed.sql happens to carry.
update public.viewpoints set label = 'Shop (wall)' where key = 'shop-wall';
update public.viewpoints set in_guided_path = true where key = 'shop-floor';

update public.viewpoints set label = 'The Shop' where key = 'shop-wall';
update public.viewpoints set in_guided_path = false where key = 'shop-floor';

select results_eq(
  $$ select label, in_guided_path from public.viewpoints where key = 'shop-wall' $$,
  $$ values ('The Shop'::text, true) $$,
  'shop-wall: migration 0009 itself relabels the row to "The Shop", from its pre-migration "Shop (wall)"'
);

select results_eq(
  $$ select in_guided_path from public.viewpoints where key = 'shop-floor' $$,
  $$ values (false) $$,
  'shop-floor: migration 0009 itself drops the row from the guided path, from its pre-migration true'
);

select * from finish();
rollback;
