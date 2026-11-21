/**
 * Static content for the board's centre seal (docs/decisions.md D-81) — a
 * typed stand-in, same precedent as contact.ts.
 *
 * `sealRays` points toward the board's own 4 real navigable regions
 * (owner's own instruction: "the arrows around the seal should only be for
 * the 4 places available currently" — not the reference mockup's 12
 * abstract mood words). Each ray's (x,y) is the real gallery/collage/
 * shop-wall/contact viewpoint coordinate (src/canvas/viewpoints.ts)
 * scaled down (×0.16) so it reaches a sensible distance from the seal
 * without crowding those regions' own cards — same direction, not an
 * arbitrary angle, so each arrow genuinely points toward its place.
 */
export interface SealRay {
  label: string;
  x: number;
  y: number;
}

export const sealHeading = "ALL LIFE";
export const sealTagline = "light entering from darkness";

export const sealRays: SealRay[] = [
  { label: "Gallery", x: -320, y: -192 }, // gallery viewpoint (-2000,-1200) × 0.16
  { label: "Collage", x: 320, y: -192 }, // collage viewpoint (2000,-1200) × 0.16
  { label: "The Shop", x: 320, y: 192 }, // shop-wall viewpoint (2000,1200) × 0.16
  { label: "Contact", x: -320, y: 192 }, // contact viewpoint (-2000,1200) × 0.16
];
