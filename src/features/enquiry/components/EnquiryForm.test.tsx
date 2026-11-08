import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ env: { VITE_TURNSTILE_SITE_KEY: "test-site-key" } }));

vi.mock("./Turnstile", () => ({
  // A real Cloudflare widget can't render in jsdom (it loads a remote
  // script) — this stand-in exposes the same contract (an onVerify
  // callback) as a plain button, so the form's own gating logic (submit
  // disabled until a token exists) is still exercised for real.
  TurnstileWidget: ({ onVerify }: { onVerify: (token: string) => void }) => (
    <button type="button" onClick={() => onVerify("test-token")}>
      Verify (mock Turnstile)
    </button>
  ),
}));

const submitEnquiry = vi.fn();
vi.mock("../lib/submitEnquiry", () => ({
  submitEnquiry: (...args: unknown[]) => submitEnquiry(...args),
}));

import { EnquiryForm } from "./EnquiryForm";

async function fillAndVerify(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Name"), "Jane Visitor");
  await user.type(screen.getByLabelText("Email"), "jane@example.com");
  await user.clear(screen.getByLabelText("Message"));
  await user.type(screen.getByLabelText("Message"), "I'd like to buy this.");
  await user.click(screen.getByRole("button", { name: "Verify (mock Turnstile)" }));
}

describe("EnquiryForm", () => {
  it("disables submit until the Turnstile check has verified", async () => {
    render(<EnquiryForm />);
    expect(screen.getByRole("button", { name: "Send enquiry" })).toBeDisabled();

    await userEvent.setup().click(screen.getByRole("button", { name: "Verify (mock Turnstile)" }));
    expect(screen.getByRole("button", { name: "Send enquiry" })).toBeEnabled();
  });

  it("rejects an empty name/email/message before calling submitEnquiry", async () => {
    const user = userEvent.setup();
    render(<EnquiryForm />);
    await user.click(screen.getByRole("button", { name: "Verify (mock Turnstile)" }));
    await user.click(screen.getByRole("button", { name: "Send enquiry" }));

    expect(await screen.findByText("Enter your name")).toBeInTheDocument();
    expect(submitEnquiry).not.toHaveBeenCalled();
  });

  it("rejects a malformed email", async () => {
    const user = userEvent.setup();
    render(<EnquiryForm />);
    await user.type(screen.getByLabelText("Name"), "Jane Visitor");
    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.type(screen.getByLabelText("Message"), "Hello");
    await user.click(screen.getByRole("button", { name: "Verify (mock Turnstile)" }));
    await user.click(screen.getByRole("button", { name: "Send enquiry" }));

    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(submitEnquiry).not.toHaveBeenCalled();
  });

  it("submits the verified form and shows a success state", async () => {
    submitEnquiry.mockResolvedValueOnce(undefined);
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<EnquiryForm productId="product-1" onSuccess={onSuccess} />);

    await fillAndVerify(user);
    await user.click(screen.getByRole("button", { name: "Send enquiry" }));

    await waitFor(() =>
      expect(submitEnquiry).toHaveBeenCalledWith({
        name: "Jane Visitor",
        email: "jane@example.com",
        message: "I'd like to buy this.",
        website: "",
        productId: "product-1",
        turnstileToken: "test-token",
      })
    );
    expect(await screen.findByText("Thank you — message sent")).toBeInTheDocument();
    expect(onSuccess).toHaveBeenCalled();
  });

  it("shows an error toast-worthy message and stays on the form when submission fails", async () => {
    submitEnquiry.mockRejectedValueOnce(new Error("network blip"));
    const user = userEvent.setup();
    render(<EnquiryForm />);
    await fillAndVerify(user);
    await user.click(screen.getByRole("button", { name: "Send enquiry" }));

    await waitFor(() => expect(submitEnquiry).toHaveBeenCalled());
    expect(screen.queryByText("Thank you — message sent")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send enquiry" })).toBeInTheDocument();
  });

  it("pre-fills the message when opened for a specific product", () => {
    render(<EnquiryForm productId="product-1" productName="Sample Belt No.5" />);
    expect(screen.getByLabelText("Message")).toHaveValue("Hi, I'd like to ask about Sample Belt No.5.");
  });

  it("the honeypot field is present but hidden from sighted/keyboard users", () => {
    render(<EnquiryForm />);
    const honeypot = document.getElementById("enquiry-website") as HTMLInputElement;
    expect(honeypot).not.toBeNull();
    expect(honeypot).toHaveAttribute("tabIndex", "-1");
    expect(honeypot.closest('[aria-hidden="true"]')).not.toBeNull();
  });
});
