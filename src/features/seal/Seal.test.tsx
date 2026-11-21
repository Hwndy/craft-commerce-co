import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { sealHeading } from "@/content/seal";

import { Seal } from "./Seal";

describe("Seal", () => {
  it("renders the heading", () => {
    render(<Seal centerX={0} centerY={0} />);
    expect(screen.getByText(sealHeading)).toBeInTheDocument();
  });

  // Purely decorative, not clickable (confirmed directly with the owner) —
  // the whole subtree must be invisible to a screen reader and inert to
  // pointer/keyboard input, not just visually unobtrusive.
  it("is hidden from the accessibility tree and not interactive", () => {
    const { container } = render(<Seal centerX={0} centerY={0} />);
    const root = container.querySelector("[data-board-seal]") as HTMLElement;
    expect(root).not.toBeNull();
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root).toHaveClass("pointer-events-none");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("is positioned around its exact world centre", () => {
    const { container } = render(<Seal centerX={500} centerY={-300} />);
    const root = container.querySelector("[data-board-seal]") as HTMLElement;
    expect(root.style.left).toBe("200px");
    expect(root.style.top).toBe("-600px");
  });
});
