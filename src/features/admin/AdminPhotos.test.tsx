import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AdminPhotos from "./AdminPhotos";

describe("AdminPhotos", () => {
  it("renders the Photos placeholder naming T6", () => {
    render(<AdminPhotos />);
    expect(screen.getByRole("heading", { name: "Photos" })).toBeInTheDocument();
    expect(screen.getByText(/Built in T6\./)).toBeInTheDocument();
  });
});
