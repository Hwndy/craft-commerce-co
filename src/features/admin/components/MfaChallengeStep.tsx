import { useState } from "react";

import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

import { challengeAndVerifySignIn } from "../lib/mfa";

/**
 * Shared between AdminLogin (right after signInWithPassword, when the
 * account needs its second factor) and AdminGuard (a lingering aal1
 * session that reaches a protected route directly — found in review,
 * Greptile, PR #7, security: is_admin() now requires aal2 once a factor
 * is enrolled, so this has to be reachable from both places, not just
 * the one-time login flow).
 */
export function MfaChallengeStep({
  factorId,
  onVerified,
}: {
  factorId: string;
  onVerified: () => void;
}) {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await challengeAndVerifySignIn(factorId, code);
      onVerified();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect code.");
      setCode("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4 text-center">
      <p className="text-sm text-muted-foreground">
        Enter the 6-digit code from your authenticator app.
      </p>
      <InputOTP
        maxLength={6}
        value={code}
        onChange={setCode}
        onComplete={onSubmit}
        disabled={submitting}
      >
        <InputOTPGroup>
          {Array.from({ length: 6 }).map((_, i) => (
            <InputOTPSlot key={i} index={i} />
          ))}
        </InputOTPGroup>
      </InputOTP>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
