import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

/**
 * The role claim RLS has checked since Phase 1 (`public.is_admin()`,
 * migration 0001: `app_metadata.role = 'admin'`) — checking it here too is
 * UX only (redirect before a doomed request round-trips), never the real
 * enforcement. A forged/stale client check can't grant a write RLS itself
 * would reject; AdminGuard.test.tsx and the pgTAP suites each prove their
 * own half of that independently.
 */
export function isAdminSession(session: Session | null): boolean {
  return session?.user.app_metadata?.role === "admin";
}

/**
 * The session's own `aal` claim (not exposed as a field on `Session` —
 * only inside the `access_token` JWT's payload), read straight from the
 * token rather than re-querying Supabase. AdminGuard uses this (found in
 * review, Greptile P2, PR #7) to tell a real step-up — completing MFA,
 * here or in another tab, promotes the session to aal2 and
 * onAuthStateChange fires with a new session reflecting it — from an
 * ordinary same-level token refresh, which also fires onAuthStateChange
 * with a new session object but never changes this claim.
 */
export function sessionAal(session: Session | null): string | null {
  if (!session) return null;
  try {
    const payload = session.access_token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const aal = JSON.parse(json).aal;
    return typeof aal === "string" ? aal : null;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthStateChange(callback: (session: Session | null) => void) {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => subscription.unsubscribe();
}

export async function signInWithPassword(email: string, password: string): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  // Supabase returns no error for an aal2-required account that hasn't
  // completed its MFA challenge yet — session is real but only at aal1.
  // AdminLogin.tsx's own flow checks the assurance level next, not here.
  return data.session;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function requestPasswordReset(email: string, redirectTo: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
