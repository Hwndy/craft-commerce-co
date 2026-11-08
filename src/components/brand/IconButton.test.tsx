import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { IconButton } from "./IconButton";

describe("IconButton", () => {
  it("is reachable by its required aria-label and calls onClick", () => {
    const onClick = vi.fn();
    render(
      <IconButton aria-label="Zoom in" onClick={onClick}>
        <span aria-hidden>+</span>
      </IconButton>
    );
    const button = screen.getByRole("button", { name: "Zoom in" });
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["sm", "h-8", "w-8"],
    ["default", "h-10", "w-10"],
    ["lg", "h-12", "w-12"],
  ] as const)("size %s applies the matching dimension classes", (size, h, w) => {
    render(
      <IconButton aria-label="Close" size={size}>
        <span aria-hidden>×</span>
      </IconButton>
    );
    const button = screen.getByRole("button", { name: "Close" });
    expect(button.className).toContain(h);
    expect(button.className).toContain(w);
  });
});
