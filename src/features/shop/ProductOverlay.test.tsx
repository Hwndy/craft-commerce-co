import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { env } from "@/lib/env";
import { siteMediaUrl } from "@/lib/storage";

import type { ProductDetail, ProductMedia } from "./lib/queries";
import { ProductOverlay } from "./ProductOverlay";

// EnquiryForm (T5) has its own dedicated test file — stubbed here so these
// tests only assert ProductOverlay's own job: which props it hands over,
// and when it shows the form instead of the buy actions.
vi.mock("@/features/enquiry/components/EnquiryForm", () => ({
  EnquiryForm: ({ productId, productName }: { productId?: string; productName?: string }) => (
    <div data-testid="enquiry-form-stub">
      enquiry form for {productId} / {productName}
    </div>
  ),
}));

const exitFullscreenIfActive = vi.fn().mockResolvedValue(undefined);
vi.mock("@/features/film/lib/fullscreen", () => ({
  exitFullscreenIfActive: (...args: unknown[]) => exitFullscreenIfActive(...args),
}));

// The real attachHls() points the <video> at a fake master.m3u8 path —
// jsdom can't load it, so it fires a real error immediately, which the
// video effect's own onFatalError handler reads as "this video is broken"
// and flips back to the picture view before any assertion can run. Mocked
// here the same way exitFullscreenIfActive is, since these tests only need
// to know the overlay *asked* to show the video, not that real HLS
// playback succeeded (that's attachHls's own test file's job).
const attachHls = vi.fn().mockReturnValue({ destroy: vi.fn() });
vi.mock("@/features/film/lib/hls", () => ({
  attachHls: (...args: unknown[]) => attachHls(...args),
}));

function media(overrides: Partial<ProductMedia> = {}): ProductMedia {
  return {
    id: "media-1",
    width: 1200,
    height: 1200,
    blurDataUrl: null,
    renditions: { "1280": "products/p1/media-1/1280.webp" },
    storagePath: "products/p1/media-1",
    hlsMaster: null,
    ...overrides,
  };
}

function product(overrides: Partial<ProductDetail> = {}): ProductDetail {
  return {
    id: "product-1",
    slug: "sample-belt-no-5",
    name: "Sample Belt No.5",
    priceAmount: 40,
    priceCurrency: "GBP",
    description: "Black tyre belt with aluminium buckle.",
    bullets: ["Belt made from repurposed bike tyre", "Buckle sand-cast using discarded aluminium"],
    status: "available",
    zone: "floor",
    onSale: false,
    poster: media(),
    pictures: [media()],
    video: null,
    ...overrides,
  };
}

