import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RegionLabel } from "./RegionLabel";

describe("RegionLabel", () => {
  it("renders title and subtitle, and calls onClick", () => {
    const onClick = vi.fn();
    render(<RegionLabel title="Gallery" subtitle="Film · Collage" onClick={onClick} />);

    expect(screen.getByText("Gallery")).toBeInTheDocument();
    expect(screen.getByText("Film · Collage")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders an icon tile when icon is provided", () => {
    render(<RegionLabel title="Shop" icon={<svg data-testid="shop-icon" />} />);
    expect(screen.getByTestId("shop-icon")).toBeInTheDocument();
  });

  it("omits the icon tile when none is provided", () => {
    const { container } = render(<RegionLabel title="About" />);
    expect(container.querySelector(".bg-black\\/40")).not.toBeInTheDocument();
  });
});
