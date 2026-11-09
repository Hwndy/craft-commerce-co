import { afterEach, describe, expect, it, vi } from "vitest";

const { getSessionMock, onAuthStateChangeMock, signInWithPasswordMock, signOutMock, resetPasswordForEmailMock, updateUserMock } =
  vi.hoisted(() => ({
    getSessionMock: vi.fn(),
    onAuthStateChangeMock: vi.fn(),
    signInWithPasswordMock: vi.fn(),
    signOutMock: vi.fn(),
    resetPasswordForEmailMock: vi.fn(),
    updateUserMock: vi.fn(),
  }));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
      onAuthStateChange: onAuthStateChangeMock,
      signInWithPassword: signInWithPasswordMock,
      signOut: signOutMock,
      resetPasswordForEmail: resetPasswordForEmailMock,
      updateUser: updateUserMock,
    },
  },
}));

import {
  getSession,
  isAdminSession,
  onAuthStateChange,
  requestPasswordReset,
  signInWithPassword,
  signOut,
  updatePassword,
} from "./auth";

function session(appMetadata: Record<string, unknown> = {}) {
  return { user: { app_metadata: appMetadata } } as never;
}

// Every mock above is shared across this whole file's tests.
afterEach(() => {
  vi.clearAllMocks();
});

describe("isAdminSession", () => {
  it("is false for a null session", () => {
    expect(isAdminSession(null)).toBe(false);
  });

  it("is false for a session with no admin role claim", () => {
    expect(isAdminSession(session())).toBe(false);
  });

  it("is false for a session with a different role claim", () => {
    expect(isAdminSession(session({ role: "editor" }))).toBe(false);
  });

  it("is true only for app_metadata.role === 'admin'", () => {
    expect(isAdminSession(session({ role: "admin" }))).toBe(true);
  });
});

describe("getSession", () => {
  it("returns the session on success", async () => {
    getSessionMock.mockResolvedValueOnce({ data: { session: session() }, error: null });
    await expect(getSession()).resolves.toEqual(session());
  });

  it("throws the real error, not a generic one", async () => {
    const error = new Error("network down");
    getSessionMock.mockResolvedValueOnce({ data: { session: null }, error });
    await expect(getSession()).rejects.toBe(error);
  });
});

describe("onAuthStateChange", () => {
  it("forwards the session to the callback and returns an unsubscribe function", () => {
    const unsubscribe = vi.fn();
    let registered: ((event: unknown, session: unknown) => void) | undefined;
    onAuthStateChangeMock.mockImplementation((cb: typeof registered) => {
      registered = cb;
      return { data: { subscription: { unsubscribe } } };
    });

    const callback = vi.fn();
    const stop = onAuthStateChange(callback);

    registered?.("SIGNED_IN", session({ role: "admin" }));
    expect(callback).toHaveBeenCalledWith(session({ role: "admin" }));

    stop();
    expect(unsubscribe).toHaveBeenCalled();
  });
});

describe("signInWithPassword", () => {
  it("returns the session on success", async () => {
    signInWithPasswordMock.mockResolvedValueOnce({ data: { session: session() }, error: null });
    await expect(signInWithPassword("a@example.com", "pw")).resolves.toEqual(session());
    expect(signInWithPasswordMock).toHaveBeenCalledWith({ email: "a@example.com", password: "pw" });
  });

  it("throws on invalid credentials", async () => {
    const error = new Error("Invalid login credentials");
    signInWithPasswordMock.mockResolvedValueOnce({ data: { session: null }, error });
    await expect(signInWithPassword("a@example.com", "wrong")).rejects.toBe(error);
  });
});

describe("signOut", () => {
  it("resolves on success", async () => {
    signOutMock.mockResolvedValueOnce({ error: null });
    await expect(signOut()).resolves.toBeUndefined();
  });

  it("throws on failure", async () => {
    const error = new Error("failed");
    signOutMock.mockResolvedValueOnce({ error });
    await expect(signOut()).rejects.toBe(error);
  });
});

describe("requestPasswordReset", () => {
  it("passes the email and redirect URL through", async () => {
    resetPasswordForEmailMock.mockResolvedValueOnce({ data: {}, error: null });
    await requestPasswordReset("a@example.com", "https://example.com/admin/reset-password");
    expect(resetPasswordForEmailMock).toHaveBeenCalledWith("a@example.com", {
      redirectTo: "https://example.com/admin/reset-password",
    });
  });
});

describe("updatePassword", () => {
  it("passes the new password through", async () => {
    updateUserMock.mockResolvedValueOnce({ data: {}, error: null });
    await updatePassword("a-new-password");
    expect(updateUserMock).toHaveBeenCalledWith({ password: "a-new-password" });
  });
});
