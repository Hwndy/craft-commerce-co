---
description: Verify a phase against its acceptance criteria and prepare the hand-over.
argument-hint: [phase-number]
---

Finish phase $ARGUMENTS.

1. Re-read `phases/PHASE-$ARGUMENTS-*.md`. For each acceptance criterion, state PASS or FAIL with the evidence (test name, command output, file, or a manual check still needed).
2. Run `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` and `npm run test:e2e`; if the phase touched Supabase, also run `npx supabase db reset` and `npx supabase test db`. Report results honestly, including failures.
3. Confirm budgets in `docs/04-design-and-motion.md` still hold (bundle size, Lighthouse where available).
4. Update the phase checklist, `docs/decisions.md`, `.env.example` and any README sections.
5. Write a hand-over summary: what was built, what was deferred and why, manual checks the owner must do on real devices, and a 5-step demo script for the owner.
6. Do not start the next phase.
