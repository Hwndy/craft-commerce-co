import type { CSSProperties } from "react";

import { sealHeading, sealRays, sealTagline } from "@/content/seal";

export interface SealProps {
  centerX: number;
  centerY: number;
}

// 1.75× the first version's numbers (and content/seal.ts's ray scale,
// 0.16 → 0.28) — the owner found that version "very small compared to
// every other thing on the board" next to Gallery's own 800×600 region
// (Gallery.tsx). Every clearance already checked (farthest ray/label point
// vs. Gallery's nearest corner at world (-1200,-600), ~1341 units out)
// scales by the same uniform factor, so it still holds.
const WIDTH = 1680;
const HEIGHT = 1050;
const SEAL_IMAGE_SIZE = 280;
const WORD_PADDING = 14;

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
      {/* One ray per real region (sealRays' x/y already points in that
          region's true direction — see content/seal.ts) — real (x2,y2)
          endpoints rather than a per-ray rotate()+width pair, since each
          ray has both a different length and angle. SVG for vector
          decoration is existing precedent here (CanvasChrome's own
          minimap). */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`${-WIDTH / 2} ${-HEIGHT / 2} ${WIDTH} ${HEIGHT}`}
        aria-hidden="true"
      >
        {sealRays.map((ray) => (
          <line key={ray.label} x1={0} y1={0} x2={ray.x} y2={ray.y} stroke="rgba(21,19,15,0.25)" strokeWidth={1} />
        ))}
      </svg>

      {/* The seal mark + wordmark, dead-centre. */}
      <div
        className="absolute flex flex-col items-center gap-1"
        style={{ left: WIDTH / 2, top: HEIGHT / 2, transform: "translate(-50%, -50%)" }}
      >
        <img
          src="/videos/all_life_seal.png"
          alt=""
          className="object-contain"
          style={{ width: SEAL_IMAGE_SIZE, height: SEAL_IMAGE_SIZE }}
        />
        <span className="whitespace-nowrap font-heading text-3xl font-semibold text-shop-ink">{sealHeading}</span>
        <span className="whitespace-nowrap font-body text-sm italic text-shop-ink/70">{sealTagline}</span>
      </div>

      {/* One label per ray, starting just past its tip and flowing
          further outward (away from centre). */}
      {sealRays.map((ray) => {
        const isLeft = ray.x < 0;
        return (
          <span
            key={ray.label}
            className="absolute whitespace-nowrap font-body text-xs italic text-shop-ink/70"
            style={{
              left: WIDTH / 2 + ray.x + (isLeft ? -WORD_PADDING : WORD_PADDING),
              top: HEIGHT / 2 + ray.y,
              transform: isLeft ? "translate(-100%, -50%)" : "translate(0, -50%)",
            }}
          >
            {ray.label}
          </span>
        );
      })}
    </div>
  );
}
