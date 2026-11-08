/// <reference types="vite/client" />
import { z } from "zod";

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
  VITE_FILM_AUTOSTART: z
    .string()
    .default("true")
    .transform((value) => value !== "false"),
  VITE_TURNSTILE_SITE_KEY: z.string().optional(),
  // The public, client-visible contact address for T4's mailto: purchase
  // link — distinct from OWNER_EMAIL (docs/01-architecture.md), which is a
  // server-only Edge Function secret for T5. A mailto: link is inherently
  // visible in the page regardless, so this one is meant to be public.
  VITE_OWNER_EMAIL: z.string().email(),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(import.meta.env);
