import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PriceTagLabel } from "./PriceTagLabel";

describe("PriceTagLabel", () => {
  it("wall layout renders the name, price and status pill", () => {
    render(<PriceTagLabel name="RIYO — Sample 3" price={35} status="available" layout="wall" />);
    expect(screen.getByText("RIYO — Sample 3 · £35.00")).toBeInTheDocument();
    expect(screen.getByText("Available")).toBeInTheDocument();
    expect(screen.queryByText(/Black tyre belt/)).not.toBeInTheDocument();
  });

  it("floor layout renders name, price, description and status separately", () => {
    render(
      <PriceTagLabel
        name="Sample Belt No.5"
        price={40}
        status="made_to_order"
        description="Black tyre belt with aluminium buckle"
        layout="floor"
      />
    );
    expect(screen.getByText("Sample Belt No.5")).toBeInTheDocument();
    expect(screen.getByText("£40.00")).toBeInTheDocument();
    expect(screen.getByText("Black tyre belt with aluminium buckle")).toBeInTheDocument();
    expect(screen.getByText("Made to order")).toBeInTheDocument();
  });

  it("floor layout omits the description line when there's none", () => {
    render(<PriceTagLabel name="Belt" price={10} status="sold" layout="floor" />);
    expect(screen.getByText("Sold")).toBeInTheDocument();
    expect(screen.queryByText(/description/i)).not.toBeInTheDocument();
  });

  it("calls onClick when provided, and is a real button either way", () => {
    const onClick = vi.fn();
    render(<PriceTagLabel name="Belt" price={10} status="available" layout="wall" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: /Belt/ }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
