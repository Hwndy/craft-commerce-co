import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { hasVerifiedTotpFactorMock, enrollTotpMock, verifyEnrollmentMock } = vi.hoisted(() => ({
  hasVerifiedTotpFactorMock: vi.fn(),
  enrollTotpMock: vi.fn(),
  verifyEnrollmentMock: vi.fn(),
}));
vi.mock("./lib/mfa", () => ({
  hasVerifiedTotpFactor: hasVerifiedTotpFactorMock,
  enrollTotp: enrollTotpMock,
  verifyEnrollment: verifyEnrollmentMock,
}));

import AdminMfaSetup from "./AdminMfaSetup";

afterEach(() => {
  vi.clearAllMocks();
});

describe("AdminMfaSetup", () => {
  it("says it's already set up, without offering to enroll again, when a factor is already verified", async () => {
    hasVerifiedTotpFactorMock.mockResolvedValueOnce(true);
    render(<AdminMfaSetup />);

    await waitFor(() =>
      expect(screen.getByText("Two-factor authentication is set up on this account.")).toBeInTheDocument()
    );
    expect(screen.queryByText("Set up two-factor authentication")).not.toBeInTheDocument();
  });

  it("starts enrollment and shows the QR code and secret", async () => {
    hasVerifiedTotpFactorMock.mockResolvedValueOnce(false);
    enrollTotpMock.mockResolvedValueOnce({
      factorId: "f1",
      qrCodeSvg: "<svg data-testid=\"qr\"></svg>",
      secret: "SECRET123",
    });
    render(<AdminMfaSetup />);

    await waitFor(() => screen.getByText("Set up two-factor authentication"));
    fireEvent.click(screen.getByText("Set up two-factor authentication"));

    await waitFor(() => expect(screen.getByTestId("qr")).toBeInTheDocument());
    expect(screen.getByText("SECRET123")).toBeInTheDocument();
  });

  it("confirms completion once the typed code verifies", async () => {
    hasVerifiedTotpFactorMock.mockResolvedValueOnce(false);
    enrollTotpMock.mockResolvedValueOnce({ factorId: "f1", qrCodeSvg: "<svg></svg>", secret: "SECRET123" });
    verifyEnrollmentMock.mockResolvedValueOnce(undefined);
    render(<AdminMfaSetup />);

    await waitFor(() => screen.getByText("Set up two-factor authentication"));
    fireEvent.click(screen.getByText("Set up two-factor authentication"));
    await waitFor(() => screen.getByText("SECRET123"));

    const hiddenInput = document.querySelector('input[inputmode="numeric"]') as HTMLInputElement;
    fireEvent.change(hiddenInput, { target: { value: "123456" } });

    await waitFor(() => expect(verifyEnrollmentMock).toHaveBeenCalledWith("f1", "123456"));
    await waitFor(() =>
      expect(screen.getByText("Two-factor authentication is set up on this account.")).toBeInTheDocument()
    );
  });

  it("shows an error and clears the code on an incorrect verification", async () => {
    hasVerifiedTotpFactorMock.mockResolvedValueOnce(false);
    enrollTotpMock.mockResolvedValueOnce({ factorId: "f1", qrCodeSvg: "<svg></svg>", secret: "SECRET123" });
    verifyEnrollmentMock.mockRejectedValueOnce(new Error("Incorrect code."));
    render(<AdminMfaSetup />);

    await waitFor(() => screen.getByText("Set up two-factor authentication"));
    fireEvent.click(screen.getByText("Set up two-factor authentication"));
    await waitFor(() => screen.getByText("SECRET123"));

    const hiddenInput = document.querySelector('input[inputmode="numeric"]') as HTMLInputElement;
    fireEvent.change(hiddenInput, { target: { value: "000000" } });

    await waitFor(() => expect(screen.getByText("Incorrect code.")).toBeInTheDocument());
    expect(screen.queryByText("Two-factor authentication is set up on this account.")).not.toBeInTheDocument();
  });
});
