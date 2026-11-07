-- Migration 0002_canvas_and_photos (Phase 2)
-- See docs/03-data-and-security.md §2 for the reference design.

create table public.viewpoints (
  key text primary key,
  label text not null,
  x double precision not null,
  y double precision not null,
  zoom double precision not null,
  sort_order int not null default 0,
  in_guided_path boolean not null default true
);

create table public.canvas_nodes (
  id uuid primary key default gen_random_uuid(),
  region text not null,
  node_type text not null check (node_type in ('image', 'video', 'text', 'product', 'button', 'link', 'region-label')),
  ref_table text,
  ref_id uuid,
  x double precision not null,
  y double precision not null,
  width double precision not null,
  height double precision not null,
  rotation double precision not null default 0,
  layer int not null default 0,
  zoom_min double precision not null default 0,
  zoom_max double precision not null default 100,
  published boolean not null default true
);

create table public.photo_sets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  location text,
  shoot_date date,
  sort_order int not null default 0,
  published boolean not null default false
);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.photo_sets(id) on delete cascade,
  media_id uuid not null references public.media(id),
  title text not null,
  taken_on date,
  sort_order int not null default 0
);

alter table public.viewpoints enable row level security;
alter table public.canvas_nodes enable row level security;
alter table public.photo_sets enable row level security;
alter table public.photos enable row level security;

-- viewpoints: no published flag of its own — always public, admin-managed.
create policy "public reads viewpoints" on public.viewpoints
  for select using (true);
create policy "admin manages viewpoints" on public.viewpoints
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "public reads published canvas nodes" on public.canvas_nodes
  for select using (published);
create policy "admin manages canvas nodes" on public.canvas_nodes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "public reads published photo sets" on public.photo_sets
  for select using (published);
create policy "admin manages photo sets" on public.photo_sets
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- photos have no published flag of their own — visible only through a
-- published parent set.
create policy "public reads photos in published sets" on public.photos
  for select using (
    exists (select 1 from public.photo_sets s where s.id = photos.set_id and s.published)
  );
create policy "admin manages photos" on public.photos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
