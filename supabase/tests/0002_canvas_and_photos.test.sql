-- pgTAP tests for migration 0002_canvas_and_photos.
-- viewpoints: no published flag of its own — always public select, admin writes.
-- canvas_nodes / photo_sets: public select where published, admin writes.
-- photos: public select only through a published parent photo_set, admin writes.
--
-- All fixtures and assertions are scoped to a 'pgtap-test-%' marker (region
-- name, title prefix, etc.) rather than counting/comparing whole tables —
-- these tables are also seeded with real content in supabase/seed.sql, and
-- this file must pass regardless of what that seed data contains.

begin;
create extension if not exists pgtap;

select plan(21);

-- Fixture data, inserted as postgres (bypasses RLS: table owner).
insert into public.viewpoints (key, label, x, y, zoom, sort_order, in_guided_path)
values
  ('pgtap-test-a', 'Test A', 0, 0, 1, 0, true),
  ('pgtap-test-b', 'Test B', 2000, 0, 1, 1, true);

insert into public.canvas_nodes (id, region, node_type, x, y, width, height, published)
values
  ('00000000-0000-0000-0000-000000000021', 'pgtap-test-region', 'text', 0, 0, 100, 100, true),
  ('00000000-0000-0000-0000-000000000022', 'pgtap-test-region', 'text', 0, 0, 100, 100, false);

insert into public.photo_sets (id, title, published)
values
  ('00000000-0000-0000-0000-000000000031', 'pgtap-test: published shoot', true),
  ('00000000-0000-0000-0000-000000000032', 'pgtap-test: draft shoot', false);

insert into public.media (id, kind, storage_path, status)
values ('00000000-0000-0000-0000-000000000041', 'image', 'photos/test/one.webp', 'ready');

insert into public.photos (id, set_id, media_id, title)
values
  ('00000000-0000-0000-0000-000000000051', '00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000041', 'pgtap-test: in published set'),
  ('00000000-0000-0000-0000-000000000052', '00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000041', 'pgtap-test: in draft set');

-- ===== anonymous =====
set local role anon;

-- Scoped to this test's own fixture keys — viewpoints has no published
-- flag, so an unscoped select would also return whatever real rows
-- seed.sql has already loaded.
select results_eq(
  $$ select key from public.viewpoints where key like 'pgtap-test-%' order by key $$,
  $$ values ('pgtap-test-a'), ('pgtap-test-b') $$,
  'anon: viewpoints select returns rows regardless of published (it has no such flag)'
);

select throws_ok(
  $$ insert into public.viewpoints (key, label, x, y, zoom) values ('x', 'x', 0, 0, 1) $$,
  '42501',
  null,
  'anon: viewpoints insert is rejected'
);

select results_eq(
  $$ select id from public.canvas_nodes where region = 'pgtap-test-region' order by id $$,
  $$ values ('00000000-0000-0000-0000-000000000021'::uuid) $$,
  'anon: canvas_nodes select returns only published rows'
);

select throws_ok(
  $$ insert into public.canvas_nodes (region, node_type, x, y, width, height) values ('pgtap-test-region', 'text', 0, 0, 1, 1) $$,
  '42501',
  null,
  'anon: canvas_nodes insert is rejected'
);

update public.canvas_nodes set published = true where id = '00000000-0000-0000-0000-000000000022';
reset role;
select is(
  (select published from public.canvas_nodes where id = '00000000-0000-0000-0000-000000000022'),
  false,
  'anon: canvas_nodes update does not change the row (not visible under RLS)'
);
set local role anon;

select results_eq(
  $$ select title from public.photo_sets where title like 'pgtap-test:%' order by title $$,
  $$ values ('pgtap-test: published shoot') $$,
  'anon: photo_sets select returns only published rows'
);

select throws_ok(
  $$ insert into public.photo_sets (title) values ('pgtap-test: x') $$,
  '42501',
  null,
  'anon: photo_sets insert is rejected'
);

select results_eq(
  $$ select title from public.photos where title like 'pgtap-test:%' order by title $$,
  $$ values ('pgtap-test: in published set') $$,
  'anon: photos select returns only rows in a published set'
);

select throws_ok(
  $$ insert into public.photos (set_id, media_id, title) values ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000041', 'pgtap-test: x') $$,
  '42501',
  null,
  'anon: photos insert is rejected'
);

reset role;

-- ===== authenticated, non-admin =====
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","app_metadata":{}}';

select throws_ok(
  $$ insert into public.viewpoints (key, label, x, y, zoom) values ('x', 'x', 0, 0, 1) $$,
  '42501',
  null,
  'non-admin authenticated: viewpoints insert is rejected'
);

select results_eq(
  $$ select id from public.canvas_nodes where region = 'pgtap-test-region' order by id $$,
  $$ values ('00000000-0000-0000-0000-000000000021'::uuid) $$,
  'non-admin authenticated: canvas_nodes select returns only published rows'
);

select throws_ok(
  $$ insert into public.photo_sets (title) values ('pgtap-test: x') $$,
  '42501',
  null,
  'non-admin authenticated: photo_sets insert is rejected'
);

select throws_ok(
  $$ insert into public.photos (set_id, media_id, title) values ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000041', 'pgtap-test: x') $$,
  '42501',
  null,
  'non-admin authenticated: photos insert is rejected'
);

reset role;

-- ===== admin =====
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","app_metadata":{"role":"admin"}}';

select lives_ok(
  $$ insert into public.viewpoints (key, label, x, y, zoom) values ('pgtap-test-c', 'Test C', 4000, 0, 1) $$,
  'admin: viewpoints insert succeeds'
);

select lives_ok(
  $$ update public.viewpoints set label = 'Test C (updated)' where key = 'pgtap-test-c' $$,
  'admin: viewpoints update succeeds'
);

select results_eq(
  $$ select count(*)::int from public.canvas_nodes where region = 'pgtap-test-region' $$,
  $$ values (2) $$,
  'admin: canvas_nodes select sees all rows regardless of published'
);

select lives_ok(
  $$ insert into public.canvas_nodes (region, node_type, x, y, width, height) values ('pgtap-test-region', 'text', 0, 0, 1, 1) $$,
  'admin: canvas_nodes insert succeeds'
);

select results_eq(
  $$ select count(*)::int from public.photo_sets where title like 'pgtap-test:%' $$,
  $$ values (2) $$,
  'admin: photo_sets select sees all rows regardless of published'
);

select lives_ok(
  $$ insert into public.photo_sets (title) values ('pgtap-test: admin set') $$,
  'admin: photo_sets insert succeeds'
);

select results_eq(
  $$ select count(*)::int from public.photos where title like 'pgtap-test:%' $$,
  $$ values (2) $$,
  'admin: photos select sees all rows regardless of parent set published'
);

select lives_ok(
  $$ insert into public.photos (set_id, media_id, title) values ('00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000041', 'pgtap-test: admin photo') $$,
  'admin: photos insert succeeds'
);

reset role;

select * from finish();
rollback;
