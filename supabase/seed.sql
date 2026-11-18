-- Local/staging seed data. No secrets, no real content — placeholders only.
-- Phase 1: the film row itself is inserted by scripts/upload-film.ts once the
-- test film is encoded and uploaded (T4), not seeded here, since it needs a
-- real Storage path. This file is a placeholder for later phases' seed data
-- (photos, products) to extend.

-- Phase 2: viewpoints (docs/02-canvas-spec.md §6, guided path order from
-- docs/00-product-brief.md §3: Landing, Film, Collage, Shop, About,
-- Contact). landing keeps the exact x/y/zoom src/canvas/viewpoints.ts used
-- in Phase 1 — swapping the static registry for this table must not move
-- the camera anywhere the already-verified entry sequence/gate flow
-- doesn't expect.
--
-- Repositioned (docs/decisions.md D-71, client feedback 14 Nov 2026) into
-- the client's own described grid around landing: Film (gallery) top-left,
-- Photo gallery (collage) top-right — adjacent to it, same row — Product
-- display (shop) bottom-right, Contact bottom-left. 'about' is gone
-- entirely (Step 9) — the client wants the seal itself to hold the
-- board's "middle" spot everything else is centred around, so there's no
-- About region left to place anywhere.
--
-- Phase 3 (T1, phases/PHASE-3-shop-and-enquiry.md): 'shop' is a non-guided
-- overview anchor (List view's single "Shop" entry point; the minimap's
-- sense of "the shop area" as a whole). 'shop-wall' and 'shop-floor' are
-- two distinct, named viewpoints — docs/decisions.md D-71's "sixth
-- correction" points both at the SAME (2000, 1200) spot, not either side
-- of 'shop' (y ± 1200) as originally laid out here: the owner's own 3D
-- room design shows the walls and floor together as one continuous
-- scene, so there's nothing distinct left at a separate "floor" position
-- for the second viewpoint to show — see src/features/shop/ShopRegion.
-- tsx's own comment for the real CI failure (a Playwright strict-mode
-- violation on a duplicated product name) this traces back to.
--
-- D-78 (migration 0009, client feedback 18 Nov 2026): the room's own
-- wall/floor labels are gone too now, so 'shop-floor' no longer earns its
-- own guided-path stop right next to 'shop-wall''s identical camera
-- position — relabelled 'shop-wall' to "The Shop" and dropped
-- 'shop-floor' from the guided path (it's still a real viewpoint, just
-- `in_guided_path = false` — see that migration's own comment).
insert into public.viewpoints (key, label, x, y, zoom, sort_order, in_guided_path)
values
  ('landing', 'Landing', 0, 0, 1, 0, true),
  ('gallery', 'Gallery', -2000, -1200, 1, 1, true),
  ('collage', 'Collage', 2000, -1200, 1, 2, true),
  ('shop', 'Shop', 2000, 1800, 1, 3, false),
  ('shop-wall', 'The Shop', 2000, 1200, 1, 4, true),
  ('shop-floor', 'Shop (floor)', 2000, 1200, 1, 5, false),
  ('contact', 'Contact', -2000, 1200, 1, 6, true)
on conflict (key) do update set
  x = excluded.x, y = excluded.y, zoom = excluded.zoom,
  sort_order = excluded.sort_order, in_guided_path = excluded.in_guided_path;

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
  ('collage', 'region-label', 1600, -1500, 800, 600, true),
  ('shop-wall', 'region-label', 1600, 900, 800, 600, true),
  ('shop-floor', 'region-label', 1600, 2100, 800, 600, true),
  ('contact', 'region-label', -2400, 900, 800, 600, true);
