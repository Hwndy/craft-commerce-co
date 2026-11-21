/**
 * Static content for the board's centre seal (docs/decisions.md D-81) — a
 * typed stand-in, same precedent as contact.ts.
 *
 * `sealRays` points toward the board's own 4 real navigable regions
 * (owner's own instruction: "the arrows around the seal should only be for
 * the 4 places available currently" — not the reference mockup's 12
 * abstract mood words). Each ray's (x,y) is the real gallery/collage/
 * shop-wall/contact viewpoint coordinate (src/canvas/viewpoints.ts)
 * scaled down (×0.28) so it reaches a sensible distance from the seal
 * without crowding those regions' own cards — same direction, not an
 * arbitrary angle, so each arrow genuinely points toward its place.
 *
 * ×0.28, not the first version's ×0.16: the owner found the first version
 * read as "very small compared to every other thing on the board" once
 * seen live on a real device — confirmed by comparing against Gallery's
 * own 800×600 region (src/pages/Gallery.tsx), next to which the original
 * 160px seal image barely registered. 0.28 is 1.75× the original 0.16,
 * the same uniform factor Seal.tsx scales its image size and bounding box
 * by, so every proportion/clearance already checked for the first version
 * holds exactly, just bigger.
 */
export interface SealRay {
  label: string;
  x: number;
  y: number;
}

export const sealHeading = "ALL LIFE";
export const sealTagline = "light entering from darkness";

export const sealRays: SealRay[] = [
  { label: "Gallery", x: -560, y: -336 }, // gallery viewpoint (-2000,-1200) × 0.28
  { label: "Collage", x: 560, y: -336 }, // collage viewpoint (2000,-1200) × 0.28
  { label: "The Shop", x: 560, y: 336 }, // shop-wall viewpoint (2000,1200) × 0.28
  { label: "Contact", x: -560, y: 336 }, // contact viewpoint (-2000,1200) × 0.28
];
