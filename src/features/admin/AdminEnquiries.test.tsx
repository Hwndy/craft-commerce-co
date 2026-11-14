import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AdminEnquiries from "./AdminEnquiries";

describe("AdminEnquiries", () => {
  it("renders the Enquiries placeholder naming T9", () => {
    render(<AdminEnquiries />);
    expect(screen.getByRole("heading", { name: "Enquiries" })).toBeInTheDocument();
    expect(screen.getByText(/Built in T9\./)).toBeInTheDocument();
  });
});
