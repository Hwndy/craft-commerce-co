-- Migration 0001_core_and_film (Phase 1)
-- See docs/03-data-and-security.md §1 for the reference design.

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
