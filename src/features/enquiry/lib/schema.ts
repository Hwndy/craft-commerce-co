import { z } from "zod";

/**
 * Shared shape for the enquiry form (T5, FR-5.2). Matches
 * docs/03-data-and-security.md §6's field list and limits exactly, so the
 * client's own validation never accepts something the Edge Function would
 * reject. `website` is the honeypot: a real visitor never sees or fills it
 * (EnquiryForm hides it off-screen), so any non-empty value marks the
 * submission as spam. It stays unvalidated here (no max/regex) — the point
 * is only whether it's empty, decided by the caller, not by this schema.
 */
export const enquiryFormSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(120, "That name is too long"),
  email: z.string().trim().min(1, "Enter your email address").max(254, "That email is too long").email("Enter a valid email address"),
  message: z.string().trim().min(1, "Enter a message").max(4000, "That message is too long"),
  website: z.string().optional().default(""),
});

export type EnquiryFormValues = z.infer<typeof enquiryFormSchema>;

export interface SubmitEnquiryInput extends EnquiryFormValues {
  productId?: string;
  turnstileToken: string;
}
