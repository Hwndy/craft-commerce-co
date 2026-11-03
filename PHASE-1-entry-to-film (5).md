# Phase 5: Hardening and launch

**Goal.** The site is prerendered, accessible, fast, secure and monitored; it passes the device matrix; production is configured; the domain is cut over; the owner is trained and has the handover pack.

**Read first:** `AGENTS.md`, all of `docs/`, every earlier phase's hand-over notes. Phases 1 to 4 must be accepted.

**Cost phase:** Phase 4 in the PRD/TRD (packages 11, 12, 13, 14).

## Owner inputs needed

- [ ] Final copy, share image (1200x630), favicon set, social links.
- [ ] DNS access for alllifeworks.com; approval of the cut-over time.
- [ ] Supabase production project on the Pro plan, with billing set up by the owner.
- [ ] Analytics choice and the consent wording (NDPR, UK GDPR awareness).

## Checklist

### T1. Prerendering and SEO (FR-8.9)
- [ ] Choose and record the prerender mechanism (D-18): a Vite static-site-generation plugin, or a post-build Playwright snapshot of each route. Content is fetched from Supabase at build time.
- [ ] Prerender `/`, `/gallery`, `/shop`, `/shop/:slug`, `/about`, `/contact`, `/list` and `/list/:region`; hydrate without layout shift.
- [ ] Per-route title, description, canonical URL, Open Graph and Twitter tags, JSON-LD (`Organization`, `Product`), `sitemap.xml`, `robots.txt` (disallow `/admin`).
- [ ] Verify with a "view source" check and a search-engine fetch tool that each region's content is present in the HTML.

### T2. Performance
- [ ] Bundle analysis; split the entry sequence, canvas, film, collage, shop and admin into lazy chunks; remove unused shadcn components and generator leftovers (with the owner's approval).
- [ ] Audit every image and video: sizes, formats, cache headers. Confirm the film's HLS ladder and segment cache headers.
- [ ] Lighthouse mobile on `/`, `/gallery`, `/shop`: meet the budgets in `docs/04-design-and-motion.md`; record the numbers.

### T3. Accessibility
- [ ] axe on every route (no serious or critical violations); manual keyboard-only run of the full journey; VoiceOver on iPhone and TalkBack on Android for landing, film, collage viewer, shop and the enquiry form; captions on the film; reduced-motion and photosensitivity review.

### T4. Security
- [ ] Re-run all pgTAP tests; manual review of every policy; confirm no service-role key or secret in the bundle or the repository history; dependency audit.
- [ ] Headers in `vercel.json`: Content-Security-Policy (app, Supabase, analytics, Turnstile), HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`. Auth: MFA enabled for the owner, sign-up disabled, password policy.
- [ ] Edge Function abuse test: oversized bodies, rapid submissions, missing Turnstile token.

### T5. Monitoring and privacy
- [ ] Sentry in the client with source maps (not public); uptime checks on `/`, `/gallery`, `/shop`; email alerts.
- [ ] Analytics with a short consent notice; privacy and cookie page; data-retention note for enquiries.

### T6. Full QA
- [ ] Execute the device matrix in `docs/05-testing-and-quality.md` on real devices; log bugs in `docs/known-issues.md`; fix blockers and majors.
- [ ] Full Playwright suite on Chromium and WebKit plus mobile projects; throttled-network run.
- [ ] Load sanity check on media egress (a short burst of film views) and an estimate of monthly egress cost for the owner.

### T7. Production setup and cut-over
- [ ] Production Supabase project: apply migrations from a tagged release, create buckets and policies, upload the real film and content, set Edge Function secrets, create the admin user with MFA, configure the database webhook to the production deploy hook.
- [ ] Backups: confirm daily backups; take a weekly export; perform and document a restore drill into a scratch project.
- [ ] Vercel production environment variables; DNS cut-over plan with a rollback step; redirects from old URLs if any; 404 page that fits the brand.
- [ ] Launch checklist signed off by the owner; tag the release.

### T8. Handover pack
- [ ] `docs/admin-guide.md` (owner), `docs/runbook.md` (backups, restore, rotate secrets, replace the film step by step, add a product, redeploy, read logs), `docs/architecture-as-built.md`, an updated `README.md`, and a recorded walkthrough script for the training session.
- [ ] Training session outline (45 minutes): sign in, add a product, add photos, edit text, read enquiries, what to do if something looks wrong.
- [ ] 30-day support plan: how to report issues, response targets.
- [ ] Run `/finish-phase 5`.

## Acceptance criteria

| # | Criterion | Maps to |
|---|---|---|
| E1 | Each region's content is present in prerendered HTML with correct metadata, sitemap and structured data. | FR-8.9 |
| E2 | Lighthouse mobile: performance 85 or more; accessibility, best practices and SEO 95 or more on the main routes. | Budgets |
| E3 | No serious or critical axe violations; screen-reader and keyboard journeys complete. | WCAG 2.2 AA |
| E4 | All RLS and Storage tests pass; no secrets in the bundle; headers and CSP deployed. | Security |
| E5 | The device matrix passes on real devices, including current iOS Safari, with no open blocker or major bugs. | QA |
| E6 | Monitoring and alerts are live; backups run and a restore drill succeeded. | Reliability |
| E7 | Production is live on alllifeworks.com with the real film and content; rollback plan documented. | Launch |
| E8 | The owner completed the training session and can perform the core tasks unaided; the handover pack is delivered. | Handover |

## Starter prompt

```
/start-phase 5
```
