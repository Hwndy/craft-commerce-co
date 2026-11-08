-- Migration 0003_shop_and_enquiries (Phase 3)
-- See docs/03-data-and-security.md §3 for the reference design.

create type public.product_status as enum ('available', 'sold', 'made_to_order');
create type public.product_zone as enum ('wall', 'floor');

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  price_amount numeric(12, 2) not null,
  price_currency text not null default 'GBP',
  description text,
  bullets jsonb not null default '[]'::jsonb,
  status public.product_status not null default 'available',
  zone public.product_zone not null default 'floor',
  -- FR-4.7: an optional sale flag, behind a product field rather than
  -- inferred from price history — nothing else in this schema tracks
  -- price changes, so there is no other signal a "was/now" display could
  -- derive this from.
  on_sale boolean not null default false,
  sort_order int not null default 0,
  poster_media_id uuid references public.media(id),
  video_media_id uuid references public.media(id),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger products_updated before update on public.products
  for each row execute function public.set_updated_at();

create table public.product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  media_id uuid not null references public.media(id),
  kind text not null check (kind in ('picture', 'video')),
  sort_order int not null default 0
);

create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id),
  name text not null,
  email text not null,
  message text not null,
  status text not null default 'new',
  ip_hash text,
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;
alter table public.product_media enable row level security;
alter table public.enquiries enable row level security;

create policy "public reads published products" on public.products
  for select using (published);
create policy "admin manages products" on public.products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- product_media has no published flag of its own — visible only through a
-- published parent product, same pattern as photos/photo_sets (0002).
create policy "public reads media of published products" on public.product_media
  for select using (
    exists (select 1 from public.products p where p.id = product_media.product_id and p.published)
  );
create policy "admin manages product media" on public.product_media
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- enquiries: no public policy at all — submit-enquiry (T5) inserts with the
-- service-role client, which bypasses RLS entirely, so no insert policy is
-- needed or wanted for anon/authenticated. Admin gets read + update only
-- (triaging a status, e.g. 'new' -> 'actioned'), not delete or insert.
create policy "admin reads enquiries" on public.enquiries
  for select to authenticated using (public.is_admin());
create policy "admin updates enquiries" on public.enquiries
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
