// Deno tests for submit-enquiry (Phase 3 T5). Run with:
//   deno test --allow-env supabase/functions/submit-enquiry/
// Exercises `handleRequest` directly with mock `Deps` — no network, no
// database, no real Turnstile/Resend secrets needed.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

import { handleRequest, isAllowedOrigin, type Deps } from "./index.ts";

const ALLOWED_ORIGIN = "https://www.alllifeworks.com";

function makeDeps(overrides: Partial<Deps> = {}): Deps & { inserted: unknown[]; emailed: unknown[] } {
  const inserted: unknown[] = [];
  const emailed: unknown[] = [];
  return {
    env: {
      turnstileSecret: "test-secret",
      ownerEmail: "owner@example.com",
      resendApiKey: "test-resend-key",
      resendFrom: "ALL LIFE <enquiries@alllifeworks.com>",
      ipHashSalt: "test-salt",
      allowedOrigins: [ALLOWED_ORIGIN],
    },
    hashIp: (ip) => Promise.resolve(`hashed:${ip}`),
    verifyTurnstile: () => Promise.resolve(true),
    isRateLimited: () => Promise.resolve(false),
    insertEnquiry: (row) => {
      inserted.push(row);
      return Promise.resolve({ ok: true });
    },
    lookupProduct: () => Promise.resolve(null),
    sendOwnerEmail: (input) => {
      emailed.push(input);
      return Promise.resolve();
    },
    inserted,
    emailed,
    ...overrides,
  };
}

function makeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://example.supabase.co/functions/v1/submit-enquiry", {
    method: "POST",
    headers: { "content-type": "application/json", origin: ALLOWED_ORIGIN, ...headers },
    body: JSON.stringify(body),
  });
}

const validBody = {
  name: "Jane Visitor",
  email: "jane@example.com",
  message: "I'd like to buy this.",
  turnstileToken: "token-123",
  website: "",
};

Deno.test("isAllowedOrigin: exact match", () => {
  assertEquals(isAllowedOrigin("https://www.alllifeworks.com", ["https://www.alllifeworks.com"]), true);
  assertEquals(isAllowedOrigin("https://evil.example.com", ["https://www.alllifeworks.com"]), false);
});

Deno.test("isAllowedOrigin: wildcard suffix for preview deployments", () => {
  assertEquals(isAllowedOrigin("https://craft-commerce-co-abc123.vercel.app", ["*.vercel.app"]), true);
  assertEquals(isAllowedOrigin("https://not-vercel.example.com", ["*.vercel.app"]), false);
});

Deno.test("rejects a non-POST method", async () => {
  const deps = makeDeps();
  const res = await handleRequest(new Request("https://x/", { method: "GET" }), deps);
  assertEquals(res.status, 405);
});

Deno.test("rejects a disallowed origin", async () => {
  const deps = makeDeps();
  const res = await handleRequest(makeRequest(validBody, { origin: "https://evil.example.com" }), deps);
  assertEquals(res.status, 403);
});

Deno.test("validation failure: missing required field returns a generic 400", async () => {
  const deps = makeDeps();
  const { name: _name, ...withoutName } = validBody;
  const res = await handleRequest(makeRequest(withoutName), deps);
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body, { error: "Invalid submission." });
  assertEquals(deps.inserted.length, 0);
});

Deno.test("validation failure: malformed email returns a generic 400", async () => {
  const deps = makeDeps();
  const res = await handleRequest(makeRequest({ ...validBody, email: "not-an-email" }), deps);
  assertEquals(res.status, 400);
  assertEquals(deps.inserted.length, 0);
});

Deno.test("honeypot: a non-empty website field silently 'succeeds' without inserting or emailing", async () => {
  const deps = makeDeps();
  const res = await handleRequest(makeRequest({ ...validBody, website: "https://spam.example" }), deps);
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body, { ok: true });
  assertEquals(deps.inserted.length, 0);
  assertEquals(deps.emailed.length, 0);
});

Deno.test("rate limit: a hash already at the cap is rejected before Turnstile is even checked", async () => {
  let turnstileCalled = false;
  const deps = makeDeps({
    isRateLimited: () => Promise.resolve(true),
    verifyTurnstile: () => {
      turnstileCalled = true;
      return Promise.resolve(true);
    },
  });
  const res = await handleRequest(makeRequest(validBody, { "x-forwarded-for": "203.0.113.4" }), deps);
  assertEquals(res.status, 429);
  assertEquals(turnstileCalled, false);
  assertEquals(deps.inserted.length, 0);
});

