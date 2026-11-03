# Data model, row-level security and Edge Functions

All tables live in `public`, have RLS enabled in the migration that creates them, and are covered by pgTAP tests. The SQL below is the reference design: split it into the migrations named in each heading, and adjust names only if you record why in `decisions.md`.

## 0. Conventions

- Primary keys are `uuid default gen_random_uuid()` unless stated.
- `created_at` / `updated_at` are `timestamptz`; `updated_at` is maintained by a trigger.
- Public content tables have `published boolean`; media has `status`.
- The owner is identified by the JWT claim `app_metadata.role = 'admin'`, set once by hand (or script) for the owner's auth user.

## 1. Migration `0001_core_and_film` (Phase 1)

```sql
create extension if not exists pgcrypto;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

create type public.media_kind as enum ('image', 'video', 'hls');
create type public.media_status as enum ('processing', 'ready', 'failed');

create table public.media (
  id uuid primary key default gen_random_uuid(),
  kind public.media_kind not null,
  storage_path text not null,        -- path inside bucket site-media (a folder for HLS)
  hls_master text,                   -- master playlist path when kind = 'hls'
  poster_path text,
  sprite_path text,                  -- tiled scrub thumbnails
  sprite_meta jsonb,                 -- {"cols":10,"rows":10,"w":160,"h":90,"interval":5}
  width int, height int, duration_s numeric,
  alt_text text,
  blur_data_url text,                -- tiny base64 placeholder
  renditions jsonb not null default '{}'::jsonb,   -- {"256": "path", "640": "path", ...}
  status public.media_status not null default 'processing',
  created_at timestamptz not null default now()
);

create table public.gallery_film (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.media(id),
  title text not null,
  captions_path text,
  version int not null default 1,    -- bump to re-lock the first-watch gate
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger gallery_film_updated before update on public.gallery_film
  for each row execute function public.set_updated_at();

alter table public.media enable row level security;
alter table public.gallery_film enable row level security;

create policy "public reads ready media" on public.media
  for select using (status = 'ready');
create policy "admin manages media" on public.media
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "public reads published film" on public.gallery_film
  for select using (published);
create policy "admin manages film" on public.gallery_film
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Storage
insert into storage.buckets (id, name, public) values ('site-media', 'site-media', true)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('originals', 'originals', false)
  on conflict (id) do nothing;

create policy "public reads site-media" on storage.objects
  for select using (bucket_id = 'site-media');
create policy "admin writes site-media" on storage.objects
  for insert to authenticated with check (bucket_id = 'site-media' and public.is_admin());
create policy "admin updates site-media" on storage.objects
  for update to authenticated using (bucket_id = 'site-media' and public.is_admin());
create policy "admin deletes site-media" on storage.objects
  for delete to authenticated using (bucket_id = 'site-media' and public.is_admin());
create policy "admin manages originals" on storage.objects
  for all to authenticated using (bucket_id = 'originals' and public.is_admin())
  with check (bucket_id = 'originals' and public.is_admin());
```

Local scripts that upload the film use the service-role key and therefore bypass these policies; keep that key out of the repository.

## 2. Migration `0002_canvas_and_photos` (Phase 2)

```sql
create table public.viewpoints (
  key text primary key,
  label text not null,
  x double precision not null, y double precision not null, zoom double precision not null,
  sort_order int not null default 0,
  in_guided_path boolean not null default true
);

create table public.canvas_nodes (
  id uuid primary key default gen_random_uuid(),
  region text not null,
  node_type text not null check (node_type in ('image','video','text','product','button','link','region-label')),
  ref_table text, ref_id uuid,
  x double precision not null, y double precision not null,
  width double precision not null, height double precision not null,
  rotation double precision not null default 0,
  layer int not null default 0,
  zoom_min double precision not null default 0,
  zoom_max double precision not null default 100,
  published boolean not null default true
);

create table public.photo_sets (
  id uuid primary key default gen_random_uuid(),
  title text not null, location text, shoot_date date,
  sort_order int not null default 0, published boolean not null default false
);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.photo_sets(id) on delete cascade,
  media_id uuid not null references public.media(id),
  title text not null, taken_on date,
  sort_order int not null default 0
);
```

RLS: `viewpoints` and `canvas_nodes` public `select` (nodes where `published`), `photo_sets` public `select where published`, `photos` public `select` only when the parent set is published (`exists (select 1 from photo_sets s where s.id = set_id and s.published)`), and an admin `for all` policy on each.

## 3. Migration `0003_shop_and_enquiries` (Phase 3)

```sql
create type public.product_status as enum ('available', 'sold', 'made_to_order');
create type public.product_zone as enum ('wall', 'floor');

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  price_amount numeric(12,2) not null,
  price_currency text not null default 'GBP',
  description text,
  bullets jsonb not null default '[]'::jsonb,
  status public.product_status not null default 'available',
  zone public.product_zone not null default 'floor',
  sort_order int not null default 0,
  poster_media_id uuid references public.media(id),
  video_media_id uuid references public.media(id),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  media_id uuid not null references public.media(id),
  kind text not null check (kind in ('picture','video')),
  sort_order int not null default 0
);

create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id),
  name text not null, email text not null, message text not null,
  status text not null default 'new',
  ip_hash text,
  created_at timestamptz not null default now()
);
```

RLS: products and product_media public `select` where published (media via parent); `enquiries` has **no public policies at all** (the Edge Function inserts with the service role); admin can `select` and `update`.

## 4. Migration `0004_pages_audit_admin` (Phase 4)

```sql
create table public.pages (
  key text primary key,                -- 'about', 'contact', 'home-meta'
  title text not null, body_markdown text not null default '',
  seo_title text, seo_description text,
  updated_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  user_id uuid, entity text not null, entity_id text, action text not null,
  diff jsonb, created_at timestamptz not null default now()
);
```

`pages`: public `select`, admin `for all`. `audit_log`: admin `select` only; rows written by a generic trigger function attached to the content tables (insert, update, delete). Add admin policies on Storage for the upload paths the admin needs.

## 5. Tests (pgTAP, `supabase/tests/`)

For each table: as `anon`, `select` returns only published/ready rows; `insert`, `update`, `delete` fail; as a user whose JWT carries `app_metadata.role = 'admin'`, all succeed; as an authenticated non-admin user, writes fail. For Storage: anonymous can read `site-media` objects but cannot write; admin can.

## 6. Edge Function `submit-enquiry` (Phase 3)

- Method POST, JSON body validated with Zod: `name` (1 to 120), `email` (valid, max 254), `message` (1 to 4000), optional `productId` (uuid), `turnstileToken`, and a hidden `website` honeypot that must be empty.
- Verify the Turnstile token server-side with `TURNSTILE_SECRET`.
- Rate limit: hash the client IP with a server-side salt; reject if the same hash has 5 or more enquiries in the last hour.
- Insert into `enquiries` with the service-role client, then send an email through Resend to `OWNER_EMAIL` with `Reply-To` set to the visitor. If email sending fails, keep the stored row and return success to the visitor, but log the failure.
- CORS: only the production and preview origins. Return `{ ok: true }` on success; generic error messages (no stack traces).
- Never log names, emails or message bodies.

## 7. Auth

Disable public sign-ups in the Supabase dashboard. Invite the owner by email, set the `admin` role claim in `app_metadata` (SQL or the admin API from a local script), enable MFA for the owner, and use a strong password policy. Sessions refresh automatically with supabase-js.
