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
