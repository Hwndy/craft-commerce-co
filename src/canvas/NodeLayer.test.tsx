import { render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { NodeLayer } from "./NodeLayer";
import { useCameraStore } from "./store";
import type { CanvasNode } from "./types";

function node(id: string, x: number, y: number, width = 100): CanvasNode {
  return { id, region: "test", type: "image", x, y, width, height: 100, rotation: 0, layer: 0, zoomMin: 0, zoomMax: 100 };
}

describe("NodeLayer", () => {
  beforeEach(() => {
    useCameraStore.setState({
      camera: { x: 0, y: 0, zoom: 1 },
      viewport: { width: 1000, height: 800 },
      isFlying: false,
    });
  });

  afterEach(() => {
    useCameraStore.setState({ camera: { x: 0, y: 0, zoom: 1 }, viewport: { width: 0, height: 0 } });
  });

  it("mounts only nodes near the viewport", () => {
    const nodes = [node("near", 100, 100), node("far", 100000, 100000)];
    render(<NodeLayer nodes={nodes} renderNode={(n) => <span data-testid={n.id}>{n.id}</span>} />);

    expect(screen.getByTestId("near")).toBeInTheDocument();
    expect(screen.queryByTestId("far")).not.toBeInTheDocument();
  });

  it("reports the mounted count via a data attribute", () => {
    const nodes = [node("a", 0, 0), node("b", 50, 50), node("c", 100000, 100000)];
    const { container } = render(<NodeLayer nodes={nodes} renderNode={(n) => <span>{n.id}</span>} />);

    expect(container.querySelector("[data-node-layer-count]")?.getAttribute("data-node-layer-count")).toBe("2");
  });

  it("passes the on-screen-width level of detail to renderNode", () => {
    // width 50 at zoom 1 -> 50px on screen -> "placeholder"
    const nodes = [node("small", 0, 0, 50)];
    render(
      <NodeLayer
        nodes={nodes}
        renderNode={(n, lod) => (
          <span data-testid={n.id} data-lod={lod}>
            {n.id}
          </span>
        )}
      />
    );
    expect(screen.getByTestId("small")).toHaveAttribute("data-lod", "placeholder");
  });

  it("recomputes (throttled) when the camera store changes", async () => {
    const nodes = [node("a", 20000, 0)];
    render(<NodeLayer nodes={nodes} renderNode={(n) => <span data-testid={n.id}>{n.id}</span>} throttleMs={10} />);

    expect(screen.queryByTestId("a")).not.toBeInTheDocument();

    act(() => {
      useCameraStore.getState().setCamera({ x: 20000, y: 0, zoom: 1 });
    });

    await waitFor(() => expect(screen.getByTestId("a")).toBeInTheDocument());
  });
});
