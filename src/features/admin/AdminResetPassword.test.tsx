import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const { updatePasswordMock } = vi.hoisted(() => ({ updatePasswordMock: vi.fn() }));
vi.mock("./lib/auth", () => ({ updatePassword: updatePasswordMock }));

import AdminResetPassword from "./AdminResetPassword";

afterEach(() => {
  vi.clearAllMocks();
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/admin/reset-password"]}>
      <Routes>
        <Route path="/admin/reset-password" element={<AdminResetPassword />} />
        <Route path="/admin" element={<div>Admin home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AdminResetPassword", () => {
  it("rejects a password under 8 characters before calling updatePassword", async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: "Set password" }));

    await waitFor(() => expect(screen.getByText("At least 8 characters")).toBeInTheDocument());
    expect(updatePasswordMock).not.toHaveBeenCalled();
  });

  it("sets the password and navigates to /admin on success", async () => {
    updatePasswordMock.mockResolvedValueOnce(undefined);
    renderPage();
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "a-long-enough-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Set password" }));

    await waitFor(() => expect(updatePasswordMock).toHaveBeenCalledWith("a-long-enough-password"));
    await waitFor(() => expect(screen.getByText("Admin home")).toBeInTheDocument());
  });

  it("shows a server error and stays on the form when updatePassword fails", async () => {
    updatePasswordMock.mockRejectedValueOnce(new Error("Session expired"));
    renderPage();
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "a-long-enough-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Set password" }));

    await waitFor(() => expect(screen.getByText("Session expired")).toBeInTheDocument());
    expect(screen.queryByText("Admin home")).not.toBeInTheDocument();
  });
});
