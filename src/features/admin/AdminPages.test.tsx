import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AdminPages from "./AdminPages";

describe("AdminPages", () => {
  it("renders the Pages placeholder naming T7", () => {
    render(<AdminPages />);
    expect(screen.getByRole("heading", { name: "Pages" })).toBeInTheDocument();
    expect(screen.getByText(/Built in T7\./)).toBeInTheDocument();
  });
});
