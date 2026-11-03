# Decision log

Defaults are used unless the owner overrides them. When you take a new decision, add an entry at the bottom using the template.

## Defaults for open questions

| ID | Question | Default |
|---|---|---|
| D-01 | Film behaviour after the reveal (landing notes say "waits for play", page 2 notes say "starts immediately") | Start automatically using the element primed in the "Click to enter" gesture; fall back to muted with an unmute prompt, then to a large play button. Controlled by `VITE_FILM_AUTOSTART`. |
| D-02 | Collage layout | Circular ("Idea 2"), phyllotaxis-style dense circle. "Idea 1" diagonal strips kept as an alternate layout value. |
| D-03 | Price currency | GBP only (the board shows GBP 40). Format with `Intl.NumberFormat('en-GB', ...)`. |
| D-04 | How the seal is built | Unknown until the Phase 1 audit. Control it through a `SealController` interface so the entry sequence does not depend on the answer. |
| D-05 | Film size and length | Assume up to 10 minutes and a 1.5 GB source. |
| D-06 | Turntable videos | Short MP4 loops (5 to 10 s, under 100 MB), poster required. |
| D-07 | First-watch gate scope | Once per device per film version, stored in `localStorage`; bumping `gallery_film.version` re-locks it. |
| D-08 | Online payments | Not in v1. Purchase by email. |
| D-09 | Replacing the film | Developer-assisted with `scripts/encode-hls.sh` and `scripts/upload-film.ts` in v1. |
| D-10 | Enquiry email address and provider | Owner supplies; Resend sends from the owner's domain once SPF/DKIM are set. |
| D-11 | Brand copy | Owner supplies; use clearly marked placeholders in development. |
| D-12 | First-visit mode | Guided mode first, Explore available at all times, choice remembered. |
| D-13 | Layout editing | Automatic layout plus numeric overrides in admin; no drag-and-drop editor in v1. |
| D-14 | Board centre | The mind map arrangement from the concept board: ALL LIFE in the middle, regions around it. |
| D-15 | Photo renditions | Created before upload (script in Phase 2, in-browser in Phase 4); no paid image transformations. |
| D-16 | Package manager | npm. |
| D-17 | Animation library | One of `framer-motion` or `gsap`; choose in Phase 1 and record here. |
| D-18 | Prerender mechanism | Chosen in Phase 5. |

## Owner questions that block work

List here with a date when asked and the answer when received.

| Date | Question | Answer |
|---|---|---|
| | What is the seal built with (3D model, video, image sequence, CSS) and where are the source files? | |
| | Which address is production: alllifeworks.com or the Vercel preview address? | |
| | Is the "finer luminous" seal form a supplied asset, or should it be created with light effects? | |

## Template

```
### D-NN: Title (date)
Context:
Decision:
Alternatives considered:
Consequences:
```
