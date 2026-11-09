import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import type { Session } from "@supabase/supabase-js";

import { getSession, isAdminSession, onAuthStateChange } from "./lib/auth";
import { NoIndex } from "./components/NoIndex";

interface AdminGuardProps {
  children: ReactNode;
}

/**
 * Wraps every /admin/* route except /admin/login itself. Client-side only
 * — a UX redirect/message, never the real enforcement (RLS, proven by
 * pgTAP, is). T2's own test requirement: unauthenticated -> redirected;
 * authenticated non-admin -> "no access" shown in place, not redirected
 * away (so they can see why, and sign out).
 */
export function AdminGuard({ children }: AdminGuardProps) {
  const location = useLocation();
  const [session, setSession] = useState<Session | null | "loading">("loading");

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
