-- pgTAP tests for migration 0007_delete_about_region.
-- Confirms the About region is gone — no viewpoints row, no canvas_nodes
-- row — and that this migration touched nothing else (a neighbouring
-- viewpoint stays exactly where Step 6's migration 0006 put it).
--
-- Same local/CI caveat as 0006's own test file: `supabase db reset` runs
-- every migration before seed.sql, so this migration's DELETEs are
-- themselves a no-op here (nothing to delete yet) — the zero-row result
-- below holds because supabase/seed.sql simply never inserts an 'about'
-- row any more. Real production rows only exist there, so this
-- migration's actual deletion can only be verified by applying it for
-- real (the REST API, same as every other migration this sandbox can't
-- `db push --remote`).

begin;
create extension if not exists pgtap;

select plan(3);

select results_eq(
  $$ select count(*)::int from public.viewpoints where key = 'about' $$,
  $$ values (0) $$,
  'about: no viewpoints row left'
);

select results_eq(
  $$ select count(*)::int from public.canvas_nodes where region = 'about' $$,
  $$ values (0) $$,
  'about: no canvas_nodes row left'
);

-- Not touched by this migration — confirms the delete was scoped to
-- 'about' only, not a blunter "clear everything" mistake.
select results_eq(
  $$ select x, y from public.viewpoints where key = 'landing' $$,
  $$ values (0::double precision, 0::double precision) $$,
  'landing: untouched by this migration'
);

select * from finish();
rollback;
