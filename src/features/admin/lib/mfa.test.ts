import { afterEach, describe, expect, it, vi } from "vitest";

const {
  getAuthenticatorAssuranceLevelMock,
  listFactorsMock,
  enrollMock,
  challengeMock,
  verifyMock,
} = vi.hoisted(() => ({
  getAuthenticatorAssuranceLevelMock: vi.fn(),
  listFactorsMock: vi.fn(),
  enrollMock: vi.fn(),
  challengeMock: vi.fn(),
  verifyMock: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      mfa: {
        getAuthenticatorAssuranceLevel: getAuthenticatorAssuranceLevelMock,
        listFactors: listFactorsMock,
        enroll: enrollMock,
        challenge: challengeMock,
        verify: verifyMock,
      },
    },
  },
}));

import {
  challengeAndVerifySignIn,
  enrollTotp,
  getVerifiedTotpFactorId,
  hasVerifiedTotpFactor,
  needsMfaChallenge,
  verifyEnrollment,
} from "./mfa";

// Each hoisted mock above is shared across every test in this file, and
// several tests assert "was/wasn't called" — without this, an earlier
// test's call count would silently leak into a later one.
afterEach(() => {
  vi.clearAllMocks();
});

describe("needsMfaChallenge", () => {
  it("is true when the next level is aal2 and the current level isn't there yet", async () => {
    getAuthenticatorAssuranceLevelMock.mockResolvedValueOnce({
      data: { currentLevel: "aal1", nextLevel: "aal2" },
      error: null,
    });
    await expect(needsMfaChallenge()).resolves.toBe(true);
  });

  it("is false when no factor is enrolled (next level stays aal1)", async () => {
    getAuthenticatorAssuranceLevelMock.mockResolvedValueOnce({
      data: { currentLevel: "aal1", nextLevel: "aal1" },
      error: null,
    });
    await expect(needsMfaChallenge()).resolves.toBe(false);
  });

  it("is false once the session has already completed the challenge this sign-in", async () => {
    getAuthenticatorAssuranceLevelMock.mockResolvedValueOnce({
      data: { currentLevel: "aal2", nextLevel: "aal2" },
      error: null,
    });
    await expect(needsMfaChallenge()).resolves.toBe(false);
  });
});

describe("hasVerifiedTotpFactor", () => {
  it("is true when at least one totp factor is verified", async () => {
    listFactorsMock.mockResolvedValueOnce({
      data: { totp: [{ id: "f1", status: "unverified" }, { id: "f2", status: "verified" }] },
      error: null,
    });
    await expect(hasVerifiedTotpFactor()).resolves.toBe(true);
  });

  it("is false when no factor is verified yet", async () => {
    listFactorsMock.mockResolvedValueOnce({
      data: { totp: [{ id: "f1", status: "unverified" }] },
      error: null,
    });
    await expect(hasVerifiedTotpFactor()).resolves.toBe(false);
  });

  it("is false with no factors at all", async () => {
    listFactorsMock.mockResolvedValueOnce({ data: { totp: [] }, error: null });
    await expect(hasVerifiedTotpFactor()).resolves.toBe(false);
  });
});

describe("getVerifiedTotpFactorId", () => {
  it("returns the verified factor's id", async () => {
    listFactorsMock.mockResolvedValueOnce({
      data: { totp: [{ id: "f1", status: "unverified" }, { id: "f2", status: "verified" }] },
      error: null,
    });
    await expect(getVerifiedTotpFactorId()).resolves.toBe("f2");
  });

  it("returns null when none is verified", async () => {
    listFactorsMock.mockResolvedValueOnce({ data: { totp: [] }, error: null });
    await expect(getVerifiedTotpFactorId()).resolves.toBeNull();
  });
});

describe("enrollTotp", () => {
  it("returns the factor id, QR code and secret from a fresh enrollment", async () => {
    enrollMock.mockResolvedValueOnce({
      data: { id: "f1", totp: { qr_code: "<svg></svg>", secret: "SECRET123" } },
      error: null,
    });
    await expect(enrollTotp()).resolves.toEqual({
      factorId: "f1",
      qrCodeSvg: "<svg></svg>",
      secret: "SECRET123",
    });
    expect(enrollMock).toHaveBeenCalledWith({ factorType: "totp" });
  });
});

describe("verifyEnrollment", () => {
  it("challenges then verifies with the same challenge id", async () => {
    challengeMock.mockResolvedValueOnce({ data: { id: "c1" }, error: null });
    verifyMock.mockResolvedValueOnce({ data: {}, error: null });

    await verifyEnrollment("f1", "123456");

    expect(challengeMock).toHaveBeenCalledWith({ factorId: "f1" });
    expect(verifyMock).toHaveBeenCalledWith({ factorId: "f1", challengeId: "c1", code: "123456" });
  });

  it("throws on an incorrect code instead of silently succeeding", async () => {
    challengeMock.mockResolvedValueOnce({ data: { id: "c1" }, error: null });
    const error = new Error("Invalid TOTP code");
    verifyMock.mockResolvedValueOnce({ data: null, error });

    await expect(verifyEnrollment("f1", "000000")).rejects.toBe(error);
  });

  it("throws if the challenge step itself fails, without ever calling verify", async () => {
    const error = new Error("rate limited");
    challengeMock.mockResolvedValueOnce({ data: null, error });

    await expect(verifyEnrollment("f1", "123456")).rejects.toBe(error);
    expect(verifyMock).not.toHaveBeenCalled();
  });
});

describe("challengeAndVerifySignIn", () => {
  it("challenges then verifies with the same challenge id", async () => {
    challengeMock.mockResolvedValueOnce({ data: { id: "c2" }, error: null });
    verifyMock.mockResolvedValueOnce({ data: {}, error: null });

    await challengeAndVerifySignIn("f2", "654321");

    expect(challengeMock).toHaveBeenCalledWith({ factorId: "f2" });
    expect(verifyMock).toHaveBeenCalledWith({ factorId: "f2", challengeId: "c2", code: "654321" });
  });
});
