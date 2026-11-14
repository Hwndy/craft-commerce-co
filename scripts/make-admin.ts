/**
 * Sets `app_metadata.role = 'admin'` on an existing auth user, identified
 * by email — the only way to grant the admin role per
 * docs/03-data-and-security.md §0/§7 ("set once by hand (or script) for
 * the owner's auth user"). Does not create the user: invite them first
 * (Supabase dashboard, Authentication > Users > Invite), have them accept
 * and set a password, then run this script with that same email.
 *
 * Usage: npx tsx scripts/make-admin.ts owner@example.com
 *
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local. Never
 * commit a real value for either; the service-role key is local-script-only
 * per AGENTS.md rule 4 — this is exactly the kind of one-off, local-only
 * use that rule describes, never run from the client or CI.
 */
import { config as loadEnv } from "dotenv";

import { createClient } from "@supabase/supabase-js";

loadEnv({ path: ".env.local" });

const [, , email] = process.argv;

if (!email) {
  console.error("Usage: npx tsx scripts/make-admin.ts <email>");
  process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them in .env.local (git-ignored)."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  // supabase-js's admin API has no getUserByEmail — list and find, paging
  // if needed. Fine for this script's actual scale (one owner account);
  // not written as a general-purpose bulk tool.
  let user: { id: string; email?: string; app_metadata: Record<string, unknown> } | undefined;
  for (let page = 1; !user; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (data.users.length < 200) break;
  }

  if (!user) {
    console.error(
      `No auth user found for ${email}. Invite them first (Supabase dashboard, Authentication > Users > Invite) and have them accept before running this script.`
    );
    process.exit(1);
  }

  if (user.app_metadata?.role === "admin") {
    console.log(`${email} already has app_metadata.role = "admin" — nothing to do.`);
    return;
  }

  const { error } = await supabase.auth.admin.updateUserById(user.id, {
    // Merge, not replace — app_metadata can carry other fields (e.g.
    // provider info) that this script has no business touching.
    app_metadata: { ...user.app_metadata, role: "admin" },
  });
  if (error) throw error;

  console.log(`${email} (${user.id}) now has app_metadata.role = "admin".`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
