import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const { signInWithPasswordMock, requestPasswordResetMock, getSessionMock } = vi.hoisted(() => ({
  signInWithPasswordMock: vi.fn(),
  requestPasswordResetMock: vi.fn(),
  getSessionMock: vi.fn().mockResolvedValue({}),
}));
vi.mock("./lib/auth", () => ({
  signInWithPassword: signInWithPasswordMock,
  requestPasswordReset: requestPasswordResetMock,
  getSession: getSessionMock,
}));

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

import AdminLogin from "./AdminLogin";

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/admin/login"]}>
      <Routes>
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<div>Admin home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

async function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "owner@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("AdminLogin", () => {
  it("signs in and navigates straight to /admin when no MFA is required", async () => {
    signInWithPasswordMock.mockResolvedValueOnce({});
    needsMfaChallengeMock.mockResolvedValueOnce(false);
    renderLogin();

    await fillAndSubmit();

    await waitFor(() => expect(screen.getByText("Admin home")).toBeInTheDocument());
    expect(signInWithPasswordMock).toHaveBeenCalledWith("owner@example.com", "correct-password");
  });

  it("shows a server error instead of navigating on invalid credentials", async () => {
    signInWithPasswordMock.mockRejectedValueOnce(new Error("Invalid login credentials"));
    renderLogin();

    await fillAndSubmit();

    await waitFor(() => expect(screen.getByText("Invalid login credentials")).toBeInTheDocument());
    expect(screen.queryByText("Admin home")).not.toBeInTheDocument();
  });

  // T2's own "MFA prompt when enrolled" wording.
  it("shows the 6-digit code step when the account has MFA enrolled, not an immediate navigation", async () => {
    signInWithPasswordMock.mockResolvedValueOnce({});
    needsMfaChallengeMock.mockResolvedValueOnce(true);
    getVerifiedTotpFactorIdMock.mockResolvedValueOnce("factor-1");
    renderLogin();

    await fillAndSubmit();

    await waitFor(() =>
      expect(screen.getByText("Enter the 6-digit code from your authenticator app.")).toBeInTheDocument()
    );
    expect(screen.queryByText("Admin home")).not.toBeInTheDocument();
  });

  it("navigates to /admin once the MFA code verifies", async () => {
    signInWithPasswordMock.mockResolvedValueOnce({});
    needsMfaChallengeMock.mockResolvedValueOnce(true);
    getVerifiedTotpFactorIdMock.mockResolvedValueOnce("factor-1");
    challengeAndVerifySignInMock.mockResolvedValueOnce(undefined);
    renderLogin();

    await fillAndSubmit();
    await waitFor(() => screen.getByText("Enter the 6-digit code from your authenticator app."));

    // InputOTP renders 6 individual slots backed by one hidden text input.
    const hiddenInput = document.querySelector('input[inputmode="numeric"]') as HTMLInputElement;
    fireEvent.change(hiddenInput, { target: { value: "123456" } });

    await waitFor(() =>
      expect(challengeAndVerifySignInMock).toHaveBeenCalledWith("factor-1", "123456")
    );
    await waitFor(() => expect(screen.getByText("Admin home")).toBeInTheDocument());
  });

  it("sends a password reset request for the typed email", async () => {
    requestPasswordResetMock.mockResolvedValueOnce(undefined);
    renderLogin();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "owner@example.com" } });
    fireEvent.click(screen.getByText("Forgot password?"));

    await waitFor(() =>
      expect(requestPasswordResetMock).toHaveBeenCalledWith(
        "owner@example.com",
        expect.stringContaining("/admin/reset-password")
      )
    );
    await waitFor(() =>
      expect(screen.getByText("If that email has an account, a reset link is on its way.")).toBeInTheDocument()
    );
  });

  it("asks for an email first, rather than silently no-op'ing, if Forgot password is clicked with no email typed", () => {
    renderLogin();
    fireEvent.click(screen.getByText("Forgot password?"));
    expect(screen.getByText("Enter your email first")).toBeInTheDocument();
    expect(requestPasswordResetMock).not.toHaveBeenCalled();
  });
});
