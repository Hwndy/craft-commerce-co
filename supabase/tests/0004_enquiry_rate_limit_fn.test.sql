-- pgTAP tests for migration 0004_enquiry_rate_limit_fn.
-- insert_enquiry_rate_limited(): the atomic check-then-insert that closes
-- the concurrent-requests race submit-enquiry's own separate count/insert
-- calls had (PR #2 review).

begin;
create extension if not exists pgtap;

select plan(7);

-- ===== service_role: normal insert under the cap =====
set local role service_role;

select results_eq(
  $$ select rate_limited from public.insert_enquiry_rate_limited(
       null, 'pgtap-test: enquirer', 'test@example.com', 'pgtap-test: message',
       'pgtap-test-ip-hash-a', 5, interval '1 hour'
     ) $$,
  $$ values (false) $$,
  'service_role: inserts and reports not rate-limited when under the cap'
);

select results_eq(
  $$ select count(*)::int from public.enquiries where ip_hash = 'pgtap-test-ip-hash-a' $$,
  $$ values (1) $$,
  'service_role: the row was actually inserted'
);

-- ===== rate limit enforcement =====
-- Fill the cap (4 more, for 5 total) directly, bypassing the function —
-- simulates rows the function itself already inserted in earlier calls.
insert into public.enquiries (name, email, message, ip_hash)
select 'pgtap-test: filler', 'filler@example.com', 'pgtap-test: filler', 'pgtap-test-ip-hash-b'
from generate_series(1, 5);

select results_eq(
  $$ select rate_limited from public.insert_enquiry_rate_limited(
       null, 'pgtap-test: enquirer', 'test@example.com', 'pgtap-test: message',
       'pgtap-test-ip-hash-b', 5, interval '1 hour'
     ) $$,
  $$ values (true) $$,
  'service_role: reports rate-limited once the cap is reached'
);

select results_eq(
  $$ select count(*)::int from public.enquiries where ip_hash = 'pgtap-test-ip-hash-b' $$,
  $$ values (5) $$,
  'service_role: a rate-limited call does not insert a 6th row'
);

-- ===== outside the window =====
insert into public.enquiries (name, email, message, ip_hash, created_at)
select 'pgtap-test: old filler', 'old@example.com', 'pgtap-test: old', 'pgtap-test-ip-hash-c', now() - interval '2 hours'
from generate_series(1, 5);

select results_eq(
  $$ select rate_limited from public.insert_enquiry_rate_limited(
       null, 'pgtap-test: enquirer', 'test@example.com', 'pgtap-test: message',
       'pgtap-test-ip-hash-c', 5, interval '1 hour'
     ) $$,
  $$ values (false) $$,
  'service_role: rows outside the window do not count toward the cap'
);

-- ===== null ip_hash skips rate limiting entirely =====
select results_eq(
  $$ select rate_limited from public.insert_enquiry_rate_limited(
       null, 'pgtap-test: enquirer', 'test@example.com', 'pgtap-test: message',
       null, 1, interval '1 hour'
     ) $$,
  $$ values (false) $$,
  'service_role: a null ip_hash is never rate-limited'
);

reset role;

-- ===== anon / authenticated cannot call this at all =====
set local role anon;

select throws_ok(
  $$ select * from public.insert_enquiry_rate_limited(
       null, 'x', 'x@example.com', 'x', 'pgtap-test-ip-hash-d', 5, interval '1 hour'
     ) $$,
  '42501',
  null,
  'anon: cannot execute insert_enquiry_rate_limited'
);

reset role;

select * from finish();
rollback;
