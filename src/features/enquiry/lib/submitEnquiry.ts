import { supabase } from "@/lib/supabase";

import type { SubmitEnquiryInput } from "./schema";

export class SubmitEnquiryError extends Error {}

/**
 * Posts to the submit-enquiry Edge Function (T5, FR-5.2–FR-5.4). Thin and
 * synchronous-shaped on purpose — all the real decisions (Turnstile
 * verification, rate limiting, honeypot handling, storing the row, emailing
 * the owner) live server-side, where they can't be bypassed by a client
 * that skips this function. Errors are re-thrown as a single generic
 * message: the Edge Function itself never returns details worth
 * surfacing (docs/03-data-and-security.md §6: "generic error messages, no
 * stack traces"), so there's nothing more specific to pass through.
 */
export async function submitEnquiry(input: SubmitEnquiryInput): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ ok: true }>("submit-enquiry", {
    body: input,
  });

  if (error || !data?.ok) {
    throw new SubmitEnquiryError("Couldn't send your enquiry. Please try again, or email us directly.");
  }
}
