import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { signOut } from "@/features/admin/lib/auth";

/**
 * Placeholder landing for the guarded admin area — T3 (admin shell) is
 * where the real Products/Photos/Pages/Layout/Enquiries navigation lands;
 * this just needs to exist so AdminGuard (applied by the route in
 * App.tsx, T2) has something real to guard and sign out of. Not
 * self-guarding: the route tree applies AdminGuard centrally so every
 * protected page component stays guard-agnostic and easy to test alone.
 */
export default function Admin() {
  const navigate = useNavigate();

  async function onSignOut() {
    await signOut();
    navigate("/admin/login", { replace: true });
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-heading">Admin</h1>
      <div className="mt-4 flex gap-2">
        <Button variant="pill-outline" onClick={() => navigate("/admin/mfa-setup")}>
          Two-factor authentication
        </Button>
        <Button variant="pill-outline" onClick={onSignOut}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
