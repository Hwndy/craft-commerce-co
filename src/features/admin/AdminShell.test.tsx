import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const { signOutMock } = vi.hoisted(() => ({ signOutMock: vi.fn() }));
vi.mock("./lib/auth", () => ({ signOut: signOutMock }));

import { AdminShell } from "./AdminShell";

afterEach(() => {
  vi.clearAllMocks();
});

function renderShell(initialPath = "/admin/products") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/admin" element={<AdminShell />}>
          <Route path="products" element={<h1>Products</h1>} />
          <Route path="photos" element={<h1>Photos</h1>} />
          <Route path="pages" element={<h1>Pages</h1>} />
          <Route path="layout" element={<h1>Layout</h1>} />
          <Route path="enquiries" element={<h1>Enquiries</h1>} />
        </Route>
        <Route path="/admin/login" element={<div>Login page</div>} />
        <Route path="/admin/mfa-setup" element={<div>MFA setup page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AdminShell", () => {
  it("renders all five nav labels in both the sidebar and the bottom nav", () => {
    renderShell();

    for (const label of ["Products", "Photos", "Pages", "Layout", "Enquiries"]) {
      const links = screen.getAllByRole("link", { name: label });
      expect(links).toHaveLength(2);
    }
  });

  it("renders the matching section's content via the Outlet when a nav link is clicked", async () => {
    renderShell();
    expect(screen.getByRole("heading", { name: "Products" })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("link", { name: "Photos" })[0]);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Photos" })).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: "Products" })).not.toBeInTheDocument();
  });

  it("navigates to the MFA setup screen from the sidebar", () => {
    renderShell();
    fireEvent.click(screen.getAllByRole("button", { name: "Two-factor authentication" })[0]);
    expect(screen.getByText("MFA setup page")).toBeInTheDocument();
  });

  it("signs out and navigates to /admin/login", async () => {
    signOutMock.mockResolvedValueOnce(undefined);
    renderShell();

    fireEvent.click(screen.getAllByRole("button", { name: "Sign out" })[0]);

    await waitFor(() => expect(signOutMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText("Login page")).toBeInTheDocument());
  });

  it("shows a message and stays put when sign-out fails", async () => {
    signOutMock.mockRejectedValueOnce(new Error("network error"));
    renderShell();

    fireEvent.click(screen.getAllByRole("button", { name: "Sign out" })[0]);

    await waitFor(() => expect(screen.getAllByText("network error").length).toBeGreaterThan(0));
    expect(screen.queryByText("Login page")).not.toBeInTheDocument();
  });
});
