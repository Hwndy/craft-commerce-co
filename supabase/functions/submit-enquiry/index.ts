// supabase/functions/submit-enquiry/index.ts (Phase 3 T5, FR-5.2–FR-5.4)
// See docs/03-data-and-security.md §6 for the reference design this follows.
//
// `handleRequest` holds all the real logic and takes every side effect
// (Turnstile verification, the rate-limit lookup, the DB insert, sending
// the owner's email) as injected `deps` — `Deno.serve`'s own handler below
// is the only place that builds real deps from `Deno.env`/fetch/the
// service-role client. index.test.ts exercises `handleRequest` directly
// with mock deps, so the tests need no network, no database and no real
// secrets.
import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import { z } from "npm:zod@3.25.76";

const enquirySchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().min(1).max(254).email(),
  message: z.string().trim().min(1).max(4000),
  productId: z.string().uuid().optional(),
  turnstileToken: z.string().min(1),
  website: z.string().optional().default(""),
});

export type EnquiryInput = z.infer<typeof enquirySchema>;

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export interface Env {
  turnstileSecret: string;
  ownerEmail: string;
  resendApiKey: string;
  resendFrom: string;
  ipHashSalt: string;
  allowedOrigins: string[];
}

export interface Deps {
  env: Env;
  verifyTurnstile: (token: string, remoteIp: string | null) => Promise<boolean>;
  isRateLimited: (ipHash: string) => Promise<boolean>;
  insertEnquiry: (row: {
    productId: string | null;
    name: string;
    email: string;
    message: string;
    ipHash: string | null;
  }) => Promise<void>;
  sendOwnerEmail: (input: { name: string; email: string; message: string }) => Promise<void>;
  hashIp: (ip: string) => Promise<string>;
}

const JSON_HEADERS = { "content-type": "application/json" };

function corsHeaders(origin: string | null, allowedOrigins: string[]): HeadersInit {
  const allowOrigin = origin && isAllowedOrigin(origin, allowedOrigins) ? origin : allowedOrigins[0] ?? "";
  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type, authorization, apikey",
    vary: "origin",
  };
}

export function isAllowedOrigin(origin: string, allowedOrigins: string[]): boolean {
  return allowedOrigins.some((allowed) => {
    if (allowed.startsWith("*.")) return origin.endsWith(allowed.slice(1));
    return origin === allowed;
  });
}

function json(body: unknown, status: number, origin: string | null, allowedOrigins: string[]): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...corsHeaders(origin, allowedOrigins) },
  });
}

export async function handleRequest(req: Request, deps: Deps): Promise<Response> {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin, deps.env.allowedOrigins) });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405, origin, deps.env.allowedOrigins);
  }

  if (origin && !isAllowedOrigin(origin, deps.env.allowedOrigins)) {
    return json({ error: "Forbidden." }, 403, origin, deps.env.allowedOrigins);
  }

  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return json({ error: "Invalid submission." }, 400, origin, deps.env.allowedOrigins);
  }

  const parsed = enquirySchema.safeParse(bodyJson);
  if (!parsed.success) {
    return json({ error: "Invalid submission." }, 400, origin, deps.env.allowedOrigins);
  }
  const input = parsed.data;

  // Honeypot: a real visitor never fills this (EnquiryForm hides it
  // off-screen). Returning the same success shape as a real submission —
  // without inserting, emailing or even checking Turnstile — avoids
  // teaching a bot that this field is being watched.
  if (input.website.trim() !== "") {
    return json({ ok: true }, 200, origin, deps.env.allowedOrigins);
  }

  const remoteIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ipHash = remoteIp ? await deps.hashIp(remoteIp) : null;

  if (ipHash && (await deps.isRateLimited(ipHash))) {
    return json({ error: "Too many requests. Please try again later." }, 429, origin, deps.env.allowedOrigins);
  }

  const verified = await deps.verifyTurnstile(input.turnstileToken, remoteIp);
  if (!verified) {
    return json({ error: "Verification failed. Please try again." }, 400, origin, deps.env.allowedOrigins);
  }

  await deps.insertEnquiry({
    productId: input.productId ?? null,
    name: input.name,
    email: input.email,
    message: input.message,
    ipHash,
  });

  try {
    await deps.sendOwnerEmail({ name: input.name, email: input.email, message: input.message });
  } catch (sendError) {
    // Never log names/emails/message bodies (docs/03-data-and-security.md
    // §6) — only that a send failed. The row is already stored above, so
    // the enquiry itself isn't lost even if this leg fails.
    console.error("submit-enquiry: owner email send failed", sendError instanceof Error ? sendError.message : sendError);
  }

  return json({ ok: true }, 200, origin, deps.env.allowedOrigins);
}

function readEnv(): Env {
  const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return {
    turnstileSecret: Deno.env.get("TURNSTILE_SECRET") ?? "",
    ownerEmail: Deno.env.get("OWNER_EMAIL") ?? "",
    resendApiKey: Deno.env.get("RESEND_API_KEY") ?? "",
    resendFrom: Deno.env.get("RESEND_FROM") ?? "ALL LIFE <enquiries@alllifeworks.com>",
    ipHashSalt: Deno.env.get("IP_HASH_SALT") ?? "",
    allowedOrigins,
  };
}

async function hashIp(ip: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function buildDeps(): Deps {
  const env = readEnv();
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

  return {
    env,
    hashIp: (ip) => hashIp(ip, env.ipHashSalt),

    verifyTurnstile: async (token, remoteIp) => {
      const body = new URLSearchParams({ secret: env.turnstileSecret, response: token });
      if (remoteIp) body.set("remoteip", remoteIp);
      const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!response.ok) return false;
      const result = (await response.json()) as { success?: boolean };
      return result.success === true;
    },

    isRateLimited: async (ipHash) => {
      const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
      const { count, error } = await supabase
        .from("enquiries")
        .select("id", { count: "exact", head: true })
        .eq("ip_hash", ipHash)
        .gte("created_at", since);
      if (error) throw error;
      return (count ?? 0) >= RATE_LIMIT_MAX;
    },

    insertEnquiry: async (row) => {
      const { error } = await supabase.from("enquiries").insert({
        product_id: row.productId,
        name: row.name,
        email: row.email,
        message: row.message,
        ip_hash: row.ipHash,
      });
      if (error) throw error;
    },

    sendOwnerEmail: async ({ name, email, message }) => {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.resendApiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: env.resendFrom,
          to: [env.ownerEmail],
          reply_to: email,
          subject: `New enquiry from ${name}`,
          text: message,
        }),
      });
      if (!response.ok) {
        throw new Error(`Resend responded with ${response.status}`);
      }
    },
  };
}

// import.meta.main is true only for the module Deno actually runs as the
// entry point (how the Supabase Edge Runtime invokes this file) — false
// when another module merely imports it, which is exactly what
// index.test.ts does to reach handleRequest. Without this guard, running
// the tests (`deno test`, deliberately with no --allow-net: they exercise
// handleRequest directly, with mock deps, and should need no network
// permission at all) tries to actually bind a listener as an import side
// effect and fails outright before a single test can run.
if (import.meta.main) {
  Deno.serve((req) => handleRequest(req, buildDeps()));
}
