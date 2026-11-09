import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import type { Session } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";

import { getSession, isAdminSession, onAuthStateChange, signOut } from "./lib/auth";
import { getVerifiedTotpFactorId, needsMfaChallenge } from "./lib/mfa";
import { MfaChallengeStep } from "./components/MfaChallengeStep";
import { NoIndex } from "./components/NoIndex";

interface AdminGuardProps {
  children: ReactNode;
}

type MfaState = "checking" | "not-required" | { factorId: string };

/**
 * Wraps every /admin/* route except /admin/login itself. Client-side only
 * — a UX redirect/message, never the real enforcement (RLS, proven by
 * pgTAP, is). T2's own test requirement: unauthenticated -> redirected;
 * authenticated non-admin -> "no access" shown in place, not redirected
 * away (so they can see why, and sign out).
 *
 * Also checks the session's own assurance level (found in review,
 * Greptile, PR #7, security): is_admin() now requires aal2 once the
 * account has a verified MFA factor (docs/decisions.md D-65) — a
 * lingering aal1 session (a stale tab, one that closed the login flow's
 * own MFA step partway) would otherwise reach this far and then have
 * every real write silently rejected by RLS with a confusing error,
 * instead of being asked here, in place, to finish the one step it
 * actually still needs.
 */
export function AdminGuard({ children }: AdminGuardProps) {
  const location = useLocation();
  const [session, setSession] = useState<Session | null | "loading">("loading");
  const [mfa, setMfa] = useState<MfaState>("checking");

  useEffect(() => {
    let active = true;
    getSession().then((s) => {
      if (active) setSession(s);
    });
    const unsubscribe = onAuthStateChange((s) => {
      if (active) setSession(s);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session || session === "loading" || !isAdminSession(session)) {
      setMfa("checking");
      return;
    }
    let active = true;
    (async () => {
      if (!(await needsMfaChallenge())) {
        if (active) setMfa("not-required");
        return;
      }
      const factorId = await getVerifiedTotpFactorId();
      if (active) setMfa(factorId ? { factorId } : "not-required");
    })();
    return () => {
      active = false;
    };
  }, [session]);

  async function onSignOut() {
    await signOut();
  }

  if (session === "loading") return null;

  if (!session) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  if (!isAdminSession(session)) {
    return (
      <>
        <NoIndex />
        <div className="flex min-h-screen items-center justify-center p-6 text-center">
          <div>
            <h1 className="text-xl font-heading">No access</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This account isn't authorised for the admin area.
            </p>
            <Button variant="pill-outline" className="mt-4" onClick={onSignOut}>
              Sign out
            </Button>
          </div>
        </div>
      </>
    );
  }

  if (mfa === "checking") return null;

  if (mfa !== "not-required") {
    return (
      <>
        <NoIndex />
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="w-full max-w-sm">
            <MfaChallengeStep
              factorId={mfa.factorId}
              onVerified={() => setMfa("not-required")}
            />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <NoIndex />
      {children}
    </>
  );
}
