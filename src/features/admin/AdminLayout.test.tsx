import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AdminLayout from "./AdminLayout";

describe("AdminLayout", () => {
  it("renders the Layout placeholder naming T8", () => {
    render(<AdminLayout />);
    expect(screen.getByRole("heading", { name: "Layout" })).toBeInTheDocument();
    expect(screen.getByText(/Built in T8\./)).toBeInTheDocument();
  });
});
