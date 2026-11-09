# Phase 3 hand-over: shop and purchase by email

**Status:** done, with the real-device checks below and the owner-input blockers in `docs/decisions.md` D-63 and the phase brief's own "Owner inputs needed" list still outstanding.

## What was built

- **T1 Data**: migration `0003_shop_and_enquiries` (products, product media, enquiries) plus `0004_enquiry_rate_limit_fn` (the rate-limit function added when T5's testing surfaced a real need for it), full RLS, pgTAP tests proving anonymous and non-admin-authenticated users can read only published products and can't touch `enquiries` at all — and, stricter than the brief's own wording, that even the admin role can't insert into `enquiries` (service-role only). `useProducts()`/`useProduct(slug)` Zod-validated queries.
- **T2 Shop regions**: `shop-wall` (hung/framed look) and `shop-floor` (laid-out grid), both built from `product`-type canvas nodes, with `ProductLabel` (name, `Intl.NumberFormat('en-GB', …)` price, description, status badge, optional Sale flag).
- **T3 Product overlay**: a Radix `Dialog` opened from a board node or a `/gallery/shop/:slug` deep link, with a Pictures/Video toggle, bullets, story text, focus trap, Escape/X/back-button close. Turntable video is muted/looping/`playsInline`, starts on visibility and pauses off-screen, falls back to pictures on failure.
- **T4 Purchase by email**: `mailto.ts` builds the `mailto:` link (subject/body correctly encoding spaces, `&`, `£`, and non-ASCII), with Buy/Enquire, Copy-email-address, and Use-the-form-instead all present next to it.
- **T5 Enquiry form + Edge Function**: react-hook-form + Zod, a visually-hidden honeypot field, Cloudflare Turnstile, accessible errors and a success state; `supabase/functions/submit-enquiry/` validates input, verifies Turnstile, rate-limits by hashed IP, stores via the service-role client, emails the owner through Resend with `Reply-To` set, returns safe/generic errors (no raw error text, no PII in logs), and only accepts known CORS origins. Deno-tested for every one of those paths independently, plus the race-condition case where the rate-limit's atomic insert catches what the pre-check missed.
- **T6 About and Contact**: `About.tsx` reads a typed static `src/content/about.ts`; `Contact.tsx` has the form, an email link whose visible text names its purpose (not the raw address — see D-56 for why full obfuscation isn't achievable given T4's own visible mailto link), and three social icons shown disabled (`title="Coming soon"`) pending the owner's real URLs.
- **The Gallery/Collage/Shop reskin** (not originally scoped for this phase, done in the same session after the owner sent a screen recording walking through his own Freeform mockup): rebuilt the collage's "strips" layout to match the owner's actual drawn concept (overlapping cascading stacks, a rise-before-opening transition), added click-the-picture-to-play-video on the product overlay, and a slow ambient spin for circular-mode photos — see D-62/D-63 for the full story, including four real review findings and one real CI regression this introduced and then fixed (a continuously-spinning photo made Playwright's click-stability check fail; fixed by scoping Playwright to reduced motion for just the one affected spec, not the whole suite — the first, too-broad attempt broke a different, unrelated spec and was itself caught in review).

## What was fixed along the way (not originally scoped, found during verification)

Each documented in `docs/decisions.md`:

1. **A pre-existing jsdom bug surfaced by the first real test to reach that code path** (D-62): `video.play().catch(...)` assumes `play()` always returns a thenable — true in every real browser, not in jsdom. Fixed with `video.play()?.catch(...)`.
2. **A timer leak in the collage's rise-before-opening transition** (D-62, found in review): a second click before the first rise finished started an independent second timer, able to open the viewer twice or fire after unmount.
3. **A visible snap in the collage's ambient spin, every 48 seconds** (D-62, found in review): the keyframe's implicit starting value was each photo's own static tilt, not 0°.
4. **A genuine CI regression from the spin feature itself** (D-63): it broke every `photo-viewer.spec.ts` test by making collage photos permanently "unstable" to Playwright's click check. Fixed, then the fix itself was caught in review as too broad (it also broke `entry-sequence.spec.ts`) and narrowed.
5. **`stackTiltJitterDeg` was the one strips-mode tunable left hardcoded** (D-63, found in review) — added to the options interface for consistency with every sibling tunable.
6. **Reduced motion was silently dropping circular photos' static tilt**, not just their spin (D-63, found in review) — fixed by giving `.collage-spin` a base `transform`, not just a keyframe one.

## What was deferred, and why

- **T5's last checklist item — deploying `submit-enquiry` to staging and documenting secrets**: code-complete and fully Deno-tested with every dependency mocked, but genuinely blocked on the owner: a Resend account + verified sending domain, the real `OWNER_EMAIL`, and real Turnstile site+secret keys (dev/CI use Cloudflare's own public test key pair). `.env.example` already documents exactly which secrets to set and how.
- **A real product catalogue**: only the brief's own fallback, **Sample Belt No.5** (and a second seeded-for-testing "Sample Belt No.2" on the wall), is live — real products, photos and turntable videos are an explicit "Owner inputs needed" item, not guessed.
- **The real About brand story and the Contact region's three social URLs**: both still placeholders/disabled, per AGENTS.md rule 10 (don't guess content) — `src/content/about.ts` and `src/content/contact.ts` are exactly where to put the real values once received.
- **Two T7 checklist sub-items stayed unit-level, not e2e** (full reasoning in D-63): the picture/video toggle's real `attachHls`/`play()` wiring is unit-tested directly, but CI's seeded product has no real video to toggle to in an e2e spec (same owner-input blocker as the catalogue above); a dedicated "keyboard-only purchase path" e2e test wasn't added in this pass because this sandbox has no way to actually run it and verify it works before it would land on `main` with no PR/CI gate — writing an unverified e2e spec involving a real third-party Turnstile iframe's own tab-stop behaviour isn't a risk worth taking blind. Recommended as a small, well-scoped follow-up task.
- **Manually sending a real enquiry on staging** (the brief's own T7 manual item): blocked on the same Resend/Turnstile secrets as above.

## Manual checks the owner must do on a real iPhone and a mid-range Android phone

Phase 1's `docs/real-device-checklist.md` entry/film items still apply unchanged. New for Phase 3:
- Open a product from the Shop wall and the Shop floor by touch; confirm the overlay opens full-screen-sized and comfortably scrollable (not cramped) on a phone screen.
- If/when a real turntable video is live: confirm it actually autoplays muted and loops on both iPhone Safari and Android Chrome, and that tapping the still picture is what starts it (not autoplaying on open).
- Fill in and submit the real enquiry form by touch — on-screen keyboard doesn't obscure the Message field or the Send button; Turnstile's real (non-test) widget actually renders and verifies on both platforms.
- Tap "Buy / Enquire" and confirm it actually opens the device's real mail app with the subject/body pre-filled, not just a dead link.
- Confirm the Contact region's email link and (once enabled) social icons are comfortably tappable (44px touch target per `docs/04-design-and-motion.md` §6).
- Once a Resend account is live: send one real enquiry from staging and check it actually lands in the owner's inbox (not spam), with `Reply-To` set to the visitor's address, not the no-reply sending address.

## Demo script (5 steps)

1. From the Gallery board, pan or use the region tabs to **Shop (floor)** — you'll see **Sample Belt No.5** laid out with its name, price and a short description.
2. Click the product. The overlay opens: swipe or click through pictures, try the Pictures/Video toggle (today there's no real video seeded yet, so it falls back to pictures — that's expected until real footage is supplied), and read the bullets and story text below.
3. Click **Buy / Enquire** — your email client opens with the subject and body already filled in (product name, price, and a link back to this exact product). Close it, and instead try **Copy email address**, then **Use the form instead**.
4. Fill in the form (name, email, a short message) and send it. You'll see a "Thank you — message sent" confirmation. (Once the owner's Resend account is connected, this is also the moment a real email lands in the owner's inbox.)
5. Pan over to **Contact** — the same form lives there too, alongside an email link and three social icons (shown disabled for now, pending the owner's real URLs), and to **About** for the brand-story placeholder text, both ready for the owner's real content.

## What's next

Phase 4 is not started, per the brief's own "do not build ahead" rule. Before it begins, the owner inputs listed above (real catalogue + media, Resend/Turnstile secrets, About/Contact real content) are worth chasing, since several of Phase 3's own remaining checklist items are blocked on exactly those. Worth raising with the owner first: the `canvas-gestures.spec.ts`/`about-contact.spec.ts`/`product-overlay.spec.ts` CI flakiness (pre-existing, documented across several decisions entries — D-49 and others) showed up more on this phase's final CI runs than usual; it's never been this phase's own regression, but it's worth a dedicated look before it erodes confidence in CI's own signal.
