import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate } from "react-router-dom";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import { updatePassword } from "./lib/auth";
import { getVerifiedTotpFactorId, needsMfaChallenge } from "./lib/mfa";
import { MfaChallengeStep } from "./components/MfaChallengeStep";
import { NoIndex } from "./components/NoIndex";

const schema = z.object({
  password: z.string().min(8, "At least 8 characters"),
});
type Values = z.infer<typeof schema>;

// Found in review (CodeRabbit, Major, PR #7): the recovery link's own
// session starts at aal1, same as a fresh password sign-in — for an
// account with a verified TOTP factor, Supabase Auth rejects updateUser's
// password change with insufficient_aal until that session reaches aal2.
// This mirrors AdminLogin.tsx's own post-sign-in check, just gated on the
// recovery session that's already live by the time this component mounts
// instead of on a signInWithPassword() call.
type Step = { kind: "checking" } | { kind: "mfa"; factorId: string } | { kind: "password" } | { kind: "failed" };

/**
 * Lands here from the password-reset email's link — supabase-js's client
 * (detectSessionInUrl, the default) already turns that link's token into
 * a real session before this component ever mounts, so updateUser() below
 * just needs a password, not any token handling of its own.
 */
export default function AdminResetPassword() {
  const [step, setStep] = useState<Step>({ kind: "checking" });
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (await needsMfaChallenge()) {
          const factorId = await getVerifiedTotpFactorId();
          if (!active) return;
          if (!factorId) {
            setStep({ kind: "failed" });
            return;
          }
          setStep({ kind: "mfa", factorId });
          return;
        }
        if (active) setStep({ kind: "password" });
      } catch {
        if (active) setStep({ kind: "failed" });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: "" } });

  async function onSubmit(values: Values) {
    setServerError(null);
    try {
      await updatePassword(values.password);
      setDone(true);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Couldn't set the new password.");
    }
  }

  if (done) return <Navigate to="/admin" replace />;

  return (
    <>
      <NoIndex />
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="mb-6 text-center text-2xl font-heading">Set a new password</h1>

          {step.kind === "checking" && (
            <p className="text-center text-sm text-muted-foreground">Checking your session…</p>
          )}

          {step.kind === "failed" && (
            <p className="text-center text-sm text-destructive">
              Couldn't check your two-factor status. Use the reset link from your email again.
            </p>
          )}

          {step.kind === "mfa" && (
            <MfaChallengeStep
              factorId={step.factorId}
              onVerified={() => setStep({ kind: "password" })}
            />
          )}

          {step.kind === "password" && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New password</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="new-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {serverError && <p className="text-sm text-destructive">{serverError}</p>}
                <Button type="submit" variant="pill" className="w-full" disabled={form.formState.isSubmitting}>
                  Set password
                </Button>
              </form>
            </Form>
          )}
        </div>
      </div>
    </>
  );
}
