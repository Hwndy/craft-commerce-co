import { describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/lib/supabase", () => ({
  supabase: { functions: { invoke } },
}));

import { submitEnquiry, SubmitEnquiryError } from "./submitEnquiry";

const input = {
  name: "Jane Visitor",
  email: "jane@example.com",
  message: "I'd like to buy this.",
  website: "",
  turnstileToken: "token-123",
};

describe("submitEnquiry", () => {
  it("invokes the submit-enquiry function with the given input", async () => {
    invoke.mockResolvedValueOnce({ data: { ok: true }, error: null });
    await submitEnquiry(input);
    expect(invoke).toHaveBeenCalledWith("submit-enquiry", { body: input });
  });

  it("resolves without throwing on a successful response", async () => {
    invoke.mockResolvedValueOnce({ data: { ok: true }, error: null });
    await expect(submitEnquiry(input)).resolves.toBeUndefined();
  });

  it("throws a generic SubmitEnquiryError when the function returns an error", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: new Error("network blip") });
    await expect(submitEnquiry(input)).rejects.toBeInstanceOf(SubmitEnquiryError);
  });

  it("throws when the function responds without ok: true", async () => {
    invoke.mockResolvedValueOnce({ data: { ok: false }, error: null });
    await expect(submitEnquiry(input)).rejects.toBeInstanceOf(SubmitEnquiryError);
  });
});
