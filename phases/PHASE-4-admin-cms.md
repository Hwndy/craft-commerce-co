# Phase 4: Admin / CMS

**Goal.** The owner signs in on a phone or laptop and manages products, photo sets, page copy, board layout and enquiries without a developer, and publishing refreshes the public site.

**Read first:** `AGENTS.md`, `docs/00-product-brief.md` (FR-7, FR-8.11), `docs/03-data-and-security.md` (migration 0004, Auth), `docs/01-architecture.md`, `supabase/CLAUDE.md`. Phases 1 to 3 must be accepted.

**Cost phase:** Phase 3 in the PRD/TRD (packages 8 and 10).

## Owner inputs needed

- [ ] The owner's email for the admin invite; agreement to enable MFA.
- [ ] Final About and Contact copy and SEO titles and descriptions.
- [ ] Vercel deploy hook URL (created in the Vercel project settings) for the publish webhook.

## Checklist

### T1. Migration and policies
- [x] Migration `0005_pages_audit_admin` (renamed from the brief's `0004` — see `docs/decisions.md` D-64): `pages`, `audit_log`, generic audit trigger on `products`/`photo_sets`/`photos`/`pages`, no new Storage policies needed (0001's admin policies are bucket-scoped, already cover every path). pgTAP tests for each — can't run locally (no Docker in this sandbox); needs real CI.
- [x] Script `scripts/make-admin.ts` that sets `app_metadata.role = 'admin'` for the owner's auth user using the service-role key (local only).
- [x] Disable public sign-ups and invite the owner (document the dashboard steps in `docs/admin-setup.md`). **The dashboard steps themselves still need the owner to actually do them** — this is documentation for a manual process, not something this codebase can do for them.

### T2. Auth and guard
- [x] `/admin/login` (email+password, MFA challenge step when a factor is enrolled), a separate `/admin/mfa-setup` enrollment screen, session handling (`onAuthStateChange`), sign-out, password reset (request + `/admin/reset-password` completion). `AdminGuard` checks the JWT role claim client-side (UX only — RLS is the real enforcement). `NoIndex` on every `/admin/*` route.
- [x] Tests: unauthenticated → redirected to `/admin/login`; authenticated non-admin → "No access" shown in place (`AdminGuard.test.tsx`). "Every write fails at the database" is pgTAP's job (T1, already proven for `pages`/`audit_log`; the same admin-role policies already cover `products`/`photo_sets`/`photos` from Phases 2/3).

