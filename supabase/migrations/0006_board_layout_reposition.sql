-- Migration 0006_board_layout_reposition (docs/decisions.md D-71, client
-- feedback 14 Nov 2026, Step 6). Repositions six already-seeded
-- viewpoints into the client's described grid around 'landing': Film
-- (gallery) top-left, Photo gallery (collage) top-right — adjacent to it,
-- same row — Product display (shop/shop-wall/shop-floor) bottom-right,
-- Contact bottom-left. 'landing' and 'about' are untouched — see
-- supabase/seed.sql's own comment on why 'about' stays at its original
-- placeholder position for now (a separate step removes it entirely).
--
-- Data-only: the viewpoints/canvas_nodes tables, columns and RLS policies
-- from migration 0002 are unchanged. Still a migration, not a hand-edit,
-- because it changes real rows already live in production (CLAUDE.md:
-- "when you create or change a database object, write a migration...").
update public.viewpoints set x = -2000, y = -1200 where key = 'gallery';
update public.viewpoints set x = 2000, y = -1200 where key = 'collage';
update public.viewpoints set x = 2000, y = 1800 where key = 'shop';
update public.viewpoints set x = 2000, y = 1200 where key = 'shop-wall';
update public.viewpoints set x = 2000, y = 2400 where key = 'shop-floor';
update public.viewpoints set x = -2000, y = 1200 where key = 'contact';

-- canvas_nodes rows move by the same translation as their own region's
-- viewpoint — a uniform shift, not a recompute from scratch — so every
-- row already in a region (the region-label placeholders seed.sql
-- inserts, and critically the real, curated `product`-type nodes
-- scripts/seed-products.ts seeds for shop-wall/shop-floor, including the
-- 8 real RIYO products already live in production, D-70) carries forward
-- its exact same position *relative to its own region*, whatever that
-- position is — this migration never needs to know or guess what it was.
-- 'landing'/'about' have no translation (0,0) and are left out entirely.
update public.canvas_nodes set x = x + 0, y = y - 2400 where region = 'collage';
update public.canvas_nodes set x = x + 4000, y = y + 1200 where region = 'shop-wall';
update public.canvas_nodes set x = x + 4000, y = y + 1200 where region = 'shop-floor';
update public.canvas_nodes set x = x - 2000, y = y - 800 where region = 'contact';
