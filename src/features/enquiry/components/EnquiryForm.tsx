import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { env } from "@/lib/env";

import { TurnstileWidget } from "./Turnstile";
import { enquiryFormSchema, type EnquiryFormValues } from "../lib/schema";
import { submitEnquiry } from "../lib/submitEnquiry";

export interface EnquiryFormProps {
  /** Pre-fills the enquiry against a specific product, e.g. opened from ProductOverlay's "Use the form instead". Omitted for a general enquiry (Contact region, T6). */
  productId?: string;
  productName?: string;
  onSuccess?: () => void;
}

/**
 * The fallback enquiry form (T5, FR-5.2–FR-5.4) — used from both
 * ProductOverlay's "Use the form instead" and the Contact region (T6).
 * All the real spam/abuse decisions (Turnstile verification, rate
 * limiting, the honeypot) are enforced server-side by submit-enquiry;
 * this form's own honeypot field and Turnstile widget give that function
 * something to check, not a client-side gate of their own.
 */
export function EnquiryForm({ productId, productName, onSuccess }: EnquiryFormProps) {
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<EnquiryFormValues>({
    resolver: zodResolver(enquiryFormSchema),
    defaultValues: { name: "", email: "", message: productName ? `Hi, I'd like to ask about ${productName}.` : "", website: "" },
  });

  const onSubmit = async (values: EnquiryFormValues) => {
    if (!turnstileToken) {
      toast("Please complete the verification check above.");
      return;
    }
    try {
      await submitEnquiry({ ...values, productId, turnstileToken });
      setSubmitted(true);
      onSuccess?.();
    } catch {
      toast("Couldn't send your enquiry — please try again, or email us directly.");
    }
  };

  if (submitted) {
    return (
      <div className="py-6 text-center" role="status">
        <p className="font-heading text-lg font-bold">Thank you — message sent</p>
        {/* Placeholder confirmation wording pending the owner's own (phases/PHASE-3-shop-and-enquiry.md's "Owner inputs needed"). */}
        <p className="mt-1 text-sm text-surface-light-foreground/70">
          We've received your enquiry and will reply by email soon.
        </p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input autoComplete="name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
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
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Message</FormLabel>
              <FormControl>
                <Textarea rows={4} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Honeypot: off-screen (not display:none — some bots skip that),
         * never focusable or announced, so a real visitor never knows it's
         * there. A non-empty value is checked server-side only — nothing
         * here rejects it, since telling a bot its field was spotted just
         * teaches it to try harder. */}
        <div className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
          <label htmlFor="enquiry-website">Leave this field empty</label>
          <input id="enquiry-website" type="text" tabIndex={-1} autoComplete="off" {...form.register("website")} />
        </div>

        {env.VITE_TURNSTILE_SITE_KEY ? (
          <TurnstileWidget
            siteKey={env.VITE_TURNSTILE_SITE_KEY}
            onVerify={setTurnstileToken}
            onExpire={() => setTurnstileToken(null)}
            onError={() => setTurnstileToken(null)}
          />
        ) : (
          <p className="text-sm text-destructive">Spam protection isn't configured — this form can't be submitted yet.</p>
        )}

        <Button type="submit" variant="pill" disabled={form.formState.isSubmitting || !turnstileToken}>
          {form.formState.isSubmitting ? "Sending…" : "Send enquiry"}
        </Button>
      </form>
    </Form>
  );
}
