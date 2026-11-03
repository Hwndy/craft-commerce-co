@AGENTS.md

# Claude Code notes

- Start every phase with `/start-phase N`. Use plan mode for the plan, and wait for the owner's approval before editing code.
- Keep a running checklist in the phase brief file (tick tasks as they are completed) so a new session can resume from the file alone.
- Prefer many small, verifiable steps. Run the relevant tests after each step, not only at the end.
- When you create or change a database object, write a migration and a pgTAP test in the same change.
- When a task depends on real-device behaviour (iOS autoplay, gestures, fullscreen), say so explicitly and list the manual checks for the owner.
- Never print or commit secrets. If a command needs a key, tell the owner which environment variable to set.
- Folder-level `CLAUDE.md` files in `src/canvas/`, `src/features/film/` and `supabase/` add rules for those areas.
