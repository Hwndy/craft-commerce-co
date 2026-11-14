import { Suspense, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { ADMIN_NAV_ITEMS } from "./lib/adminNav";
import { signOut } from "./lib/auth";

function AdminSectionSkeleton() {
  return (
    <main className="space-y-3 p-6">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-24 w-full" />
    </main>
  );
}

/**
 * T3's layout: a desktop sidebar (md: and up) and a mobile bottom nav
 * (below md:, Tailwind's 768px breakpoint — src/hooks/use-mobile.tsx's own
 * definition), both built from the one ADMIN_NAV_ITEMS list so there's a
 * single source of truth for the five sections, plus the sign-out/MFA-
 * setup account cluster migrated from the old src/pages/Admin.tsx (now
 * deleted — this shell replaces it as the /admin index's real content).
 *
 * <Suspense> wraps only the <Outlet/> content area, not this whole shell:
 * the nav chrome stays mounted and visible while a section's own lazy
 * chunk loads, instead of the entire shell flashing to a fallback on every
 * section switch.
 */
export function AdminShell() {
  const navigate = useNavigate();
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function onSignOut() {
    setSignOutError(null);
    try {
      await signOut();
      navigate("/admin/login", { replace: true });
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : "Couldn't sign out. Try again.");
    }
  }

  const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
      isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
    );

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <nav
        aria-label="Admin sections"
        className="hidden w-56 flex-col border-r border-border p-4 md:flex"
      >
        <div className="flex-1 space-y-1">
          {ADMIN_NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={navLinkClassName}>
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </div>
        <div className="space-y-1 border-t border-border pt-4">
          <Button variant="pill-outline" className="w-full" onClick={() => navigate("/admin/mfa-setup")}>
            Two-factor authentication
          </Button>
          <Button variant="pill-outline" className="w-full" onClick={onSignOut}>
            Sign out
          </Button>
          {signOutError && <p className="text-sm text-destructive">{signOutError}</p>}
        </div>
      </nav>

      <div className="flex flex-1 flex-col">
        {/* Mobile top bar — the sidebar's own account cluster isn't
            rendered at this breakpoint, so this is mobile's only way to
            reach 2FA setup or sign out. */}
        <div className="flex items-center justify-end gap-2 border-b border-border p-3 md:hidden">
          <Button variant="pill-outline" size="sm" onClick={() => navigate("/admin/mfa-setup")}>
            Two-factor authentication
          </Button>
          <Button variant="pill-outline" size="sm" onClick={onSignOut}>
            Sign out
          </Button>
        </div>
        {signOutError && <p className="px-3 pt-2 text-sm text-destructive md:hidden">{signOutError}</p>}

        <Suspense fallback={<AdminSectionSkeleton />}>
          <div className="flex-1 pb-16 md:pb-0">
            <Outlet />
          </div>
        </Suspense>

        {/* Mobile bottom nav */}
        <nav
          aria-label="Admin sections"
          className="fixed inset-x-0 bottom-0 flex items-center justify-around border-t border-border bg-background py-2 md:hidden"
        >
          {ADMIN_NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-1 px-2 text-xs",
                  isActive ? "text-accent-foreground" : "text-muted-foreground"
                )
              }
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
