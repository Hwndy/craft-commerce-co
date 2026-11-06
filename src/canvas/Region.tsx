import type { CSSProperties, ReactNode } from "react";

export interface RegionProps {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  title?: string;
  children?: ReactNode;
}

/**
 * A rectangle of the world with a title and a set of nodes (docs/02-canvas-
 * spec.md §1). Phase 1 only needs it as a positioned container; semantic
 * zoom, culling and entering behaviour land in Phase 2.
 */
export function Region({ id, x, y, width, height, title, children }: RegionProps) {
  const style: CSSProperties = {
    position: "absolute",
    left: x,
    top: y,
    width,
    height,
  };

  return (
    <section
      data-region-id={id}
      aria-label={title}
      style={style}
    >
      {children}
    </section>
  );
}
