-- pgTAP tests for migration 0001_core_and_film.
-- Anonymous: can read ready/published rows only, can write nothing.
-- Authenticated non-admin: same as anonymous.
-- Admin (app_metadata.role = 'admin'): full read/write.

begin;
create extension if not exists pgtap;

select plan(15);

-- Fixture data, inserted as postgres (bypasses RLS: table owner).
insert into public.media (id, kind, storage_path, status)
values
  ('00000000-0000-0000-0000-000000000001', 'hls', 'film/test/master.m3u8', 'ready'),
  ('00000000-0000-0000-0000-000000000002', 'hls', 'film/processing/master.m3u8', 'processing');

insert into public.gallery_film (id, media_id, title, version, published)
values
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Published film', 1, true),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'Draft film', 1, false);

-- ===== anonymous =====
set local role anon;

select results_eq(
  $$ select storage_path from public.media order by storage_path $$,
  $$ values ('film/test/master.m3u8') $$,
  'anon: media select returns only ready rows'
);

select throws_ok(
  $$ insert into public.media (kind, storage_path, status) values ('image', 'x', 'ready') $$,
  '42501',
  null,
  'anon: media insert is rejected'
);

-- UPDATE/DELETE against a row invisible under RLS silently affects 0 rows
-- (no exception), so each write is run as a bare statement, then the role is
-- reset to the table owner to verify the row was not actually changed.
update public.media set status = 'ready' where id = '00000000-0000-0000-0000-000000000002';
reset role;
select is(
  (select status from public.media where id = '00000000-0000-0000-0000-000000000002')::text,
  'processing',
  'anon: media update does not change the row (not visible under RLS)'
);
set local role anon;

delete from public.media where id = '00000000-0000-0000-0000-000000000001';
reset role;
select ok(
  exists(select 1 from public.media where id = '00000000-0000-0000-0000-000000000001'),
  'anon: media delete does not remove the row (no delete policy grants it)'
);
set local role anon;

select results_eq(
  $$ select title from public.gallery_film order by title $$,
  $$ values ('Published film') $$,
  'anon: gallery_film select returns only published rows'
);

select throws_ok(
  $$ insert into public.gallery_film (media_id, title, published) values ('00000000-0000-0000-0000-000000000001', 'x', true) $$,
  '42501',
  null,
  'anon: gallery_film insert is rejected'
);

update public.gallery_film set published = false where id = '00000000-0000-0000-0000-000000000011';
reset role;
select is(
  (select published from public.gallery_film where id = '00000000-0000-0000-0000-000000000011'),
  true,
  'anon: gallery_film update does not change the row'
);
set local role anon;

select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('site-media', 'anon-write-test') $$,
  '42501',
  null,
  'anon: cannot write to storage.objects in site-media'
);

reset role;

-- ===== authenticated, non-admin =====
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","app_metadata":{}}';

select results_eq(
  $$ select storage_path from public.media order by storage_path $$,
  $$ values ('film/test/master.m3u8') $$,
  'non-admin authenticated: media select returns only ready rows'
);

select throws_ok(
  $$ insert into public.media (kind, storage_path, status) values ('image', 'x', 'ready') $$,
  '42501',
  null,
  'non-admin authenticated: media insert is rejected'
);

update public.gallery_film set published = true where id = '00000000-0000-0000-0000-000000000012';
reset role;
select is(
  (select published from public.gallery_film where id = '00000000-0000-0000-0000-000000000012'),
  false,
  'non-admin authenticated: gallery_film update does not change the row'
);

-- ===== admin =====
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","app_metadata":{"role":"admin"}}';

select results_eq(
  $$ select count(*)::int from public.media $$,
  $$ values (2) $$,
  'admin: media select sees all rows regardless of status'
);

select lives_ok(
  $$ insert into public.media (kind, storage_path, status) values ('image', 'admin-insert', 'ready') $$,
  'admin: media insert succeeds'
);

select lives_ok(
  $$ update public.gallery_film set published = true where id = '00000000-0000-0000-0000-000000000012' $$,
  'admin: gallery_film update succeeds'
);

select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('site-media', 'admin-write-test') $$,
  'admin: can write to storage.objects in site-media'
);

reset role;

select * from finish();
rollback;
