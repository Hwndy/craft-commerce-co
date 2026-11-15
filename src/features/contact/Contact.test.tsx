import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { contactIntro } from "@/content/contact";
import { env } from "@/lib/env";

import { Contact } from "./Contact";

describe("Contact", () => {
  it("shows the owner's own intro copy from the mockup", () => {
    render(<Contact centerX={0} centerY={2000} />);
    expect(screen.getByText(contactIntro)).toBeInTheDocument();
  });

  // docs/decisions.md D-71, client feedback: the address is now visible
  // link text, reversing D-53's earlier "name the purpose, not the
  // address" choice. The href still has to carry the real address for
  // mailto: to work either way.
  it("shows the real owner email as the link's own visible text", () => {
    render(<Contact centerX={0} centerY={2000} />);
    const link = screen.getByRole("link", { name: `Send us an email at ${env.VITE_OWNER_EMAIL}` });
    expect(link).toHaveAttribute("href", `mailto:${env.VITE_OWNER_EMAIL}`);
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
