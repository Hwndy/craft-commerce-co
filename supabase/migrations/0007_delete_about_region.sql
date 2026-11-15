-- Migration 0007_delete_about_region (docs/decisions.md D-71, client
-- feedback 14 Nov 2026, Step 9). Removes the About region outright, now
-- that Step 6's board reposition centres the seal itself in the spot
-- About used to occupy alone — there's nothing left for a separate About
-- region to hold. About never had any admin-curated content nodes of its
-- own (its content was static, src/features/about/About.tsx, now also
-- deleted) — only its `viewpoints` row and the same placeholder
-- `region-label` canvas_nodes row every still-undecorated region got from
-- supabase/seed.sql — so this is a clean, two-row delete, not a schema
-- change.
delete from public.canvas_nodes where region = 'about';
delete from public.viewpoints where key = 'about';
