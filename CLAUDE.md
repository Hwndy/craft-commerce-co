---
description: Start a build phase. Reads the brief, audits the repo and proposes a plan.
argument-hint: [phase-number]
---

Start phase $ARGUMENTS of the ALL LIFE build.

1. Read `AGENTS.md`, `docs/decisions.md`, then the file matching `phases/PHASE-$ARGUMENTS-*.md` and every document that brief lists under "Read first".
2. Check the repository state: current branch, uncommitted changes, whether earlier phases' acceptance criteria are marked done, and whether the owner inputs listed in the brief are available. List anything missing.
3. Produce a numbered plan that follows the brief's task order, with the files you expect to create or change and the tests you will write. Flag risks and any question that needs the owner.
4. Stop and wait for approval. Do not edit files yet.
