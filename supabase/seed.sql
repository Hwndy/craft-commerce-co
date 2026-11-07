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
insert into public.viewpoints (key, label, x, y, zoom, sort_order, in_guided_path)
values
  ('landing', 'Landing', 0, 0, 1, 0, true),
  ('gallery', 'Gallery', 2000, 0, 1, 1, true),
  ('collage', 'Collage', 2000, 1200, 1, 2, true),
  ('shop', 'Shop', -2000, 0, 1, 3, true),
  ('about', 'About', 0, -2000, 1, 4, true),
  ('contact', 'Contact', 0, 2000, 1, 5, true)
on conflict (key) do nothing;

-- A region-label node for each new (non-Phase-1) region, so the board has
-- something to show at each viewpoint before T8's real collage content and
-- later phases' shop/about/contact content exist.
insert into public.canvas_nodes (region, node_type, x, y, width, height, published)
values
  ('collage', 'region-label', 1600, 900, 800, 600, true),
  ('shop', 'region-label', -2400, -300, 800, 600, true),
  ('about', 'region-label', -400, -2300, 800, 600, true),
  ('contact', 'region-label', -400, 1700, 800, 600, true);
