import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useLocation } from "react-router-dom";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

import { getSession, requestPasswordReset, signInWithPassword } from "./lib/auth";
import { challengeAndVerifySignIn, getVerifiedTotpFactorId, needsMfaChallenge } from "./lib/mfa";
import { NoIndex } from "./components/NoIndex";

const credentialsSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
type CredentialsValues = z.infer<typeof credentialsSchema>;

type Step =
  | { kind: "credentials" }
  | { kind: "mfa"; factorId: string }
  | { kind: "done" };

export default function AdminLogin() {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/admin";

  const [step, setStep] = useState<Step>({ kind: "credentials" });
  const [serverError, setServerError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const credentialsForm = useForm<CredentialsValues>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmitCredentials(values: CredentialsValues) {
    setServerError(null);
    try {
      await signInWithPassword(values.email, values.password);
      if (await needsMfaChallenge()) {
        const factorId = await getVerifiedTotpFactorId();
        if (!factorId) {
          // The server says a second factor is required but lists none —
          // shouldn't happen outside a half-finished enrollment; surfaced
          // plainly rather than silently retrying.
          throw new Error("Two-factor authentication is required but no factor is enrolled.");
        }
        setStep({ kind: "mfa", factorId });
        return;
      }
      setStep({ kind: "done" });
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Sign in failed.");
    }
  }

  async function onForgotPassword() {
    const email = credentialsForm.getValues("email");
    if (!email) {
      credentialsForm.setError("email", { message: "Enter your email first" });
      return;
    }
    setServerError(null);
    try {
      await requestPasswordReset(email, `${window.location.origin}/admin/reset-password`);
      setResetSent(true);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Couldn't send the reset email.");
    }
  }

  if (step.kind === "done") {
    return <Navigate to={from} replace />;
  }

  return (
    <>
      <NoIndex />
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="mb-6 text-center text-2xl font-heading">ALL LIFE admin</h1>

          {step.kind === "credentials" && (
            <Form {...credentialsForm}>
              <form
                onSubmit={credentialsForm.handleSubmit(onSubmitCredentials)}
                className="space-y-4"
              >
                <FormField
                  control={credentialsForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" autoComplete="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={credentialsForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="current-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {serverError && <p className="text-sm text-destructive">{serverError}</p>}
                {resetSent && (
                  <p className="text-sm text-muted-foreground">
                    If that email has an account, a reset link is on its way.
                  </p>
                )}
                <Button
                  type="submit"
                  variant="pill"
                  className="w-full"
                  disabled={credentialsForm.formState.isSubmitting}
                >
                  Sign in
                </Button>
                <button
                  type="button"
                  onClick={onForgotPassword}
                  className="w-full text-center text-sm text-muted-foreground underline underline-offset-2"
                >
                  Forgot password?
                </button>
              </form>
            </Form>
          )}

          {step.kind === "mfa" && (
            <MfaChallengeStep
              factorId={step.factorId}
              onVerified={() => setStep({ kind: "done" })}
            />
          )}
        </div>
      </div>
    </>
  );
}

function MfaChallengeStep({
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
      // getSession() isn't strictly needed here, but confirms the session
      // the caller is about to trust is actually there before navigating.
      await getSession();
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
