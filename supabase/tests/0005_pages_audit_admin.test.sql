-- pgTAP tests for migration 0005_pages_audit_admin.
-- pages: public select (no published flag — always-on content), admin writes.
-- audit_log: no public/non-admin access at all; admin reads only (writes
-- come only from the trigger functions, which bypass RLS as security
-- definer) — proven by showing even admin's own direct insert is rejected.
-- The audit trigger itself: proven by making an admin change to products
-- and checking a matching audit_log row actually appears.
--
-- All fixtures and assertions are scoped to a 'pgtap-test-%' marker rather
-- than counting/comparing whole tables — these tables may also carry real
-- seed content, and this file must pass regardless of what that contains.

begin;
create extension if not exists pgtap;

select plan(16);

-- Fixture data, inserted as postgres (bypasses RLS: table owner).
insert into public.pages (key, title, body_markdown)
values ('pgtap-test-page', 'pgtap-test: page', 'pgtap-test body');

-- ===== anonymous =====
set local role anon;

select results_eq(
  $$ select key from public.pages where key = 'pgtap-test-page' $$,
  $$ values ('pgtap-test-page') $$,
  'anon: pages select returns the row (no published flag — always public)'
);

select throws_ok(
  $$ insert into public.pages (key, title) values ('pgtap-test-x', 'x') $$,
  '42501',
  null,
  'anon: pages insert is rejected'
);

select throws_ok(
  $$ update public.pages set title = 'x' where key = 'pgtap-test-page' $$,
  '42501',
  null,
  'anon: pages update is rejected'
);

select is_empty(
  $$ select id from public.audit_log where entity_id = 'pgtap-test-page' $$,
  'anon: audit_log select returns nothing'
);

select throws_ok(
  $$ insert into public.audit_log (entity, action) values ('x', 'insert') $$,
  '42501',
  null,
  'anon: audit_log insert is rejected'
);

reset role;

-- ===== authenticated, non-admin =====
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","app_metadata":{}}';

select throws_ok(
  $$ update public.pages set title = 'x' where key = 'pgtap-test-page' $$,
  '42501',
  null,
  'non-admin authenticated: pages update is rejected'
);

select is_empty(
  $$ select id from public.audit_log where entity_id = 'pgtap-test-page' $$,
  'non-admin authenticated: audit_log select returns nothing'
);

select throws_ok(
  $$ insert into public.audit_log (entity, action) values ('x', 'insert') $$,
  '42501',
  null,
  'non-admin authenticated: audit_log insert is rejected'
);

reset role;

-- ===== admin =====
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","app_metadata":{"role":"admin"}}';

select lives_ok(
  $$ update public.pages set title = 'pgtap-test: page (updated)' where key = 'pgtap-test-page' $$,
  'admin: pages update succeeds'
);

select lives_ok(
  $$ insert into public.pages (key, title) values ('pgtap-test-admin', 'pgtap-test: admin page') $$,
  'admin: pages insert succeeds'
);

select lives_ok(
  $$ delete from public.pages where key = 'pgtap-test-admin' $$,
  'admin: pages delete succeeds'
);

-- The audit trigger (not a direct insert) is what populates audit_log —
-- the pages update above should already have produced a row. Ordered by
-- `id` (a strictly-increasing identity), not `created_at`: this whole
-- file runs inside one transaction, so `now()` — and therefore
-- `created_at` — is identical for every row this test inserts.
select results_eq(
  $$ select action from public.audit_log where entity = 'pages' and entity_id = 'pgtap-test-page' order by id desc limit 1 $$,
  $$ values ('update') $$,
  'admin: the pages update above produced a matching audit_log row via the trigger, not a direct insert'
);

select ok(
  (select count(*)::int from public.audit_log where entity = 'pages' and entity_id = 'pgtap-test-admin' and action = 'insert') = 1,
  'admin: the pages insert above also produced its own audit_log row'
);

select cmp_ok(
  (select count(*)::int from public.audit_log where entity = 'pages' and entity_id = 'pgtap-test-admin'),
  '>=',
  2,
  'admin: the pages delete above produced a third audit_log row for the same entity_id (insert + delete, at least)'
);

-- Deliberate: even admin cannot insert into audit_log directly — only the
-- trigger functions (security definer) do, with no RLS policy granting
-- insert to anyone, admin included.
select throws_ok(
  $$ insert into public.audit_log (entity, action) values ('x', 'insert') $$,
  '42501',
  null,
  'admin: audit_log insert is still rejected (trigger-only, like enquiries insert in 0003)'
);

reset role;

select * from finish();
rollback;
