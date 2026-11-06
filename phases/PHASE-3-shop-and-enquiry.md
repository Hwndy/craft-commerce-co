# Phase 3: Shop and purchase by email

**Goal.** The Shop regions (shop wall and shop floor) show products with labels; each product enlarges to pictures or a turntable video; visitors buy by email through a `mailto:` link or a fallback enquiry form handled by a Supabase Edge Function.

**Read first:** `AGENTS.md`, `docs/00-product-brief.md` (FR-4, FR-5, FR-8.8), `docs/03-data-and-security.md` (migration 0003 and the `submit-enquiry` section), `docs/02-canvas-spec.md`, `docs/04-design-and-motion.md`, `supabase/CLAUDE.md`. Phases 1 and 2 must be accepted.

**Cost phase:** Phase 2 in the PRD/TRD (packages 6 and 7).

## Owner inputs needed

- [ ] Product list for launch: name, price (GBP), description, bullet points, status, wall or floor.
- [ ] Product photos and turntable videos (5 to 10 s loops), with posters.
- [ ] The enquiry email address; Resend account and a verified sending domain (or SMTP details); Cloudflare Turnstile site key and secret.
- [ ] Wording for the enquiry confirmation message.

Use the sample product from the board for development: **Sample Belt No.5**, black tyre belt with aluminium buckle, GBP 40; bullets "belt made from repurposed bike tyre" and "buckle sand-cast using discarded aluminium".

## Checklist

### T1. Data
- [ ] Migration `0003_shop_and_enquiries` with RLS and pgTAP tests (anonymous reads published products only; `enquiries` has no public policy; admin can read and update).
- [ ] Seed sample products and placeholder media; add shop nodes to `canvas_nodes`; viewpoints for `shop`, `shop-wall`, `shop-floor`.
- [ ] `useProducts()` and `useProduct(slug)` queries with Zod-validated shapes.

### T2. Shop regions (FR-4.1, FR-4.2, FR-4.6)
- [ ] Two neighbouring regions with distinct looks (wall: items hung or framed; floor: items laid out), using canvas nodes of type `product`.
- [ ] `ProductLabel`: name, price formatted with `Intl.NumberFormat('en-GB', { style: 'currency', currency })`, short description, status badge (Available, Sold, Made to order). Sold items stay visible but the buy action changes to "Ask about something similar".
- [ ] Optional sale flag display (FR-4.7), behind a product field.

### T3. Product overlay (FR-4.3 to FR-4.5)
- [ ] `/shop/:slug` overlay opened from a node: picture gallery and video view with a toggle, bullets and story text, focus trap, Escape and X to close, deep link and back-button behaviour.
- [ ] Turntable video: muted, looping, `playsInline`, starts when visible and pauses when hidden, poster shown first, falls back to pictures if the video fails or data-saver is on.

### T4. Purchase by email (FR-5.1)
- [ ] `src/features/enquiry/lib/mailto.ts`: builds `mailto:` with an encoded subject ("Enquiry: Sample Belt No.5 (GBP 40)") and a body that includes the product name, price and page link. Unit-test encoding of spaces, ampersands, pound signs and non-ASCII characters.
- [ ] "Buy / Enquire" button that opens the mailto link, with a visible "Copy email address" and "Use the form instead" next to it.

### T5. Enquiry form and Edge Function (FR-5.2 to FR-5.4)
- [ ] Form with react-hook-form and Zod (name, email, message, optional product), honeypot field, Turnstile widget, accessible errors and a success state.
- [ ] `supabase/functions/submit-enquiry/index.ts` as specified in `docs/03-data-and-security.md`: validation, Turnstile verification, rate limit by IP hash, store with the service-role client, email the owner through Resend with `Reply-To`, safe error responses, CORS for known origins, no personal data in logs.
- [ ] Deno tests for the function (validation failures, honeypot, rate limit, success path with email mocked).
- [ ] Deploy the function to staging and document the secrets to set (`RESEND_API_KEY`, `OWNER_EMAIL`, `TURNSTILE_SECRET`, `IP_HASH_SALT`).

### T6. Contact and About regions (FR-6)
- [ ] Contact region with the form, the email hyperlink (rendered so the address is not exposed as plain text in the client bundle) and social links.
- [ ] About region reading from `pages` once Phase 4 adds the table; until then read a typed static file `src/content/about.ts` and mark it for replacement.

### T7. Quality pass
- [ ] Playwright: open a product from the board and from a deep link; toggle picture/video; mailto link has the right subject and body; the form validates, submits against a mocked function and shows success; axe clean; keyboard-only purchase path.
- [ ] Manual: send a real enquiry on staging and check the owner's inbox, spam folder and `Reply-To`.
- [ ] Run `/finish-phase 3`.

## Acceptance criteria

| # | Criterion | Maps to |
|---|---|---|
| C1 | The shop shows a wall and a floor; each product has name, price and description labels. | FR-4.1, FR-4.2 |
| C2 | A product enlarges to pictures or its turntable video, with a toggle, bullets and story text; the video loops and pauses off screen. | FR-4.3 to FR-4.5 |
| C3 | Status badges work; sold products do not offer "Buy". | FR-4.6 |
| C4 | The Buy action opens an email with the right subject and body; the form fallback delivers the enquiry to the owner and stores it. | FR-5.1 to FR-5.3 |
| C5 | Spam protections work: honeypot, rate limit, Turnstile. | FR-5.4 |
| C6 | `enquiries` is unreadable and unwritable by anonymous users (pgTAP). | AGENTS rule 5 |
| C7 | Contact and About regions exist with working content paths. | FR-6 |
| C8 | CI green; budgets hold; no serious axe issues. | Definition of Done |

## Starter prompt

```
/start-phase 3
```
