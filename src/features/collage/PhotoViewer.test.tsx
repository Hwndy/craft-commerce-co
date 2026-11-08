import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PhotoViewer } from "./PhotoViewer";
import type { CollagePhoto } from "./lib/queries";

function photo(id: string, title: string, takenOn: string | null = null): CollagePhoto {
  return {
    id,
    title,
    takenOn,
    shoot: { id: "set-a", title: "Studio" },
    media: { id: `${id}-media`, width: 2000, height: 1500, blurDataUrl: null, renditions: { "1280": `p/${id}/1280.webp` } },
  };
}

const photos = [photo("a", "The first cast", "2026-03-14"), photo("b", "Finishing the buckle"), photo("c", "Third photo")];

describe("PhotoViewer", () => {
  it("renders nothing when no photo is open", () => {
    render(<PhotoViewer photos={photos} openId={null} onClose={vi.fn()} onNavigate={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders nothing for an id that isn't in the photo list", () => {
    render(<PhotoViewer photos={photos} openId="missing" onClose={vi.fn()} onNavigate={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the title and date caption for the open photo", () => {
    render(<PhotoViewer photos={photos} openId="a" onClose={vi.fn()} onNavigate={vi.fn()} />);
    expect(screen.getByText("The first cast")).toBeInTheDocument();
    expect(screen.getByText("2026-03-14")).toBeInTheDocument();
  });

  it("Close calls onClose", () => {
    const onClose = vi.fn();
    render(<PhotoViewer photos={photos} openId="a" onClose={onClose} onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("Next/Previous cycle, looping at both ends", () => {
    const onNavigate = vi.fn();
    const { rerender } = render(<PhotoViewer photos={photos} openId="c" onClose={vi.fn()} onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole("button", { name: "Next photo" }));
    expect(onNavigate).toHaveBeenLastCalledWith("a"); // last photo loops to the first

    rerender(<PhotoViewer photos={photos} openId="a" onClose={vi.fn()} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("button", { name: "Previous photo" }));
    expect(onNavigate).toHaveBeenLastCalledWith("c"); // first photo loops to the last
  });

  it("ArrowRight/ArrowLeft keys cycle too", () => {
    const onNavigate = vi.fn();
    render(<PhotoViewer photos={photos} openId="a" onClose={vi.fn()} onNavigate={onNavigate} />);

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowRight" });
    expect(onNavigate).toHaveBeenLastCalledWith("b");

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowLeft" });
    expect(onNavigate).toHaveBeenLastCalledWith("c");
  });

  it("doesn't render Next/Previous for a single-photo set", () => {
    render(<PhotoViewer photos={[photo("only", "Only photo")]} openId="only" onClose={vi.fn()} onNavigate={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Next photo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Previous photo" })).not.toBeInTheDocument();
  });

  it("tapping the image toggles the nav arrows out of the tab order and back in", () => {
    render(<PhotoViewer photos={photos} openId="a" onClose={vi.fn()} onNavigate={vi.fn()} />);
    const img = screen.getByAltText("");
    const next = screen.getByRole("button", { name: "Next photo" });
    expect(next).toHaveAttribute("tabindex", "0");

    fireEvent.click(img);
    expect(next).toHaveAttribute("tabindex", "-1");
    expect(next).toHaveAttribute("aria-hidden", "true");

    fireEvent.click(img);
    expect(next).toHaveAttribute("tabindex", "0");
    expect(next).toHaveAttribute("aria-hidden", "false");
  });

  it("filmstrip: clicking a different thumbnail navigates to it, and doesn't render for a single-photo set", () => {
    const onNavigate = vi.fn();
    const { rerender } = render(<PhotoViewer photos={photos} openId="a" onClose={vi.fn()} onNavigate={onNavigate} />);

    // The filmstrip's own thumbnail buttons aren't individually labelled
    // (decorative/aria-hidden — the real accessible navigation is Next/
    // Previous and the route itself), so they're queried by position
    // rather than role+name. Dialog content renders into a portal on
    // document.body, not the render() container.
    const thumbnails = () => document.querySelectorAll('[aria-hidden="true"] button');
    expect(thumbnails()).toHaveLength(photos.length);

    fireEvent.click(thumbnails()[2]);
    expect(onNavigate).toHaveBeenCalledWith("c");

    rerender(<PhotoViewer photos={[photo("only", "Only photo")]} openId="only" onClose={vi.fn()} onNavigate={vi.fn()} />);
    expect(thumbnails()).toHaveLength(0);
  });

  it("resets the chrome to visible when a different photo opens", () => {
    const { rerender } = render(<PhotoViewer photos={photos} openId="a" onClose={vi.fn()} onNavigate={vi.fn()} />);
    const next = screen.getByRole("button", { name: "Next photo" });
    fireEvent.click(screen.getByAltText(""));
    expect(next).toHaveAttribute("tabindex", "-1");

    rerender(<PhotoViewer photos={photos} openId="b" onClose={vi.fn()} onNavigate={vi.fn()} />);
    expect(next).toHaveAttribute("tabindex", "0");
  });
});
