import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AdminProducts from "./AdminProducts";

describe("AdminProducts", () => {
  it("renders the Products placeholder naming T5", () => {
    render(<AdminProducts />);
    expect(screen.getByRole("heading", { name: "Products" })).toBeInTheDocument();
    expect(screen.getByText(/Built in T5\./)).toBeInTheDocument();
  });
});
