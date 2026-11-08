-- Migration 0004_enquiry_rate_limit_fn (Phase 3 T5 follow-up)
--
-- Closes a real race in submit-enquiry's rate limiting: checking the
-- per-IP-hash count and inserting the row were two separate statements
-- from the Edge Function, with a Turnstile verification round trip
-- between them. Several concurrent requests from the same IP, each with
-- its own distinct valid Turnstile token, could all read the same
-- under-the-cap count before any of them inserted, each then inserting —
-- bypassing the 5-per-hour cap entirely (found in review, PR #2).
--
-- `pg_advisory_xact_lock(hashtext(p_ip_hash))` serializes concurrent calls
-- that share the same ip_hash for the lifetime of the calling transaction
-- (supabase-js's `.rpc()` call is one statement, i.e. one transaction) —
-- calls with different ip_hash values use different lock keys and never
-- block each other. A null ip_hash (no X-Forwarded-For header reached
-- the function) skips rate limiting entirely, same as before.
create or replace function public.insert_enquiry_rate_limited(
  p_product_id uuid,
  p_name text,
  p_email text,
  p_message text,
  p_ip_hash text,
  p_rate_limit_max int,
  p_rate_limit_window interval
) returns table (id uuid, rate_limited boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_id uuid;
begin
  if p_ip_hash is not null then
    perform pg_advisory_xact_lock(hashtext(p_ip_hash));

    select count(*) into v_count
      from public.enquiries
      where enquiries.ip_hash = p_ip_hash
        and enquiries.created_at > now() - p_rate_limit_window;

    if v_count >= p_rate_limit_max then
      return query select null::uuid, true;
      return;
    end if;
  end if;

  insert into public.enquiries (product_id, name, email, message, ip_hash)
    values (p_product_id, p_name, p_email, p_message, p_ip_hash)
    returning enquiries.id into v_id;

  return query select v_id, false;
end;
$$;

-- Only the service-role client calls this (same reasoning as the
-- enquiries table's own RLS, 0003) — never exposed to anon/authenticated.
revoke all on function public.insert_enquiry_rate_limited(uuid, text, text, text, text, int, interval) from public;
grant execute on function public.insert_enquiry_rate_limited(uuid, text, text, text, text, int, interval) to service_role;
