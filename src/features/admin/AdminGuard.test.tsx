import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionMock, onAuthStateChangeMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  onAuthStateChangeMock: vi.fn(),
}));
vi.mock("./lib/auth", async () => {
  const actual = await vi.importActual<typeof import("./lib/auth")>("./lib/auth");
  return {
    ...actual,
    getSession: getSessionMock,
    onAuthStateChange: onAuthStateChangeMock,
  };
});

import { AdminGuard } from "./AdminGuard";

function session(appMetadata: Record<string, unknown> = {}) {
  return { user: { app_metadata: appMetadata } } as never;
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
  // Every test gets this default unsubscribe-returning implementation
  // *before* its own body runs, so a test that wants its own (e.g. the
  // sign-out one, to capture the callback) can override it afterwards
  // without this clobbering that override back.
  beforeEach(() => {
    onAuthStateChangeMock.mockReturnValue(vi.fn());
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

  it("renders the protected content for an admin session", async () => {
    getSessionMock.mockResolvedValue(session({ role: "admin" }));
    renderGuard();
    await waitFor(() => expect(screen.getByText("Protected content")).toBeInTheDocument());
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
