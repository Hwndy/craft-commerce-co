import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionMock, onAuthStateChangeMock, signOutMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  onAuthStateChangeMock: vi.fn(),
  signOutMock: vi.fn(),
}));
vi.mock("./lib/auth", async () => {
  const actual = await vi.importActual<typeof import("./lib/auth")>("./lib/auth");
  return {
    ...actual,
    getSession: getSessionMock,
    onAuthStateChange: onAuthStateChangeMock,
    signOut: signOutMock,
  };
});

// Found in review (Greptile, PR #7, security): is_admin() now requires
// aal2 once a verified MFA factor is enrolled (docs/decisions.md D-65) —
// AdminGuard has to check this too, not just the role claim, so it's
// mocked explicitly here rather than relying on the real client's
// behaviour with no genuine session in jsdom.
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

import { AdminGuard } from "./AdminGuard";

// A minimal unsigned JWT (header.payload.signature, base64url, no real
// signing) so sessionAal() — which decodes the real access_token, not a
// mock — can read a genuine `aal` claim back out of it.
function fakeAccessToken(aal: string): string {
  const base64url = (value: Record<string, unknown>) =>
    btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${base64url({ alg: "none" })}.${base64url({ aal })}.sig`;
}

function session(appMetadata: Record<string, unknown> = {}, userId = "admin-user-1", aal = "aal1") {
  return { user: { id: userId, app_metadata: appMetadata }, access_token: fakeAccessToken(aal) } as never;
}

function renderGuard() {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route path="/admin/login" element={<div>Login screen</div>} />
        <Route
          path="/admin"
          element={
            <AdminGuard>
              <div>Protected content</div>
            </AdminGuard>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("AdminGuard", () => {
  // Every test gets these defaults *before* its own body runs, so a test
  // that wants its own override (e.g. the sign-out one, to capture the
  // auth-state callback) can set it afterwards without this clobbering it
  // back. needsMfaChallenge defaults to false — most tests here aren't
  // about MFA at all.
  beforeEach(() => {
    onAuthStateChangeMock.mockReturnValue(vi.fn());
    needsMfaChallengeMock.mockResolvedValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing while the initial session check is in flight", () => {
    getSessionMock.mockReturnValue(new Promise(() => {})); // never resolves
    const { container } = renderGuard();
    expect(container).toBeEmptyDOMElement();
  });

  // T2's own test requirement: unauthenticated users are redirected.
  it("redirects an unauthenticated visitor to /admin/login", async () => {
    getSessionMock.mockResolvedValue(null);
    renderGuard();
    await waitFor(() => expect(screen.getByText("Login screen")).toBeInTheDocument());
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  // T2's own test requirement: a non-admin authenticated user sees "no
  // access" (this test's own half of it — pgTAP proves the write side).
  it("shows 'No access' in place, not a redirect, for an authenticated non-admin", async () => {
    getSessionMock.mockResolvedValue(session({ role: "editor" }));
    renderGuard();
    await waitFor(() => expect(screen.getByText("No access")).toBeInTheDocument());
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
    expect(screen.queryByText("Login screen")).not.toBeInTheDocument();
  });

  // Found in review (Greptile, PR #7): a denied user had no way to sign
  // out short of manually finding /admin/login.
  it("lets a denied non-admin sign out from the 'No access' screen", async () => {
    getSessionMock.mockResolvedValue(session({ role: "editor" }));
    renderGuard();
    await waitFor(() => screen.getByText("No access"));

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(signOutMock).toHaveBeenCalled());
  });

  it("renders the protected content for an admin session with no MFA required", async () => {
    getSessionMock.mockResolvedValue(session({ role: "admin" }));
    needsMfaChallengeMock.mockResolvedValue(false);
    renderGuard();
    await waitFor(() => expect(screen.getByText("Protected content")).toBeInTheDocument());
  });

  // Found in review (Greptile, PR #7, security): a lingering aal1 session
  // on an account with a verified factor must be asked to finish MFA
  // here, not waved through.
  it("shows the MFA challenge step, not the protected content, when a verified factor needs completing", async () => {
    getSessionMock.mockResolvedValue(session({ role: "admin" }));
    needsMfaChallengeMock.mockResolvedValue(true);
    getVerifiedTotpFactorIdMock.mockResolvedValue("factor-1");
    renderGuard();

    await waitFor(() =>
      expect(screen.getByText("Enter the 6-digit code from your authenticator app.")).toBeInTheDocument()
    );
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("renders the protected content once the MFA challenge verifies", async () => {
    getSessionMock.mockResolvedValue(session({ role: "admin" }));
    needsMfaChallengeMock.mockResolvedValue(true);
    getVerifiedTotpFactorIdMock.mockResolvedValue("factor-1");
    challengeAndVerifySignInMock.mockResolvedValue(undefined);
    renderGuard();
    await waitFor(() => screen.getByText("Enter the 6-digit code from your authenticator app."));

    const hiddenInput = document.querySelector('input[inputmode="numeric"]') as HTMLInputElement;
    fireEvent.change(hiddenInput, { target: { value: "123456" } });

    await waitFor(() => expect(challengeAndVerifySignInMock).toHaveBeenCalledWith("factor-1", "123456"));
    await waitFor(() => expect(screen.getByText("Protected content")).toBeInTheDocument());
  });

  // Found in review (Greptile P2, PR #7): a failed MFA lookup (e.g. a
  // network error) left `mfa` stuck on "checking" forever — a blank page,
  // no explanation, no way to retry short of a full reload.
  it("shows a retry screen, not a blank page, when the MFA lookup fails", async () => {
    getSessionMock.mockResolvedValue(session({ role: "admin" }));
    needsMfaChallengeMock.mockRejectedValue(new Error("network error"));
    renderGuard();

    await waitFor(() => expect(screen.getByText("Couldn't check two-factor status")).toBeInTheDocument());
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("re-runs the MFA lookup and recovers when Retry is clicked", async () => {
    getSessionMock.mockResolvedValue(session({ role: "admin" }));
    needsMfaChallengeMock.mockRejectedValueOnce(new Error("network error"));
    needsMfaChallengeMock.mockResolvedValueOnce(false);
    renderGuard();
    await waitFor(() => screen.getByText("Couldn't check two-factor status"));

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByText("Protected content")).toBeInTheDocument());
  });

  // Found in review (Greptile P2, PR #7): a background token refresh for
  // the *same* admin fires onAuthStateChange with a new session object
  // (same user, new reference) — re-running the MFA check on every such
  // event reset `mfa` to "checking" and unmounted whatever this guard
  // wraps (e.g. a half-completed AdminMfaSetup enrollment) for no reason.
  it("does not re-run the MFA lookup or disrupt an in-progress challenge when the session is merely refreshed for the same user", async () => {
    getSessionMock.mockResolvedValue(session({ role: "admin" }));
    needsMfaChallengeMock.mockResolvedValue(true);
    getVerifiedTotpFactorIdMock.mockResolvedValue("factor-1");
    let onChange: ((session: unknown) => void) | undefined;
    onAuthStateChangeMock.mockImplementation((cb: typeof onChange) => {
      onChange = cb;
      return vi.fn();
    });
    renderGuard();
    await waitFor(() => screen.getByText("Enter the 6-digit code from your authenticator app."));
    expect(needsMfaChallengeMock).toHaveBeenCalledTimes(1);

    // A new session object, same user id and role — a token refresh, not a sign-in.
    onChange?.(session({ role: "admin" }));

    await waitFor(() =>
      expect(screen.getByText("Enter the 6-digit code from your authenticator app.")).toBeInTheDocument()
    );
    expect(needsMfaChallengeMock).toHaveBeenCalledTimes(1);
  });

  // Found in review (Greptile P2, PR #7): fixing the test above by
  // ignoring userId/isAdmin alone went too far the other way — completing
  // MFA in *another* tab promotes that session to aal2 and fires
  // onAuthStateChange here too, but neither value changes (same user,
  // still admin), so this tab kept showing a challenge already cleared
  // elsewhere. The real `aal` claim (decoded from the new session's own
  // access_token, not a mock) must still trigger a re-check.
  it("re-checks and clears a stale challenge when the session is promoted to aal2 in another tab", async () => {
    getSessionMock.mockResolvedValue(session({ role: "admin" }, "admin-user-1", "aal1"));
    needsMfaChallengeMock.mockResolvedValueOnce(true);
    getVerifiedTotpFactorIdMock.mockResolvedValue("factor-1");
    let onChange: ((session: unknown) => void) | undefined;
    onAuthStateChangeMock.mockImplementation((cb: typeof onChange) => {
      onChange = cb;
      return vi.fn();
    });
    renderGuard();
    await waitFor(() => screen.getByText("Enter the 6-digit code from your authenticator app."));

    // Same user, same admin role — only the aal claim differs, as if the
    // challenge had just been completed in another tab.
    needsMfaChallengeMock.mockResolvedValueOnce(false);
    onChange?.(session({ role: "admin" }, "admin-user-1", "aal2"));

    await waitFor(() => expect(screen.getByText("Protected content")).toBeInTheDocument());
    expect(needsMfaChallengeMock).toHaveBeenCalledTimes(2);
  });

  it("reacts to a later sign-out by switching to the login redirect", async () => {
    getSessionMock.mockResolvedValue(session({ role: "admin" }));
    let onChange: ((session: unknown) => void) | undefined;
    onAuthStateChangeMock.mockImplementation((cb: typeof onChange) => {
      onChange = cb;
      return vi.fn();
    });
    renderGuard();
    await waitFor(() => expect(screen.getByText("Protected content")).toBeInTheDocument());

    onChange?.(null);
    await waitFor(() => expect(screen.getByText("Login screen")).toBeInTheDocument());
  });

  it("adds a noindex meta tag while guarding, and removes it on unmount", async () => {
    getSessionMock.mockResolvedValue(session({ role: "admin" }));
    const { unmount } = renderGuard();
    await waitFor(() => expect(screen.getByText("Protected content")).toBeInTheDocument());
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");

    unmount();
    expect(document.querySelector('meta[name="robots"]')).not.toBeInTheDocument();
  });
});
