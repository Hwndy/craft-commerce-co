# ALL LIFE Build Kit for Claude Code

This kit tells Claude Code how to build the ALL LIFE website end to end, one phase at a time.
Copy everything in this folder into the **root of the existing repository** (Hwndy/craft-commerce-co), commit it, then start Claude Code in that repo.

## What is in the kit

| Path | Purpose |
|---|---|
| `AGENTS.md` | Canonical project rules, stack, conventions and Definition of Done. |
| `CLAUDE.md` | Imports `AGENTS.md` and adds Claude Code workflow notes. |
| `.claude/commands/` | Slash commands: `/start-phase N`, `/finish-phase N`, `/status`. |
| `docs/00-product-brief.md` | Product context and every functional requirement (FR-1 to FR-8). |
| `docs/01-architecture.md` | Architecture, folder layout, routes, env vars, conventions. |
| `docs/02-canvas-spec.md` | Spatial canvas engine specification (camera maths, gestures, zoom, flights). |
| `docs/03-data-and-security.md` | Supabase schema, row-level security, storage policies, Edge Functions. |
| `docs/04-design-and-motion.md` | Design language, motion timings, accessibility and performance budgets. |
| `docs/05-testing-and-quality.md` | Test strategy, device matrix, CI. |
| `docs/decisions.md` | Decision log with defaults for every open question. |
| `phases/PHASE-1 ... PHASE-5` | One brief per phase with tasks, acceptance criteria and a starter prompt. |
| `src/canvas/CLAUDE.md`, `src/features/film/CLAUDE.md`, `supabase/CLAUDE.md` | Folder-level rules, loaded when Claude works in those folders. |

## Phase map

| Kit phase | Scope | Cost phase in the PRD/TRD |
|---|---|---|
| 1 | Landing page to film play: tooling, Supabase base, film pipeline, entry transition, canvas shell, film player and first-watch gate | Phase 1 (part) |
| 2 | Full canvas engine (pan, zoom, guided mode, deep links, list view) and the circular photo collage with viewer | Phase 1 (part) |
| 3 | Shop regions, product views, purchase by email, enquiry Edge Function | Phase 2 |
| 4 | Admin / CMS on Supabase Auth, uploads, layout controls, enquiries inbox | Phase 3 |
| 5 | Prerendering, SEO, accessibility, performance, security review, QA, launch and handover | Phase 4 |

## How to use it

1. Put the kit in the repo root and commit it on a branch called `chore/build-kit`.
2. Export the PRD/TRD document from Claude as Markdown and save it as `docs/PRD-TRD.md` (optional but useful as a reference).
3. Collect the owner inputs listed at the top of each phase brief (film file, seal details, Supabase and Vercel access, content).
4. Run `claude` in the repo root, then `/start-phase 1`. Claude reads the brief, audits the repo and proposes a plan. Approve the plan before it starts changing code.
5. Work through the tasks. When all acceptance criteria are met, run `/finish-phase 1`, review the summary, merge, then move to the next phase.

Do not skip phases or ask Claude to build ahead. Each phase leaves the site in a deployable state.

## Secrets

Never paste real keys into the kit or into chat. Use `.env.local` (git-ignored) and the Vercel and Supabase dashboards. `.env.example` lists the variable names.