### T3. Admin shell
- [x] Mobile-first layout with shadcn components: bottom navigation on phones, sidebar on desktop; sections Products, Photos, Pages, Layout, Enquiries. Each section is a real nested route under `/admin` (`AdminShell.tsx`'s `<Outlet/>`) with a placeholder naming the task that builds its real CRUD (T5–T9) — no content built ahead.
- [x] Consistent patterns, built domain-agnostic for T5–T9 to each instantiate: `AdminList` (list+search), `AdminEditDrawer` (edit drawer, wraps `ui/sheet.tsx`), `useOptimisticMutation` (optimistic update + rollback, TanStack Query), `sonner`'s `toast()` (clear error toasts, matching the existing convention), `useUnsavedChangesWarning` (beforeunload + guarded in-app navigation — no `useBlocker`, since `App.tsx` uses a plain `BrowserRouter`).

### T4. Uploads with client-side renditions (D-15)
- [x] `src/features/admin/lib/image-pipeline.ts` (+ `image-codec.ts` for the actual browser-API-touching step): read a file, correct EXIF orientation (`createImageBitmap({imageOrientation:"from-image"})`), resize with canvas into WebP renditions (256, 640, 1280, 2048 px — the exact string keys Phase 2/3 UI already reads), generate a tiny blur data URL, upload each to `site-media`, then insert the `media` row as `ready` only when all uploads succeed. Per-file progress and retry via `MediaUploadField.tsx` (domain-agnostic — T5/T6 each wire it to their own real form). No new dependency: native browser APIs only.
- [x] Limits: images up to 25 MB (enforced before decoding); product videos up to 100 MB as MP4/WebM, direct upload, no transcoding (`video-upload.ts`), with a poster captured from a chosen frame in the browser via `captureVideoFrame()`, fed into the same image pipeline as an ordinary image. See docs/decisions.md D-69 for a real gap this surfaced and fixed in `ProductOverlay.tsx` (it only ever tried to play a video via HLS; now falls back to the direct file).
- [x] Unit tests for rendition sizing and naming (`image-pipeline.test.ts`, `video-upload.test.ts`, `MediaUploadField.test.tsx`). **The e2e test is deferred to T5/T6** — see docs/decisions.md D-69: a dev-route-based harness (the original plan) turned out unreachable by the real Playwright run (`import.meta.env.DEV` is `false` in the production build CI's `npm run preview` serves, confirmed directly), and no admin-auth e2e fixture exists yet (T11's own job) to drive a real admin-guarded page instead — one will exist as soon as T5 or T6 gives `MediaUploadField` a real home.

### T5. Products (FR-7.2)
- [ ] Create, edit, reorder (drag or up/down buttons), set status, zone, price, description and bullets, attach pictures and the turntable video, publish and unpublish, delete with confirmation. Slug generation with uniqueness check.

### T6. Photos and gallery (FR-7.3)
- [ ] Create photo sets, upload multiple photos, edit titles and dates, reorder, publish and unpublish. Show the current film (read-only) with its version and a note that replacing the film is developer-assisted (D-09).

### T7. Pages and SEO (FR-7.4)
- [ ] Edit About, Contact and home meta (markdown body, SEO title, SEO description) with a live preview. Replace the static About content from Phase 3 with `pages`.

### T8. Layout (FR-8.11)
- [ ] Layout screen listing nodes per region with numeric overrides for x, y, width, height, rotation and layer, plus an "Auto layout" button that regenerates rings and spirals. A small read-only preview of the board. No drag-and-drop editor (out of scope, D-13).

### T9. Enquiries (FR-7.5)
- [ ] Inbox with unread count, read/unread toggle, status, product link, CSV export.

### T10. Publish flow
- [ ] A "Publish changes" action (or automatic on save) fires a Supabase Database Webhook to the Vercel deploy hook so the prerendered regions rebuild; show the owner a "Site updating" indicator and the last published time. Document the webhook setup and secret handling in `docs/admin-setup.md`.
- [ ] Audit log screen (FR-7.7, optional): who changed what and when.

### T11. Quality pass
- [ ] Playwright: sign in, create a product with uploads, publish, see it on the public site; edit a page; export enquiries; sign out; non-admin blocked. Run on the mobile-safari project.
- [ ] Security checks: service-role key absent from the bundle (search the build output), RLS tests green, MFA works.
- [ ] Write `docs/admin-guide.md` in plain English with screenshots placeholders for the owner.
- [ ] Run `/finish-phase 4`.

## Acceptance criteria

| # | Criterion | Maps to |
|---|---|---|
| D1 | Only the invited owner can sign in; public sign-up is off; MFA is available. | FR-7.1 |
| D2 | The owner can create, edit, reorder, publish and delete products with pictures and a turntable video from a phone. | FR-7.2, FR-7.6 |
| D3 | The owner can manage photo sets, captions, dates and order; the film is shown read-only. | FR-7.3 |
| D4 | The owner can edit About, Contact and SEO text and see it on the site after publishing. | FR-7.4 |
| D5 | Enquiries appear in the inbox with read/unread and CSV export. | FR-7.5 |
| D6 | Numeric layout overrides and Auto layout change the board after publishing. | FR-8.11 |
| D7 | Publishing triggers a rebuild and the site shows the change within a few minutes. | Architecture |
| D8 | RLS and Storage tests pass for admin, non-admin and anonymous; no service key in the bundle. | AGENTS rule 4, 5 |
| D9 | CI green; budgets hold; no serious axe issues in admin. | Definition of Done |

## Starter prompt

```
/start-phase 4
```
