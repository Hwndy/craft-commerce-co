import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PriceTagLabel } from "./PriceTagLabel";

describe("PriceTagLabel", () => {
  it("renders the item name, formatted price, and a Size line from a Length bullet", () => {
    render(
      <PriceTagLabel
        name="RIYO — Sample 3"
        price={35}
        bullets={["Length: 124cm / 49in", "Buckle sand-cast using discarded aluminium"]}
        status="available"
      />
    );
    expect(screen.getByText("RIYO — Sample 3")).toBeInTheDocument();
    expect(screen.getByText("£35.00")).toBeInTheDocument();
    expect(screen.getByText("Size: 124cm / 49in")).toBeInTheDocument();
  });

  it("omits the Size line when there's no matching bullet", () => {
    render(<PriceTagLabel name="Belt" price={10} bullets={["Hand-finished"]} status="available" />);
    expect(screen.queryByText(/Size:/)).not.toBeInTheDocument();
  });

  it("shows a Sale badge only when onSale is true", () => {
    const { rerender } = render(<PriceTagLabel name="Belt" price={10} bullets={[]} status="available" />);
    expect(screen.queryByText("Sale")).not.toBeInTheDocument();

    rerender(<PriceTagLabel name="Belt" price={10} bullets={[]} status="available" onSale />);
    expect(screen.getByText("Sale")).toBeInTheDocument();
  });

  it("calls onClick when provided, and is a real button either way", () => {
    const onClick = vi.fn();
    render(<PriceTagLabel name="Belt" price={10} bullets={[]} status="available" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: /Belt/ }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
