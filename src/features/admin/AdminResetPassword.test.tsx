import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const { updatePasswordMock } = vi.hoisted(() => ({ updatePasswordMock: vi.fn() }));
vi.mock("./lib/auth", () => ({ updatePassword: updatePasswordMock }));

const { needsMfaChallengeMock, getVerifiedTotpFactorIdMock, challengeAndVerifySignInMock } = vi.hoisted(() => ({
  needsMfaChallengeMock: vi.fn(),
  getVerifiedTotpFactorIdMock: vi.fn(),
  challengeAndVerifySignInMock: vi.fn(),
}));
vi.mock("./lib/mfa", () => ({
  needsMfaChallenge: needsMfaChallengeMock,
  getVerifiedTotpFactorId: getVerifiedTotpFactorIdMock,
  challengeAndVerifySignIn: challengeAndVerifySignInMock,
}));

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
    needsMfaChallengeMock.mockResolvedValueOnce(false);
    renderPage();
    await waitFor(() => screen.getByLabelText("New password"));
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: "Set password" }));

    await waitFor(() => expect(screen.getByText("At least 8 characters")).toBeInTheDocument());
    expect(updatePasswordMock).not.toHaveBeenCalled();
  });

  it("sets the password and navigates to /admin on success when no MFA is required", async () => {
    needsMfaChallengeMock.mockResolvedValueOnce(false);
    updatePasswordMock.mockResolvedValueOnce(undefined);
    renderPage();
    await waitFor(() => screen.getByLabelText("New password"));
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "a-long-enough-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Set password" }));

    await waitFor(() => expect(updatePasswordMock).toHaveBeenCalledWith("a-long-enough-password"));
    await waitFor(() => expect(screen.getByText("Admin home")).toBeInTheDocument());
  });

  it("shows a server error and stays on the form when updatePassword fails", async () => {
    needsMfaChallengeMock.mockResolvedValueOnce(false);
    updatePasswordMock.mockRejectedValueOnce(new Error("Session expired"));
    renderPage();
    await waitFor(() => screen.getByLabelText("New password"));
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "a-long-enough-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Set password" }));

    await waitFor(() => expect(screen.getByText("Session expired")).toBeInTheDocument());
    expect(screen.queryByText("Admin home")).not.toBeInTheDocument();
  });

  // Found in review (CodeRabbit, Major, PR #7): the recovery session
  // starts at aal1 — for an account with a verified TOTP factor, Supabase
  // rejects updatePassword's updateUser() call until the session reaches
  // aal2. The form must only appear once that challenge is cleared.
  it("requires the MFA code before showing the password form when the account has a verified factor", async () => {
    needsMfaChallengeMock.mockResolvedValueOnce(true);
    getVerifiedTotpFactorIdMock.mockResolvedValueOnce("factor-1");
    challengeAndVerifySignInMock.mockResolvedValueOnce(undefined);
    updatePasswordMock.mockResolvedValueOnce(undefined);
    renderPage();

    await waitFor(() => screen.getByText("Enter the 6-digit code from your authenticator app."));
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();

    const hiddenInput = document.querySelector('input[inputmode="numeric"]') as HTMLInputElement;
    fireEvent.change(hiddenInput, { target: { value: "123456" } });
    await waitFor(() => expect(challengeAndVerifySignInMock).toHaveBeenCalledWith("factor-1", "123456"));

    await waitFor(() => screen.getByLabelText("New password"));
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "a-long-enough-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Set password" }));

    await waitFor(() => expect(updatePasswordMock).toHaveBeenCalledWith("a-long-enough-password"));
    await waitFor(() => expect(screen.getByText("Admin home")).toBeInTheDocument());
  });

  it("shows a message instead of a blank page when the MFA status check fails", async () => {
    needsMfaChallengeMock.mockRejectedValueOnce(new Error("network error"));
    renderPage();

    await waitFor(() =>
      expect(
        screen.getByText("Couldn't check your two-factor status. Use the reset link from your email again.")
      ).toBeInTheDocument()
    );
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
  });
});
