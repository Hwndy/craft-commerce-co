import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { formatGbp, ProductLabel } from "./ProductLabel";

describe("formatGbp", () => {
  it("formats whole and fractional amounts as GBP", () => {
    expect(formatGbp(40)).toBe("£40.00");
    expect(formatGbp(9.5)).toBe("£9.50");
    expect(formatGbp(1234.5)).toBe("£1,234.50");
  });
});

describe("ProductLabel", () => {
  it("renders name, formatted price and description", () => {
    render(
      <ProductLabel
        name="Sample Belt No.5"
        price={40}
        description="Black tyre belt, aluminium buckle"
        status="available"
      />
    );
    expect(screen.getByText("Sample Belt No.5")).toBeInTheDocument();
    expect(screen.getByText("£40.00")).toBeInTheDocument();
    expect(screen.getByText("Black tyre belt, aluminium buckle")).toBeInTheDocument();
  });

  it.each([
    ["available", "Available"],
    ["made_to_order", "Made to order"],
    ["sold", "Sold"],
  ] as const)("shows the right status copy for %s", (status, copy) => {
    render(<ProductLabel name="Belt" price={10} status={status} />);
    expect(screen.getByText(copy)).toBeInTheDocument();
  });
});
