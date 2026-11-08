import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { contactIntro } from "@/content/contact";
import { env } from "@/lib/env";

import { Contact } from "./Contact";

// EnquiryForm (T5) has its own dedicated test file — stubbed here so these
// tests only assert Contact's own job: the product options it builds and
// hands over, same precedent as ProductOverlay.test.tsx's own stub.
vi.mock("@/features/enquiry/components/EnquiryForm", () => ({
  EnquiryForm: ({ productOptions }: { productOptions?: { id: string; label: string }[] }) => (
    <div data-testid="enquiry-form-stub">
      {(productOptions ?? []).map((o) => (
        <span key={o.id}>{o.label}</span>
      ))}
    </div>
  ),
}));

vi.mock("@/features/shop/lib/useProducts", () => ({
  useProducts: () => ({
    data: [
      { id: "product-1", name: "Sample Belt No.5", priceAmount: 40, priceCurrency: "GBP" },
      { id: "product-2", name: "Sample Belt No.2", priceAmount: 40, priceCurrency: "GBP" },
    ],
  }),
}));

describe("Contact", () => {
  it("builds a labelled product option for every real product, for EnquiryForm's picker", () => {
    render(<Contact centerX={0} centerY={2000} />);
    expect(screen.getByText("Sample Belt No.5 — £40.00")).toBeInTheDocument();
    expect(screen.getByText("Sample Belt No.2 — £40.00")).toBeInTheDocument();
  });

  it("shows the owner's own intro copy from the mockup", () => {
    render(<Contact centerX={0} centerY={2000} />);
    expect(screen.getByText(contactIntro)).toBeInTheDocument();
  });

  // T6: "the email hyperlink (rendered so the address is not exposed as
  // plain text...)" — the href still has to carry the real address for
  // mailto: to work (unavoidable, D-53), but nothing here spells the
  // address out a second time as the link's own visible text.
  it("the email link's visible text names its purpose, not the raw address — the href still carries it", () => {
    render(<Contact centerX={0} centerY={2000} />);
    const link = screen.getByRole("link", { name: "Email ALL LIFE directly" });
    expect(link).toHaveAttribute("href", `mailto:${env.VITE_OWNER_EMAIL}`);
    expect(screen.queryByText(env.VITE_OWNER_EMAIL)).not.toBeInTheDocument();
  });

  // No real social URLs have been supplied yet (docs/00-product-brief.md
  // §5) — rendered as visible-but-disabled, not a guessed/dead link
  // (docs/decisions.md D-53's own precedent).
  it("a social link with no owner-supplied URL yet is disabled, not a guessed or dead link", () => {
    render(<Contact centerX={0} centerY={2000} />);
    const button = screen.getByRole("button", { name: "Instagram (coming soon)" });
    expect(button).toBeDisabled();
  });

  it("renders as a canvas Region positioned around its centre", () => {
    const { container } = render(<Contact centerX={0} centerY={2000} />);
    const region = container.querySelector('[data-region-id="contact"]') as HTMLElement;
    expect(region).not.toBeNull();
    expect(region.style.left).toBe("-380px");
    expect(region.style.top).toBe("1620px");
  });
});
