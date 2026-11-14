import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

import { enrollTotp, hasVerifiedTotpFactor, verifyEnrollment, type TotpEnrollment } from "./lib/mfa";

/**
 * Standalone enrollment screen (T2's "MFA prompt when enrolled" only
 * covers the *login*-time prompt — this is the separate, one-time
 * enable-it-for-the-first-time step, reachable from AdminHome). The
 * owner's own agreement to enable MFA is still a pending owner input
 * (docs/decisions.md) — this screen does nothing until they visit it on
 * purpose, so it's safe to ship ahead of that answer.
 */
export default function AdminMfaSetup() {
  const [alreadyEnrolled, setAlreadyEnrolled] = useState<boolean | "loading" | "failed">("loading");
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Found in review (Greptile, PR #7): this effect never caught a lookup
  // failure, so alreadyEnrolled stayed "loading" forever — a blank page,
  // no explanation, no way to retry short of a full reload. retryCount is
  // only ever bumped by the retry button below, re-running this effect.
  useEffect(() => {
    let active = true;
    setAlreadyEnrolled("loading");
    hasVerifiedTotpFactor()
      .then((result) => {
        if (active) setAlreadyEnrolled(result);
      })
      .catch(() => {
        if (active) setAlreadyEnrolled("failed");
      });
    return () => {
      active = false;
    };
  }, [retryCount]);

  // Found in review (CodeRabbit, PR #7): with no guard here, clicking twice
  // before the first enrollTotp() resolves could create two factors —
  // the owner scans the first response's QR code, but a later-resolving
  // second response then replaces `enrollment` with a *different* factor,
  // so verifying submits that second factor's id against the first
  // factor's code and fails confusingly.
  async function startEnrollment() {
    if (enrolling) return;
    setEnrolling(true);
    setError(null);
    try {
      setEnrollment(await enrollTotp());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start enrollment.");
    } finally {
      setEnrolling(false);
    }
  }

  async function onVerify() {
    if (!enrollment) return;
    setError(null);
    try {
      await verifyEnrollment(enrollment.factorId, code);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect code.");
      setCode("");
    }
  }

  if (alreadyEnrolled === "loading") {
    return (
      <div className="mx-auto max-w-sm space-y-4 p-6">
        <h1 className="text-2xl font-heading">Two-factor authentication</h1>
        <p className="text-sm text-muted-foreground">Checking your two-factor status…</p>
      </div>
    );
  }

  if (alreadyEnrolled === "failed") {
    return (
      <div className="mx-auto max-w-sm space-y-4 p-6">
        <h1 className="text-2xl font-heading">Two-factor authentication</h1>
        <p className="text-sm text-destructive">Couldn't check your two-factor status.</p>
        <Button variant="pill-outline" onClick={() => setRetryCount((n) => n + 1)}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm space-y-4 p-6">
      <h1 className="text-2xl font-heading">Two-factor authentication</h1>

      {done || alreadyEnrolled ? (
        <p>Two-factor authentication is set up on this account.</p>
      ) : !enrollment ? (
        <>
          <p className="text-sm text-muted-foreground">
            Add an authenticator app (e.g. Google Authenticator, 1Password) as a second sign-in step.
          </p>
          <Button variant="pill" onClick={startEnrollment} disabled={enrolling}>
            Set up two-factor authentication
          </Button>
        </>
      ) : (
        <div className="space-y-4">
          {/* Found in review (CodeRabbit, PR #7): supabase-js's enroll()
              actually returns qr_code as a data: URL
              ("data:image/svg+xml;utf-8,<svg>...") since 2.119.0, not raw
              SVG markup — confirmed in this repo's own installed
              node_modules/@supabase/auth-js. Rendering that string via
              dangerouslySetInnerHTML displayed the "data:image/..." prefix
              as literal text before the SVG. An <img> src handles a data
              URL correctly either way, and sidesteps the XSS-hole class of
              dangerouslySetInnerHTML entirely. */}
          <img
            className="mx-auto w-48"
            src={enrollment.qrCodeSvg}
            alt="QR code to scan with your authenticator app"
          />
          <p className="text-center text-xs text-muted-foreground">
            Can't scan it? Enter this code manually: <code>{enrollment.secret}</code>
          </p>
          <InputOTP maxLength={6} value={code} onChange={setCode} onComplete={onVerify}>
            <InputOTPGroup>
              {Array.from({ length: 6 }).map((_, i) => (
                <InputOTPSlot key={i} index={i} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