describe("ProductOverlay", () => {
  it("renders nothing when no slug is open", () => {
    const { container } = render(<ProductOverlay slug={null} product={null} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  // A real, reproducible e2e finding: a Dialog portaled to body can't be
  // clicked at all while the browser is genuinely in Fullscreen-API mode
  // on some other element (FilmStage's stageRef) — fullscreen content sits
  // in the browser's top layer, above everything else regardless of CSS
  // z-index. FilmStage no longer requests fullscreen for an already-
  // unlocked visit, but this guards the still-possible race (fullscreen
  // mid-exit after Continue) defensively, rather than trusting timing.
  it("proactively exits any lingering fullscreen state when it opens", () => {
    render(<ProductOverlay slug="sample-belt-no-5" product={undefined} onClose={vi.fn()} />);
    expect(exitFullscreenIfActive).toHaveBeenCalled();
  });

  it("shows a loading state (with its own accessible title) while the product query is still in flight", () => {
    render(<ProductOverlay slug="sample-belt-no-5" product={undefined} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows a not-available state for a slug with no published product", () => {
    render(<ProductOverlay slug="stale-link" product={null} onClose={vi.fn()} />);
    expect(screen.getByText("This item isn't available")).toBeInTheDocument();
  });

  it("shows the product's name, price, status, bullets and story text", () => {
    render(<ProductOverlay slug="sample-belt-no-5" product={product()} onClose={vi.fn()} />);
    expect(screen.getByText("Sample Belt No.5")).toBeInTheDocument();
    expect(screen.getByText("£40.00")).toBeInTheDocument();
    expect(screen.getByText("Available")).toBeInTheDocument();
    expect(screen.getByText("Belt made from repurposed bike tyre")).toBeInTheDocument();
    expect(screen.getByText("Black tyre belt with aluminium buckle.")).toBeInTheDocument();
  });

  it("shows a Sale badge when onSale is true", () => {
    render(<ProductOverlay slug="sample-belt-no-5" product={product({ onSale: true })} onClose={vi.fn()} />);
    expect(screen.getByText("Sale")).toBeInTheDocument();
  });

  // FR-4.3: the toggle only makes sense once there's something to toggle
  // to — a product with no video is exactly today's real seeded content
  // (docs/decisions.md D-51), so this is the common case, not an edge one.
  it("does not offer a Pictures/Video toggle when the product has no video", () => {
    render(<ProductOverlay slug="sample-belt-no-5" product={product()} onClose={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Video" })).not.toBeInTheDocument();
  });

  it("offers the Pictures/Video toggle when the product has a video with a real source", () => {
    render(
      <ProductOverlay
        slug="sample-belt-no-5"
        product={product({ video: media({ id: "video-1", hlsMaster: "products/p1/video-1/master.m3u8" }) })}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Pictures" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Video" })).toBeInTheDocument();
  });

  // docs/decisions.md D-71, client feedback Step 7: a simple per-card mute
  // toggle, muted by default to match the autoplay policy every browser
  // already requires.
  describe("video mute toggle", () => {
    function renderWithVideo() {
      return render(
        <ProductOverlay
          slug="sample-belt-no-5"
          product={product({ video: media({ id: "video-1", hlsMaster: "products/p1/video-1/master.m3u8" }) })}
          onClose={vi.fn()}
        />
      );
    }

    it("is not offered until the Video tab is actually showing", () => {
      renderWithVideo();
      expect(screen.queryByRole("button", { name: /^(Mute|Unmute)$/ })).not.toBeInTheDocument();
    });

    it("starts muted, and toggling it unmutes the real video element", () => {
      renderWithVideo();
      fireEvent.click(screen.getByRole("button", { name: "Video" }));

      const video = document.querySelector("video") as HTMLVideoElement;
      expect(video.muted).toBe(true);
      expect(screen.getByRole("button", { name: "Unmute" })).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Unmute" }));
      expect(video.muted).toBe(false);
      expect(screen.getByRole("button", { name: "Mute" })).toBeInTheDocument();
    });
  });

  // The owner's own walkthrough (docs/decisions.md D-62): "what we show is
  // the still image and then when they click on it the video now starts
  // playing" — clicking the picture itself switches to the video, not just
  // the Pictures/Video pills (kept additive alongside those).
  it("clicking the picture switches to the turntable video, when one exists", () => {
    // Found in review (Greptile, PR #5): the earlier version of this test
    // only checked that a <video> element appeared — it would still pass
    // if the effect stopped actually attaching the stream or calling
    // play(). Mocking play() (jsdom's own doesn't return a Promise — see
    // ProductOverlay.tsx's own ?.catch() comment) lets this assert both.
    const playSpy = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    attachHls.mockClear();

    render(
      <ProductOverlay
        slug="sample-belt-no-5"
        product={product({ video: media({ id: "video-1", hlsMaster: "products/p1/video-1/master.m3u8" }) })}
        onClose={vi.fn()}
      />
    );

    expect(document.querySelector("video")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Play the turntable video" }));

    const video = document.querySelector("video");
    expect(video).toBeInTheDocument();
    expect(attachHls).toHaveBeenCalledWith(
      video,
      siteMediaUrl("products/p1/video-1/master.m3u8"),
      expect.anything()
    );
    expect(playSpy).toHaveBeenCalled();

    playSpy.mockRestore();
  });

  // Found in review (Phase 4 T4): the upload pipeline uploads product
  // videos as a direct MP4/WebM file, never HLS — this is the fallback
  // path that plays one, alongside the existing HLS one above.
  it("plays a direct video file (no hls_master) by setting video.src directly, without calling attachHls", () => {
    const playSpy = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    attachHls.mockClear();

    render(
      <ProductOverlay
        slug="sample-belt-no-5"
        product={product({
          video: media({ id: "video-1", hlsMaster: null, storagePath: "products/p1/video-1/video.mp4" }),
        })}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Play the turntable video" }));

    const video = document.querySelector("video");
    expect(video).toBeInTheDocument();
    expect(video?.getAttribute("src")).toBe(siteMediaUrl("products/p1/video-1/video.mp4"));
    expect(attachHls).not.toHaveBeenCalled();
    expect(playSpy).toHaveBeenCalled();

    playSpy.mockRestore();
  });

  // Found in review (CodeRabbit, PR #11): removeAttribute() alone doesn't
  // abort an in-flight download — pause()+load() does (the HTML spec's
  // "resource selection algorithm"), the same reset the native-HLS path
  // already gets via hls.js's own destroy().
  it("pauses and reloads the element when switching away from a direct-file video, aborting any in-flight download", () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    const loadSpy = vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});

    const { rerender } = render(
      <ProductOverlay
        slug="sample-belt-no-5"
        product={product({
          video: media({ id: "video-1", hlsMaster: null, storagePath: "products/p1/video-1/video.mp4" }),
        })}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Play the turntable video" }));
    expect(document.querySelector("video")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pictures" }));
    rerender(
      <ProductOverlay
        slug="sample-belt-no-5"
        product={product({
          video: media({ id: "video-1", hlsMaster: null, storagePath: "products/p1/video-1/video.mp4" }),
        })}
        onClose={vi.fn()}
      />
    );

    expect(pauseSpy).toHaveBeenCalled();
    expect(loadSpy).toHaveBeenCalled();

    pauseSpy.mockRestore();
    loadSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("calls onClose when the close button is activated", async () => {
    const onClose = vi.fn();
    const { getByLabelText } = render(
      <ProductOverlay slug="sample-belt-no-5" product={product()} onClose={onClose} />
    );
    getByLabelText("Close").click();
    expect(onClose).toHaveBeenCalled();
  });

  // T4 (FR-5.1): purchase by email.
  describe("purchase actions", () => {
    it("the Buy / Enquire link opens a mailto: to the owner's address with this product's details", () => {
      render(<ProductOverlay slug="sample-belt-no-5" product={product()} onClose={vi.fn()} />);
      const link = screen.getByRole("link", { name: "Buy / Enquire" });
      const href = link.getAttribute("href")!;
      expect(href.startsWith(`mailto:${env.VITE_OWNER_EMAIL}?`)).toBe(true);
      expect(decodeURIComponent(href)).toContain("Sample Belt No.5");
      expect(decodeURIComponent(href)).toContain("£40.00");
    });

    it("surfaces a 'Length: …' bullet as the mailto body's Size line", () => {
      render(
        <ProductOverlay
          slug="sample-belt-no-5"
          product={product({ bullets: ["Length: 124cm / 49in"] })}
          onClose={vi.fn()}
        />
      );
      const href = screen.getByRole("link", { name: "Buy / Enquire" }).getAttribute("href")!;
      expect(decodeURIComponent(href)).toContain("Size: 124cm / 49in");
    });

    it("copies the owner's email address when 'Copy email address' is activated", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });

      render(<ProductOverlay slug="sample-belt-no-5" product={product()} onClose={vi.fn()} />);
      screen.getByRole("button", { name: "Copy email address" }).click();

      expect(writeText).toHaveBeenCalledWith(env.VITE_OWNER_EMAIL);
    });

    // docs/decisions.md D-71, client feedback: removed for the in-stock
    // case — mailto is the sole path there now, no form fallback button.
    it("doesn't offer a form fallback for an in-stock product — mailto is the only path", () => {
      render(<ProductOverlay slug="sample-belt-no-5" product={product()} onClose={vi.fn()} />);
      expect(screen.queryByRole("button", { name: "Use the form instead" })).not.toBeInTheDocument();
      expect(screen.queryByTestId("enquiry-form-stub")).not.toBeInTheDocument();
    });

    // C3 (phases/PHASE-3-shop-and-enquiry.md): sold products don't offer
    // Buy at all — there's no mailto equivalent for "ask about something
    // similar", so this is the one case EnquiryForm is still wired here.
    it("a sold product shows 'Ask about something similar' instead of Buy / Enquire, and still opens the form", () => {
      render(<ProductOverlay slug="sample-belt-no-5" product={product({ status: "sold" })} onClose={vi.fn()} />);

      expect(screen.queryByRole("link", { name: "Buy / Enquire" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Use the form instead" })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Ask about something similar" }));
      expect(screen.getByTestId("enquiry-form-stub")).toHaveTextContent("enquiry form for product-1 / Sample Belt No.5");

      fireEvent.click(screen.getByRole("button", { name: "← Back" }));
      expect(screen.queryByTestId("enquiry-form-stub")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Ask about something similar" })).toBeInTheDocument();
    });

    it("a made-to-order product still offers Buy / Enquire", () => {
      render(<ProductOverlay slug="sample-belt-no-5" product={product({ status: "made_to_order" })} onClose={vi.fn()} />);
      expect(screen.getByRole("link", { name: "Buy / Enquire" })).toBeInTheDocument();
    });
  });
});
