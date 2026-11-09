-- Migration 0005_pages_audit_admin (Phase 4 T1)
-- See docs/03-data-and-security.md §4 for the reference design.
--
-- Named 0005, not 0004 as that doc's own heading says: 0004 was already
-- taken by 0004_enquiry_rate_limit_fn, added as a Phase 3 T5 follow-up
-- after this doc's migration numbers were written (docs/decisions.md D-64
-- records this deviation).

-- Found in review (Greptile, PR #7, security): T2's AdminLogin only shows
-- the MFA challenge step as part of its own client-side flow — a session
-- that's already real and persisted after signInWithPassword() alone
-- (aal1) passes is_admin() exactly the same as one that actually
-- completed the second factor, because the original is_admin() (migration
-- 0001) only ever checked the role claim, never the session's assurance
-- level. Visiting /admin directly with a lingering aal1 session (closing
-- the tab mid-challenge, a stale tab, etc.) would skip MFA entirely, at
-- the one layer that actually matters — the database — not just the
-- client-side guard's own UX check.
--
-- Fixed here rather than requiring aal2 unconditionally: the owner's
-- agreement to enable MFA (docs/decisions.md owner-questions table) is
-- still pending, so admin access can't yet *require* a second factor that
-- may not exist — this requires aal2 only once the account actually has a
-- verified TOTP factor enrolled (auth.mfa_factors, Supabase's own standard
-- RLS-MFA-enforcement idiom: https://supabase.com/docs/guides/auth/auth-mfa),
-- and keeps accepting aal1 until then.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
    and (
      not exists (
        select 1 from auth.mfa_factors f
        where f.user_id = auth.uid() and f.status = 'verified'
      )
      or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    );
$$;

create table public.pages (
  key text primary key,                -- 'about', 'contact', 'home-meta'
  title text not null,
  body_markdown text not null default '',
  seo_title text,
  seo_description text,
  updated_at timestamptz not null default now()
);
create trigger pages_updated before update on public.pages
  for each row execute function public.set_updated_at();

create table public.audit_log (
  id bigint generated always as identity primary key,
  user_id uuid,
  entity text not null,
  entity_id text,
  action text not null,
  diff jsonb,
  created_at timestamptz not null default now()
);

-- Generic audit trigger (T1): records every insert/update/delete on the
-- content tables the admin curates (products, photo_sets, photos, pages).
-- security definer because the triggering admin's own session only has
-- audit_log's admin-select policy below — no insert policy for anyone —
-- so the function must bypass RLS to write its own row, the same reason
-- is_admin() itself (migration 0001) is security definer.
create or replace function public.audit_log_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_diff jsonb;
  v_entity_id text;
begin
  if tg_op = 'DELETE' then
    v_diff := jsonb_build_object('old', to_jsonb(old));
    v_entity_id := old.id::text;
  elsif tg_op = 'INSERT' then
    v_diff := jsonb_build_object('new', to_jsonb(new));
    v_entity_id := new.id::text;
  else
    v_diff := jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new));
    v_entity_id := new.id::text;
  end if;

  insert into public.audit_log (user_id, entity, entity_id, action, diff)
  values (auth.uid(), tg_table_name, v_entity_id, lower(tg_op), v_diff);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- pages has no uuid "id" column (its primary key is the text "key"), so it
-- gets its own trigger function rather than reusing audit_log_trigger's
-- `.id` assumption — same approach, one column different.
create or replace function public.audit_log_trigger_pages() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_diff jsonb;
  v_entity_id text;
begin
  if tg_op = 'DELETE' then
    v_diff := jsonb_build_object('old', to_jsonb(old));
    v_entity_id := old.key;
  elsif tg_op = 'INSERT' then
    v_diff := jsonb_build_object('new', to_jsonb(new));
    v_entity_id := new.key;
  else
    v_diff := jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new));
    v_entity_id := new.key;
  end if;

  insert into public.audit_log (user_id, entity, entity_id, action, diff)
  values (auth.uid(), tg_table_name, v_entity_id, lower(tg_op), v_diff);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger products_audit after insert or update or delete on public.products
  for each row execute function public.audit_log_trigger();
create trigger photo_sets_audit after insert or update or delete on public.photo_sets
  for each row execute function public.audit_log_trigger();
create trigger photos_audit after insert or update or delete on public.photos
  for each row execute function public.audit_log_trigger();
create trigger pages_audit after insert or update or delete on public.pages
  for each row execute function public.audit_log_trigger_pages();

alter table public.pages enable row level security;
alter table public.audit_log enable row level security;

create policy "public reads pages" on public.pages
  for select using (true);
create policy "admin manages pages" on public.pages
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- No insert/update/delete policy for anyone: audit_log is written only by
-- the trigger functions above (security definer, bypasses RLS).
create policy "admin reads audit log" on public.audit_log
  for select to authenticated using (public.is_admin());

-- No new Storage policies needed: migration 0001's admin write/update/
-- delete policies on site-media and admin "for all" on originals are
-- bucket-scoped only (not path-scoped), so they already cover every path
-- T4's upload pipeline writes to (products/, photos/, pages/, ...).
