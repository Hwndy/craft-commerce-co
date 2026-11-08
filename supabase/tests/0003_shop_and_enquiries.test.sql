-- pgTAP tests for migration 0003_shop_and_enquiries.
-- products / product_media: public select where published (product_media
-- through its parent product), admin writes.
-- enquiries: NO public policy at all (submit-enquiry inserts with the
-- service-role client, which bypasses RLS) — admin gets read + update
-- only, not insert or delete.
--
-- All fixtures and assertions are scoped to a 'pgtap-test-%' marker rather
-- than counting/comparing whole tables — these tables may also carry real
-- seed content, and this file must pass regardless of what that contains.

begin;
create extension if not exists pgtap;

select plan(18);

-- Fixture data, inserted as postgres (bypasses RLS: table owner).
insert into public.products (id, slug, name, price_amount, published)
values
  ('00000000-0000-0000-0000-000000000061', 'pgtap-test-published', 'pgtap-test: published product', 40.00, true),
  ('00000000-0000-0000-0000-000000000062', 'pgtap-test-draft', 'pgtap-test: draft product', 40.00, false);

insert into public.media (id, kind, storage_path, status)
values ('00000000-0000-0000-0000-000000000063', 'image', 'products/test/one.webp', 'ready');

insert into public.product_media (id, product_id, media_id, kind)
values
  ('00000000-0000-0000-0000-000000000064', '00000000-0000-0000-0000-000000000061', '00000000-0000-0000-0000-000000000063', 'picture'),
  ('00000000-0000-0000-0000-000000000065', '00000000-0000-0000-0000-000000000062', '00000000-0000-0000-0000-000000000063', 'picture');

insert into public.enquiries (id, name, email, message)
values ('00000000-0000-0000-0000-000000000066', 'pgtap-test: enquirer', 'test@example.com', 'pgtap-test: enquiry message');

-- ===== anonymous =====
set local role anon;

select results_eq(
  $$ select slug from public.products where slug like 'pgtap-test-%' order by slug $$,
  $$ values ('pgtap-test-published') $$,
  'anon: products select returns only published rows'
);

select throws_ok(
  $$ insert into public.products (slug, name, price_amount) values ('pgtap-test-x', 'x', 1) $$,
  '42501',
  null,
  'anon: products insert is rejected'
);

select results_eq(
  $$ select id from public.product_media where id in ('00000000-0000-0000-0000-000000000064', '00000000-0000-0000-0000-000000000065') order by id $$,
  $$ values ('00000000-0000-0000-0000-000000000064'::uuid) $$,
  'anon: product_media select returns only media of a published product'
);

select throws_ok(
  $$ insert into public.product_media (product_id, media_id, kind) values ('00000000-0000-0000-0000-000000000061', '00000000-0000-0000-0000-000000000063', 'picture') $$,
  '42501',
  null,
  'anon: product_media insert is rejected'
);

select is_empty(
  $$ select id from public.enquiries where id = '00000000-0000-0000-0000-000000000066' $$,
  'anon: enquiries select returns nothing (no public policy at all)'
);

select throws_ok(
  $$ insert into public.enquiries (name, email, message) values ('x', 'x@example.com', 'x') $$,
  '42501',
  null,
  'anon: enquiries insert is rejected'
);

reset role;

-- ===== authenticated, non-admin =====
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","app_metadata":{}}';

select throws_ok(
  $$ insert into public.products (slug, name, price_amount) values ('pgtap-test-x', 'x', 1) $$,
  '42501',
  null,
  'non-admin authenticated: products insert is rejected'
);

select throws_ok(
  $$ insert into public.product_media (product_id, media_id, kind) values ('00000000-0000-0000-0000-000000000061', '00000000-0000-0000-0000-000000000063', 'picture') $$,
  '42501',
  null,
  'non-admin authenticated: product_media insert is rejected'
);

select is_empty(
  $$ select id from public.enquiries where id = '00000000-0000-0000-0000-000000000066' $$,
  'non-admin authenticated: enquiries select returns nothing'
);

select throws_ok(
  $$ insert into public.enquiries (name, email, message) values ('x', 'x@example.com', 'x') $$,
  '42501',
  null,
  'non-admin authenticated: enquiries insert is rejected'
);

reset role;

-- ===== admin =====
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","app_metadata":{"role":"admin"}}';

select results_eq(
  $$ select count(*)::int from public.products where slug in ('pgtap-test-published', 'pgtap-test-draft') $$,
  $$ values (2) $$,
  'admin: products select sees all rows regardless of published'
);

select lives_ok(
  $$ insert into public.products (slug, name, price_amount) values ('pgtap-test-admin', 'pgtap-test: admin product', 1) $$,
  'admin: products insert succeeds'
);

select lives_ok(
  $$ update public.products set name = 'pgtap-test: published product (updated)' where id = '00000000-0000-0000-0000-000000000061' $$,
  'admin: products update succeeds'
);

select results_eq(
  $$ select count(*)::int from public.product_media where id in ('00000000-0000-0000-0000-000000000064', '00000000-0000-0000-0000-000000000065') $$,
  $$ values (2) $$,
  'admin: product_media select sees all rows regardless of parent product published'
);

select lives_ok(
  $$ insert into public.product_media (product_id, media_id, kind) values ('00000000-0000-0000-0000-000000000062', '00000000-0000-0000-0000-000000000063', 'video') $$,
  'admin: product_media insert succeeds'
);

select results_eq(
  $$ select id from public.enquiries where id = '00000000-0000-0000-0000-000000000066' $$,
  $$ values ('00000000-0000-0000-0000-000000000066'::uuid) $$,
  'admin: enquiries select sees the row'
);

select lives_ok(
  $$ update public.enquiries set status = 'actioned' where id = '00000000-0000-0000-0000-000000000066' $$,
  'admin: enquiries update succeeds'
);

-- Deliberate: even admin cannot insert — only the service-role client
-- (submit-enquiry, T5) does, with no RLS policy granting it to anyone else.
select throws_ok(
  $$ insert into public.enquiries (name, email, message) values ('x', 'x@example.com', 'x') $$,
  '42501',
  null,
  'admin: enquiries insert is still rejected (service-role only)'
);

reset role;

select * from finish();
rollback;
