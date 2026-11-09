import { supabase } from "@/lib/supabase";

export interface TotpEnrollment {
  factorId: string;
  qrCodeSvg: string;
  secret: string;
}

/** True once the session actually needs (and hasn't yet completed) an MFA challenge this sign-in. */
export async function needsMfaChallenge(): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;
  return data.nextLevel === "aal2" && data.currentLevel !== data.nextLevel;
}

/** True once the account has at least one verified TOTP factor — "MFA prompt when enrolled" (T2) reads this to decide whether to show the challenge step at all. */
export async function hasVerifiedTotpFactor(): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return data.totp.some((factor) => factor.status === "verified");
}

export async function enrollTotp(): Promise<TotpEnrollment> {
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
  if (error) throw error;
  return { factorId: data.id, qrCodeSvg: data.totp.qr_code, secret: data.totp.secret };
}

/** Completes enrollment: the owner has scanned the QR code and typed the current 6-digit code back. */
export async function verifyEnrollment(factorId: string, code: string): Promise<void> {
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError) throw challengeError;
  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });
  if (verifyError) throw verifyError;
}

/** The sign-in-time challenge — a fresh `challenge()` is required by the Auth API even for an already-verified factor; this is per-sign-in, not a second enrollment. */
export async function challengeAndVerifySignIn(factorId: string, code: string): Promise<void> {
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError) throw challengeError;
  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });
  if (verifyError) throw verifyError;
}

export async function getVerifiedTotpFactorId(): Promise<string | null> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return data.totp.find((factor) => factor.status === "verified")?.id ?? null;
}
