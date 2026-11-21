import type { CSSProperties } from "react";

import { sealHeading } from "@/content/seal";

export interface SealProps {
  centerX: number;
  centerY: number;
}

// Kept from the D-81 1.75× size fix (owner found the mark "very small
// compared to every other thing on the board") — only the rays/labels are
// gone (owner: "remove those arrows and the description... I would show
// you a description of how I want those arrows to be" — a future,
// owner-specified design, not guessed at here).
const SCALE = 1.75;
const SEAL_IMAGE_SIZE = 160 * SCALE;
const HEADING_FONT_SIZE = 30 * SCALE; // text-3xl
const STACK_GAP = 4 * SCALE; // gap-1

// Just large enough to comfortably hold the mark + wordmark with margin —
// unlike the previous ray-pointing version, nothing here needs to reach a
// specific world distance, so this is cosmetic, not load-bearing.
const WIDTH = 600;
const HEIGHT = 600;

/**
 * The board's centre seal (docs/decisions.md D-81) — the "middle spot"
 * docs/decisions.md D-71 Step 9 promised but never built. Purely
 * decorative and non-interactive (confirmed directly with the owner): the
 * existing Home button/keyboard "0" shortcut already fly here (and now
 * centre on it — D-81 also added "landing" to CENTERED_REGION_KEYS), so
 * this adds nothing to navigate, only something to look at.
 *
 * Deliberately does NOT reuse <Region> — Region bakes in an aria-label
 * landmark, correct for real content (Contact, Gallery) but wrong here: an
 * unlabelled "region" with nothing in it for a screen reader is exactly
 * what axe's landmark checks exist to catch. aria-hidden on the root
 * removes the whole subtree from the accessibility tree instead, and
 * pointer-events stays off throughout — matching the owner's "not
 * clickable" answer. data-board-seal is this component's own position
 * test hook, playing the role <Region>'s data-region-id plays for its own
 * consumers (Contact.test.tsx's pattern).
 */
export function Seal({ centerX, centerY }: SealProps) {
  const rootStyle: CSSProperties = {
    position: "absolute",
    left: centerX - WIDTH / 2,
    top: centerY - HEIGHT / 2,
    width: WIDTH,
    height: HEIGHT,
  };

  return (
    <div data-board-seal aria-hidden="true" className="pointer-events-none" style={rootStyle}>
      <div
        className="absolute flex flex-col items-center"
        style={{ left: WIDTH / 2, top: HEIGHT / 2, transform: "translate(-50%, -50%)", gap: STACK_GAP }}
      >
        <img
          src="/videos/all_life_seal.png"
          alt=""
          className="object-contain"
          style={{ width: SEAL_IMAGE_SIZE, height: SEAL_IMAGE_SIZE }}
        />
        <span
          className="whitespace-nowrap font-heading font-semibold text-shop-ink"
          style={{ fontSize: HEADING_FONT_SIZE }}
        >
          {sealHeading}
        </span>
      </div>
    </div>
  );
}
