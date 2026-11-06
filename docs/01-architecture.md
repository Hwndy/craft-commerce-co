# Architecture

## 1. Overview

```
Browser (Safari / Chrome)
  |-- Vercel (front end only): static assets + prerendered region snapshots
  |      React SPA (Vite): landing, canvas world, list view, admin
  |
  |-- Supabase
         Postgres + RLS        products, media, nodes, viewpoints, enquiries, pages
         Auth                  owner login (no public sign-up)
         Storage + CDN         site-media (public): images, HLS film, product videos
                               originals (private)
         Edge Functions        submit-enquiry
         Database webhook      content published -> Vercel deploy hook (rebuild prerender)
  |-- Resend (email), Sentry (errors), analytics
```

## 2. Routes

| Route | Purpose |
|---|---|
| `/` | Landing page (existing) with "Click to enter" |
| `/gallery` | Board focused on the Gallery region; film layer first |
| `/gallery/photo/:id` | Photo viewer over the collage |
| `/shop` | Board focused on the Shop region |
| `/shop/:slug` | Product overlay |
| `/about`, `/contact` | Board focused on those regions |
| `/list` | Accessible list view of all content (also `/list/:region`) |
| `/admin/*` | Admin (guarded, `noindex`) |

Every route maps to a viewpoint (camera position). The router is the source of truth for **where** the visitor is; the canvas store is the source of truth for the **exact** camera.

## 3. Environment variables

| Name | Where | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | client | public |
| `VITE_SUPABASE_ANON_KEY` | client | public (anon / publishable key) |
| `VITE_FILM_AUTOSTART` | client | `true` by default; see D-01 |
| `VITE_TURNSTILE_SITE_KEY` | client | Phase 3 |
| `SUPABASE_SERVICE_ROLE_KEY` | local scripts only | never in client, never committed |
| `RESEND_API_KEY`, `OWNER_EMAIL`, `TURNSTILE_SECRET` | Edge Function secrets | `supabase secrets set` |
| `VERCEL_DEPLOY_HOOK_URL` | Supabase webhook config | Phase 4 |

Validate client variables with Zod in `src/lib/env.ts`; the app must fail loudly at startup if one is missing.

## 4. State and data

- **Server state**: TanStack Query with query keys per resource (`['film']`, `['products']`, ...). Public reads use the anon key. Set sensible `staleTime` (minutes) because content changes rarely.
- **Canvas and entry state**: Zustand stores (`useCameraStore`, `useEntryStore`, `useFilmStore`).
- **Forms**: react-hook-form with Zod resolvers.
- **Errors**: an error boundary per region so one failing region never blanks the board; user-friendly messages; Sentry capture.

## 5. Media rules

- Public media is served from the `site-media` bucket through Supabase's CDN. Immutable files (segments, renditions) use long cache headers; playlists and manifests use short ones.
- Images are WebP in renditions of 256, 640, 1280 and 2048 px created **before** upload (script in Phase 2, in-browser in Phase 4), so Supabase image transformations (paid) are not needed.
- The film is encoded to HLS by `scripts/encode-hls.sh`; product videos are short MP4 loops.

## 6. Prerendering and SEO

The canvas is invisible to crawlers, so each region is prerendered to static HTML at build time with title, description, Open Graph tags and structured data, and the SPA hydrates over it. The mechanism (for example a static-site-generation plugin for Vite, or a post-build Playwright snapshot step) is chosen in Phase 5 and recorded in `decisions.md`. Content is fetched from Supabase at build time; a database webhook triggers a rebuild on publish.

## 7. Security summary

RLS everywhere, admin by JWT role claim, service key never in the client, Auth sign-up disabled, CSP and security headers in `vercel.json`, Turnstile on the enquiry form, rate limit by IP hash. Details in `03-data-and-security.md`.

## 8. Naming and style

- Components `PascalCase.tsx`, hooks `useThing.ts`, pure modules `kebab-case.ts`.
- One component per file; feature folders contain `components/`, `hooks/`, `lib/` and `index.ts` as the public surface.
- Absolute imports with the `@/` alias already configured by the repo.
- CSS: Tailwind utilities plus CSS variables for design tokens (see `04-design-and-motion.md`).
