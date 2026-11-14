# Admin setup (owner/developer steps outside the codebase)

This covers the Supabase dashboard steps needed to get the owner a working
admin account. Nothing here can be scripted from inside this repo — the
dashboard changes and the owner's own email/password/MFA steps have to
happen for real.

## 1. Disable public sign-ups

Supabase dashboard → **Authentication** → **Providers** → **Email** →
turn off **"Allow new users to sign up"**. This repo's own client code never
exposes a sign-up form (`/admin/login` only ever calls `signInWithPassword`),
but disabling it at the project level closes the Auth API itself, not just
the UI — belt and braces.

## 2. Invite the owner

Supabase dashboard → **Authentication** → **Users** → **Invite user** →
enter the owner's real email (`docs/decisions.md`'s "Owner questions that
block work" table — this is one of the inputs still needed). This sends a
real invite email with a link to set a password; the owner has to click it
and set their own password before the next step can find their account.

## 3. Grant the admin role

Once the owner has accepted the invite and set a password, from a machine
with `.env.local` set to the **real** project's `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` (never committed — `.env.local` is git-ignored):

```bash
npx tsx scripts/make-admin.ts owner@example.com
```

This sets `app_metadata.role = 'admin'` on their auth user — the same JWT
claim every RLS policy since Phase 1 (`public.is_admin()`) already checks.
Re-running it is harmless (it checks and no-ops if the role is already set).

## 4. Enable MFA for the owner

Once the owner can sign in at `/admin/login`, the login screen's own MFA
enrollment prompt (T2) walks them through adding a TOTP authenticator app.
This has to happen from their own signed-in session — nothing here can do
it for them.

## 5. Publish webhook (T10)

Covered once T10 lands — needs the owner's Vercel deploy hook URL
(`docs/decisions.md`'s owner-questions table) before the Supabase Database
Webhook can be wired up for real.
