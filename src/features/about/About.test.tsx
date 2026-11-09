import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { aboutContent } from "@/content/about";

import { About } from "./About";

describe("About", () => {
  it("shows the owner's purpose statement and tagline from the mockup", () => {
    render(<About centerX={0} centerY={-2000} />);
    expect(screen.getByText(aboutContent.tagline)).toBeInTheDocument();
    expect(screen.getByText(aboutContent.purpose)).toBeInTheDocument();
  });

  it("flags the brand story as a placeholder, not real owner copy", () => {
    render(<About centerX={0} centerY={-2000} />);
    expect(screen.getByText("Placeholder — pending the owner's own words")).toBeInTheDocument();
  });

  it("shows every category tag from the mockup", () => {
    render(<About centerX={0} centerY={-2000} />);
    for (const tag of aboutContent.tags) {
      expect(screen.getByText(tag)).toBeInTheDocument();
    }
  });

  it("renders as a canvas Region positioned around its centre", () => {
    const { container } = render(<About centerX={0} centerY={-2000} />);
    const region = container.querySelector('[data-region-id="about"]') as HTMLElement;
    expect(region).not.toBeNull();
    expect(region.style.left).toBe("-380px");
    expect(region.style.top).toBe("-2380px");
  });
});
