-- Local/staging seed data. No secrets, no real content — placeholders only.
-- Phase 1: the film row itself is inserted by scripts/upload-film.ts once the
-- test film is encoded and uploaded (T4), not seeded here, since it needs a
-- real Storage path. This file is a placeholder for later phases' seed data
-- (photos, products) to extend.

-- Phase 2: viewpoints (docs/02-canvas-spec.md §6, guided path order from
-- docs/00-product-brief.md §3: Landing, Film, Collage, Shop, About,
-- Contact). landing/gallery keep the exact x/y/zoom src/canvas/viewpoints.ts
-- used in Phase 1 — swapping the static registry for this table must not
-- move the camera anywhere the already-verified entry sequence/gate flow
-- doesn't expect. collage/shop/about/contact positions are placeholders in
-- a simple radial layout (D-14's mind-map default: ALL LIFE/landing at the
-- centre, regions around it) pending the owner's actual board-layout
-- confirmation (phases/PHASE-2-canvas-and-collage.md "Owner inputs needed").
-- Phase 3 (T1, phases/PHASE-3-shop-and-enquiry.md): 'shop' keeps its old
-- position as a non-guided overview anchor (List view's single "Shop"
-- entry point; the minimap's sense of "the shop area" as a whole) — two
-- new guided-path stops, 'shop-wall' and 'shop-floor', sit either side of
-- it, same spatial relationship 'collage' already has to 'gallery' (y+1200).
-- Unlike the Gallery area (one 'gallery' guided stop, no separate
-- "overview"), Shop's two regions are different enough in kind (wall:
-- hung/framed; floor: laid out, T2) that neither alone reads as "the shop,"
-- so a third, non-guided anchor stands in for the area as a whole.
insert into public.viewpoints (key, label, x, y, zoom, sort_order, in_guided_path)
values
  ('landing', 'Landing', 0, 0, 1, 0, true),
  ('gallery', 'Gallery', 2000, 0, 1, 1, true),
  ('collage', 'Collage', 2000, 1200, 1, 2, true),
  ('shop', 'Shop', -2000, 600, 1, 3, false),
  ('shop-wall', 'Shop (wall)', -2000, 0, 1, 4, true),
  ('shop-floor', 'Shop (floor)', -2000, 1200, 1, 5, true),
  ('about', 'About', 0, -2000, 1, 6, true),
  ('contact', 'Contact', 0, 2000, 1, 7, true)
on conflict (key) do nothing;

-- A region-label node for each region without any real content node yet.
-- Harmless once a region gets real nodes — Collage.tsx computes its own
-- layout from the photos table and never reads canvas_nodes at all, so its
-- row below is only ever seen by the generic list-view fallback
-- (ListRegion.tsx); shop-wall/shop-floor are different — unlike photos'
-- generative phyllotaxis spiral, product positions are curated (an admin
-- arranging a real display), so T2's ShopWall.tsx/ShopFloor.tsx DO read
-- real 'product'-type canvas_nodes rows (see below) — their region-label
-- rows exist only until a real product node is seeded for that region,
-- which scripts/seed-products.ts now does.
insert into public.canvas_nodes (region, node_type, x, y, width, height, published)
values
  ('collage', 'region-label', 1600, 900, 800, 600, true),
  ('shop-wall', 'region-label', -2400, -300, 800, 600, true),
  ('shop-floor', 'region-label', -2400, 900, 800, 600, true),
  ('about', 'region-label', -400, -2300, 800, 600, true),
  ('contact', 'region-label', -400, 1700, 800, 600, true);
