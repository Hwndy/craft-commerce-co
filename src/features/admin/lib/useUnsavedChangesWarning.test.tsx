import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useUnsavedChangesWarning } from "./useUnsavedChangesWarning";

function withRouter({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={["/admin/products"]}>
      <Routes>
        <Route path="/admin/products" element={<>{children}</>} />
        <Route path="/admin/photos" element={<div>Photos page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("useUnsavedChangesWarning", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("beforeunload", () => {
    beforeEach(() => {
      vi.spyOn(window, "addEventListener");
      vi.spyOn(window, "removeEventListener");
    });

    it("wires a beforeunload handler while dirty, and clears it once clean", () => {
      const { rerender } = renderHook(({ isDirty }) => useUnsavedChangesWarning(isDirty), {
        wrapper: withRouter,
        initialProps: { isDirty: true },
      });

      expect(window.addEventListener).toHaveBeenCalledWith("beforeunload", expect.any(Function));

      rerender({ isDirty: false });
      expect(window.removeEventListener).toHaveBeenCalledWith("beforeunload", expect.any(Function));
    });
  });

  describe("confirmIfDirty / guardedNavigate", () => {
    it("navigates immediately with no confirm prompt when not dirty", () => {
      const confirmSpy = vi.spyOn(window, "confirm");
      const { result } = renderHook(() => useUnsavedChangesWarning(false), { wrapper: withRouter });

      act(() => result.current.guardedNavigate("/admin/photos"));

      expect(confirmSpy).not.toHaveBeenCalled();
    });

    it("blocks navigation when dirty and the owner cancels the confirm", () => {
      vi.spyOn(window, "confirm").mockReturnValue(false);
      const { result } = renderHook(() => useUnsavedChangesWarning(true), { wrapper: withRouter });

      expect(result.current.confirmIfDirty()).toBe(false);
    });

    it("allows navigation when dirty and the owner accepts the confirm", () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);
      const { result } = renderHook(() => useUnsavedChangesWarning(true), { wrapper: withRouter });

      expect(result.current.confirmIfDirty()).toBe(true);
    });
  });
});
