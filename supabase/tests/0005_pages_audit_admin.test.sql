-- pgTAP tests for migration 0005_pages_audit_admin.
-- pages: public select (no published flag — always-on content), admin writes.
-- audit_log: no public/non-admin access at all; admin reads only (writes
-- come only from the trigger functions, which bypass RLS as security
-- definer) — proven by showing even admin's own direct insert is rejected.
-- The audit trigger itself: proven both ways — audit_log_trigger_pages()
-- via an admin change to pages, and the separate, shared
-- audit_log_trigger() (products/photo_sets/photos) via an admin change to
-- products (found in review, Greptile + CodeRabbit, PR #6: the original
-- version of this file only ever exercised the pages-specific function,
-- so a real bug in the generic one would have blocked every admin write
-- to those three tables with nothing here to catch it).
--
-- All fixtures and assertions are scoped to a 'pgtap-test-%' marker rather
-- than counting/comparing whole tables — these tables may also carry real
-- seed content, and this file must pass regardless of what that contains.

begin;
create extension if not exists pgtap;

select plan(19);

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

-- Found in review (Greptile P1 + CodeRabbit, PR #6): UPDATE against a row
-- invisible under RLS silently affects 0 rows, no exception — throws_ok
-- here would itself fail (nothing is thrown), blocking CI's
-- `supabase test db` step. Same pattern migration 0001's own test file
-- already established: run the bare statement as the role, reset to the
-- table owner, then check the row wasn't actually changed.
update public.pages set title = 'pgtap-test: anon tried this' where key = 'pgtap-test-page';
reset role;
select is(
  (select title from public.pages where key = 'pgtap-test-page'),
  'pgtap-test: page',
  'anon: pages update does not change the row (not visible under RLS)'
);
set local role anon;

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

update public.pages set title = 'pgtap-test: non-admin tried this' where key = 'pgtap-test-page';
reset role;
select is(
  (select title from public.pages where key = 'pgtap-test-page'),
  'pgtap-test: page',
  'non-admin authenticated: pages update does not change the row'
);
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","app_metadata":{}}';

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

-- Found in review (Greptile P1, PR #6): the `reset role;` that used to be
-- right here left every assertion below running as `postgres` (the table
-- owner, which bypasses RLS entirely) — the direct audit_log insert
-- further down would then wrongly *succeed* instead of raising 42501,
-- failing its own throws_ok, and the products insert would stop actually
-- testing the admin path. Re-establishing the same admin role+claims
-- (nothing below needs a *different* identity) instead of resetting.

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

-- The separate, generic audit_log_trigger() (products/photo_sets/photos)
-- — a real products row (migration 0003), not pages, so this proves the
-- *other* trigger function actually works too, not just pages' own.
select lives_ok(
  $$ insert into public.products (slug, name, price_amount) values ('pgtap-test-audit-product', 'pgtap-test: audit product', 1) $$,
  'admin: products insert succeeds'
);

select results_eq(
  $$ select action from public.audit_log where entity = 'products' and entity_id = (select id::text from public.products where slug = 'pgtap-test-audit-product') $$,
  $$ values ('insert') $$,
  'admin: the products insert above produced a matching audit_log row via the shared audit_log_trigger(), not just the pages-specific one'
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

-- Found in review (Greptile, PR #7, security): is_admin() above now also
-- requires aal2 once the account has a *verified* MFA factor — role=admin
-- alone is no longer enough for this one user. Deliberately last: an
-- earlier assertion (just above) already locked in the audit_log
-- ordering it needs from "the pages update" being the most recent write
-- to that row, and the aal1 case below is itself an is_admin()-returns-
-- false case, so (same lesson as the anon/non-admin UPDATE fix earlier in
-- this file) it affects 0 rows rather than throwing — asserted by
-- checking the row is unchanged, not with throws_ok. Every other admin
-- assertion in this file never sets a `sub` claim, so auth.uid() is null
-- there and this fixture (scoped to a real sub) can't affect them.
--
-- Found in review (Greptile P1, PR #6): auth.mfa_factors.user_id
-- references auth.users.id — inserting the factor alone, with no parent
-- user row, fails on the foreign key before either assertion below runs.
-- Parent row inserted first, same transaction, same '00000000-...-71' id.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000071',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'pgtap-test-mfa@example.com',
  'x',
  now(),
  now(),
  now()
);

-- Found in review (real CI failure, not a bot finding this time):
-- auth.mfa_factors.created_at/updated_at are not-null with no default on
-- the version CI runs — omitting them (as this insert originally did)
-- fails with "null value in column \"created_at\" ... violates not-null
-- constraint", not the FK error the auth.users fixture above was already
-- added for.
insert into auth.mfa_factors (id, user_id, status, factor_type, friendly_name, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000070', '00000000-0000-0000-0000-000000000071', 'verified', 'totp', 'pgtap-test factor', now(), now());

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000071","aal":"aal1","app_metadata":{"role":"admin"}}';

update public.pages set title = 'pgtap-test: aal1 tried this' where key = 'pgtap-test-page';
reset role;
select isnt(
  (select title from public.pages where key = 'pgtap-test-page'),
  'pgtap-test: aal1 tried this',
  'admin with a verified MFA factor, at aal1: pages update does not change the row (MFA not completed this session)'
);

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000071","aal":"aal2","app_metadata":{"role":"admin"}}';

select lives_ok(
  $$ update public.pages set title = 'pgtap-test: page (updated by aal2)' where key = 'pgtap-test-page' $$,
  'admin with a verified MFA factor, at aal2: pages update succeeds'
);

reset role;

select * from finish();
rollback;