Deno.test("Turnstile failure: an unverified token is rejected and nothing is stored", async () => {
  const deps = makeDeps({ verifyTurnstile: () => Promise.resolve(false) });
  const res = await handleRequest(makeRequest(validBody), deps);
  assertEquals(res.status, 400);
  assertEquals(deps.inserted.length, 0);
});

Deno.test("success path: valid submission is stored and the owner is emailed (mocked)", async () => {
  const deps = makeDeps();
  const res = await handleRequest(makeRequest(validBody, { "x-forwarded-for": "203.0.113.9" }), deps);
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body, { ok: true });
  assertEquals(deps.inserted.length, 1);
  assertEquals(deps.emailed.length, 1);
  assertEquals(deps.emailed[0], { name: validBody.name, email: validBody.email, message: validBody.message, product: null });
});

// PR #2 review: the atomic insert (migration 0004) is the real
// enforcement point — the pre-check (isRateLimited) is only a fast,
// non-atomic optimisation, so a request that slips past it must still be
// caught here, exactly as a genuinely concurrent request would be.
Deno.test("rate limit: the atomic insert catching what the pre-check missed is still rejected", async () => {
  const deps = makeDeps({
    isRateLimited: () => Promise.resolve(false),
    insertEnquiry: () => Promise.resolve({ ok: false, reason: "rate_limited" }),
  });
  const res = await handleRequest(makeRequest(validBody), deps);
  assertEquals(res.status, 429);
  assertEquals(deps.emailed.length, 0);
});

Deno.test("an unexpected failure from a dependency returns a generic 500, not a raw error", async () => {
  const deps = makeDeps({
    isRateLimited: () => Promise.reject(new Error("db connection lost")),
  });
  const res = await handleRequest(makeRequest(validBody, { "x-forwarded-for": "203.0.113.5" }), deps);
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body, { error: "Something went wrong. Please try again." });
});

Deno.test("an unexpected failure from verifyTurnstile also returns a generic 500", async () => {
  const deps = makeDeps({
    verifyTurnstile: () => Promise.reject(new Error("network error")),
  });
  const res = await handleRequest(makeRequest(validBody), deps);
  assertEquals(res.status, 500);
});

Deno.test("an unexpected failure from insertEnquiry also returns a generic 500", async () => {
  const deps = makeDeps({
    insertEnquiry: () => Promise.reject(new Error("constraint violation")),
  });
  const res = await handleRequest(makeRequest(validBody), deps);
  assertEquals(res.status, 500);
});

Deno.test("CORS: preflight allows x-client-info, which supabase-js's functions.invoke() always sends", async () => {
  const deps = makeDeps();
  const res = await handleRequest(
    new Request("https://example.supabase.co/functions/v1/submit-enquiry", {
      method: "OPTIONS",
      headers: { origin: ALLOWED_ORIGIN },
    }),
    deps
  );
  const allowHeaders = res.headers.get("access-control-allow-headers") ?? "";
  assertEquals(allowHeaders.toLowerCase().includes("x-client-info"), true);
});

Deno.test("a selected product's name and link are included in the owner's email, independent of the message text", async () => {
  const productId = "11111111-1111-1111-1111-111111111111";
  const deps = makeDeps({
    lookupProduct: (id) => {
      assertEquals(id, productId);
      return Promise.resolve({ name: "Sample Belt No.5", slug: "sample-belt-no-5" });
    },
  });
  await handleRequest(makeRequest({ ...validBody, productId, message: "Is this still available?" }), deps);
  const emailed = deps.emailed[0] as { product: { name: string; slug: string } | null };
  assertEquals(emailed.product, { name: "Sample Belt No.5", slug: "sample-belt-no-5" });
});

Deno.test("success path: an email send failure is swallowed — the visitor still sees ok:true", async () => {
  const deps = makeDeps({
    sendOwnerEmail: () => Promise.reject(new Error("Resend is down")),
  });
  const res = await handleRequest(makeRequest(validBody), deps);
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body, { ok: true });
  assertEquals(deps.inserted.length, 1);
});

Deno.test("productId is passed through to the stored row when present", async () => {
  const deps = makeDeps();
  const productId = "11111111-1111-1111-1111-111111111111";
  await handleRequest(makeRequest({ ...validBody, productId }), deps);
  assertEquals((deps.inserted[0] as { productId: string }).productId, productId);
});

Deno.test("CORS preflight (OPTIONS) is answered without touching any dependency", async () => {
  const deps = makeDeps();
  const res = await handleRequest(
    new Request("https://example.supabase.co/functions/v1/submit-enquiry", {
      method: "OPTIONS",
      headers: { origin: ALLOWED_ORIGIN },
    }),
    deps
  );
  assertEquals(res.status, 204);
  assertEquals(deps.inserted.length, 0);
});
