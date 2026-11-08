import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { env } from "@/lib/env";

import { TurnstileWidget } from "./Turnstile";
import { enquiryFormSchema, type EnquiryFormValues } from "../lib/schema";
import { submitEnquiry } from "../lib/submitEnquiry";

export interface EnquiryProductOption {
  id: string;
  /** Pre-formatted for display, e.g. "Sample Belt No.5 — £40.00" (Contact.tsx builds this with formatGbp). */
  label: string;
}

export interface EnquiryFormProps {
  /** Pre-fills the enquiry against a specific product, e.g. opened from ProductOverlay's "Use the form instead". Omitted for a general enquiry (Contact region, T6). */
  productId?: string;
  productName?: string;
  onSuccess?: () => void;
  /**
   * Contact region only (T6, matching the owner's mockup's "About a
   * product (optional)" dropdown): lets the visitor pick which product
   * their enquiry is about, since Contact has no pre-selected product
   * context the way ProductOverlay does. Only shown when `productId` is
   * not already given (that prop always wins) and this list is non-empty.
   * Omitted everywhere else — deliberately not fetched inside this
   * component, so every existing caller/test is unaffected.
   */
  productOptions?: EnquiryProductOption[];
}

/**
 * The fallback enquiry form (T5, FR-5.2–FR-5.4) — used from both
 * ProductOverlay's "Use the form instead" and the Contact region (T6).
 * All the real spam/abuse decisions (Turnstile verification, rate
 * limiting, the honeypot) are enforced server-side by submit-enquiry;
 * this form's own honeypot field and Turnstile widget give that function
 * something to check, not a client-side gate of their own.
 */
// EnquiryForm only ever renders on a cream `bg-surface-light` panel —
// ProductOverlay's sheet/dialog and now Contact (T6), never a dark one —
// but Input/Textarea/SelectTrigger default to the app-wide dark
// `bg-background` token. Unoverridden, that's not just a colour mismatch:
// with no explicit text colour either, typed text inherits the
// surrounding `text-surface-light-foreground` (near-black), landing on a
// near-black field background — effectively invisible while typing. Found
// visually (jsdom/e2e only assert text content, never render colour) while
// building T6's Contact region, which made the same already-shipped field
// visible on a cream panel for the first time.
const FIELD_CLASSNAME = "border-surface-light-foreground/20 bg-white text-surface-light-foreground placeholder:text-surface-light-foreground/40";

// Radix Select's own value can't be an empty string (that's reserved for
// "uncontrolled, no value prop"), so the explicit "no product" option
// below needs a real, non-empty sentinel instead — never submitted:
// onSubmit maps it straight back to an omitted productId.
const NO_PRODUCT_VALUE = "__none__";

export function EnquiryForm({ productId, productName, onSuccess, productOptions }: EnquiryFormProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const showProductSelect = !productId && !!productOptions && productOptions.length > 0;
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  // Changing TurnstileWidget's key forces React to unmount and remount it
  // — a fresh widget, a fresh token. A Turnstile token is single-use: if
  // verification already succeeded once but the submission still failed
  // (the insert, the network, anything past verification), the token
  // EnquiryForm is still holding has already been spent server-side.
  // Resubmitting it as-is would fail Turnstile verification again with no
  // visible reason, until the widget happened to refresh on its own
  // (found in review, PR #2) — forcing a remount here gets a visitor a
  // working retry immediately instead.
  const [turnstileKey, setTurnstileKey] = useState(0);
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
      await submitEnquiry({ ...values, productId: productId ?? (selectedProductId || undefined), turnstileToken });
      setSubmitted(true);
      onSuccess?.();
    } catch {
      toast("Couldn't send your enquiry — please try again, or email us directly.");
      setTurnstileToken(null);
      setTurnstileKey((key) => key + 1);
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
                <Input autoComplete="name" className={FIELD_CLASSNAME} {...field} />
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
                <Input type="email" autoComplete="email" className={FIELD_CLASSNAME} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {showProductSelect && (
          <div className="space-y-2">
            <label htmlFor="enquiry-product" className="text-sm font-medium">
              About a product (optional)
            </label>
            <Select
              value={selectedProductId || NO_PRODUCT_VALUE}
              onValueChange={(value) => setSelectedProductId(value === NO_PRODUCT_VALUE ? "" : value)}
            >
              <SelectTrigger id="enquiry-product" className={FIELD_CLASSNAME}>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                {/* Radix Select disallows an empty-string item value — this
                 * sentinel is how a visitor returns to "no product" after
                 * picking one by mistake, without reloading the form
                 * (found in review, Greptile/CodeRabbit, PR #3: the
                 * placeholder alone isn't a selectable option, so there was
                 * previously no way back to it once any real item was
                 * chosen). */}
                <SelectItem value={NO_PRODUCT_VALUE}>None</SelectItem>
                {productOptions!.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Message</FormLabel>
              <FormControl>
                <Textarea rows={4} className={FIELD_CLASSNAME} {...field} />
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
            key={turnstileKey}
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
