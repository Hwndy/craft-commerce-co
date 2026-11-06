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
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(import.meta.env);
