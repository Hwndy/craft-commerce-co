import { describe, expect, it } from "vitest";
import { z } from "zod";

// Mirrors the schema in env.ts (import.meta.env can't be reassigned per-test,
// so the schema itself is the unit under test here).
const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
  VITE_FILM_AUTOSTART: z
    .string()
    .default("true")
    .transform((value) => value !== "false"),
  VITE_TURNSTILE_SITE_KEY: z.string().optional(),
});

describe("env schema", () => {
  it("accepts a valid configuration and defaults VITE_FILM_AUTOSTART to true", () => {
    const parsed = envSchema.parse({
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_ANON_KEY: "anon-key",
    });
    expect(parsed.VITE_FILM_AUTOSTART).toBe(true);
  });

  it("reads VITE_FILM_AUTOSTART=false as false", () => {
    const parsed = envSchema.parse({
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_ANON_KEY: "anon-key",
      VITE_FILM_AUTOSTART: "false",
    });
    expect(parsed.VITE_FILM_AUTOSTART).toBe(false);
  });

  it("rejects a missing VITE_SUPABASE_URL", () => {
    expect(() =>
      envSchema.parse({ VITE_SUPABASE_ANON_KEY: "anon-key" })
    ).toThrow();
  });

  it("rejects a non-URL VITE_SUPABASE_URL", () => {
    expect(() =>
      envSchema.parse({
        VITE_SUPABASE_URL: "not-a-url",
        VITE_SUPABASE_ANON_KEY: "anon-key",
      })
    ).toThrow();
  });
});
