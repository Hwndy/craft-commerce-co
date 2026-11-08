import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CanvasChrome } from "./CanvasChrome";
import { useCameraStore } from "./store";
import { useGuidedModeStore } from "./useGuidedModeStore";
import { clearViewpointsCache, setViewpointsCache } from "./viewpoints";

// CanvasChrome's "List view" link needs a Router context.
function renderChrome() {
  return render(
    <MemoryRouter>
      <CanvasChrome />
    </MemoryRouter>
  );
}

const viewpoints = [
  { key: "landing", label: "Landing", x: 0, y: 0, zoom: 1, sortOrder: 0, inGuidedPath: true },
  { key: "gallery", label: "Gallery", x: 2000, y: 0, zoom: 1, sortOrder: 1, inGuidedPath: true },
];

beforeEach(() => {
  setViewpointsCache(viewpoints);
  useCameraStore.setState({
    camera: { x: 0, y: 0, zoom: 1 },
    viewport: { width: 1000, height: 800 },
    isFlying: false,
  });
  useGuidedModeStore.setState({ mode: "guided", currentIndex: 0 });
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearViewpointsCache();
});

describe("CanvasChrome", () => {
  it("shows the nearest viewpoint's label", async () => {
    renderChrome();
    // Scoped to the dedicated label span — "Landing" also appears as a
    // region-tab button now (docs/decisions.md D-45), so a bare getByText
    // would be ambiguous.
    await waitFor(() =>
      expect(screen.getByText("Landing", { selector: "[data-current-region-label]" })).toBeInTheDocument()
    );
  });

  it("Home flies the camera to the landing viewpoint", async () => {
    useCameraStore.setState({ camera: { x: 2000, y: 0, zoom: 1 }, viewport: { width: 1000, height: 800 }, isFlying: false });
    renderChrome();
    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    await waitFor(() => expect(useCameraStore.getState().camera.x).toBeCloseTo(0));
  });

  it("clicking a minimap region flies the camera there", async () => {
    renderChrome();
    const minimap = screen.getByRole("img", { name: "Minimap" });
    const rects = minimap.querySelectorAll("rect");
    // First two rects are the viewpoint regions (landing, gallery); click the second.
    fireEvent.click(rects[1]);
    await waitFor(() => expect(useCameraStore.getState().camera.x).toBeCloseTo(2000));
  });

  it("toggles between Guided and Explore, keeping the camera in place on Explore", () => {
    renderChrome();
    expect(screen.getByRole("button", { name: "Guided" })).toBeInTheDocument();

    useCameraStore.getState().setCamera({ x: 555, y: 0, zoom: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Guided" }));

    expect(screen.getByRole("button", { name: "Explore" })).toBeInTheDocument();
    expect(useCameraStore.getState().camera.x).toBe(555);
    // Next/Previous and the progress indicator only show in Guided mode.
    expect(screen.queryByRole("button", { name: /^Next/ })).not.toBeInTheDocument();
  });

  it("clicking a region tab directly also syncs currentIndex, not just the camera (found in review)", async () => {
    renderChrome();
    expect(screen.getByText("1 of 2")).toBeInTheDocument();

    // The region-tabs row (hidden md:flex) renders one button per guided
    // viewpoint, labelled with the viewpoint's own label — "Gallery" here.
    fireEvent.click(screen.getByRole("button", { name: "Gallery" }));

    await waitFor(() => expect(useCameraStore.getState().camera.x).toBeCloseTo(2000));
    // Previously only the camera moved; currentIndex (and therefore
    // progress/Next) stayed wherever Guided mode last left it. Gallery is
    // the last guided stop in this fixture, so Next has nowhere further to
    // go — its own label falls back to the plain "Next", not "Next: X".
    expect(screen.getByText("2 of 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });

  it("Next advances the guided-mode progress indicator and flies forward", async () => {
    renderChrome();
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    // "Next: Gallery" (docs/decisions.md D-45) — names the real target, not a bare "Next".
    expect(screen.getByRole("button", { name: "Next: Gallery" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Next/ }));
    await waitFor(() => expect(useCameraStore.getState().camera.x).toBeCloseTo(2000));
    expect(screen.getByText("2 of 2")).toBeInTheDocument();
  });
});
