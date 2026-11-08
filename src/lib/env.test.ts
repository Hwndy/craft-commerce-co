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
  VITE_OWNER_EMAIL: z.string().email(),
});

const validConfig = {
  VITE_SUPABASE_URL: "https://example.supabase.co",
  VITE_SUPABASE_ANON_KEY: "anon-key",
  VITE_OWNER_EMAIL: "owner@example.com",
};

describe("env schema", () => {
  it("accepts a valid configuration and defaults VITE_FILM_AUTOSTART to true", () => {
    const parsed = envSchema.parse(validConfig);
    expect(parsed.VITE_FILM_AUTOSTART).toBe(true);
  });

  it("reads VITE_FILM_AUTOSTART=false as false", () => {
    const parsed = envSchema.parse({ ...validConfig, VITE_FILM_AUTOSTART: "false" });
    expect(parsed.VITE_FILM_AUTOSTART).toBe(false);
  });

  it("rejects a missing VITE_SUPABASE_URL", () => {
    const { VITE_SUPABASE_URL: _omit, ...rest } = validConfig;
    expect(() => envSchema.parse(rest)).toThrow();
  });

  it("rejects a non-URL VITE_SUPABASE_URL", () => {
    expect(() => envSchema.parse({ ...validConfig, VITE_SUPABASE_URL: "not-a-url" })).toThrow();
  });

  it("rejects a missing or malformed VITE_OWNER_EMAIL", () => {
    const { VITE_OWNER_EMAIL: _omit, ...rest } = validConfig;
    expect(() => envSchema.parse(rest)).toThrow();
    expect(() => envSchema.parse({ ...validConfig, VITE_OWNER_EMAIL: "not-an-email" })).toThrow();
  });
});
