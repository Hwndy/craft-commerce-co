import * as React from "react";

import { cn } from "@/lib/utils";

export interface RegionLabelProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** A small icon or thumbnail shown in the tile above the title. */
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
}

/**
 * Icon tile + title + subtitle card — the board's Gallery/Shop/About/Contact
 * quadrant cards (docs/decisions.md D-45). A plain <button> (not Card), since
 * every real use is clickable (flies the camera or navigates); non-clickable
 * display only needs the same markup without an onClick, which this still
 * supports as a disabled-looking but semantically correct button.
 */
export const RegionLabel = React.forwardRef<HTMLButtonElement, RegionLabelProps>(
  ({ className, icon, title, subtitle, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        // Thin-line, unfilled card (docs/decisions.md D-71) — was a solid
        // bg-card/80 fill; now just a border on transparent background.
        // hover:border-shop-accent-pink/60, not hover:border-primary/60
        // (docs/decisions.md D-80, client feedback 21 Nov 2026): a hover
        // border isn't text, so it doesn't need to clear 4.5:1 the way
        // CanvasChrome's text did — the accent colour is fine here as-is.
        "flex flex-col gap-3 rounded-2xl border border-white/20 bg-transparent p-4 text-left transition-colors hover:border-shop-accent-pink/60 hover:bg-white/5",
        className
      )}
      {...props}
    >
      {icon && (
        <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-black/40 text-muted-foreground [&_svg]:h-7 [&_svg]:w-7">
          {icon}
        </span>
      )}
      {children}
      <span className="flex items-baseline justify-between gap-2">
        {/* Oval thin-line border around the heading itself, per the client's
            "circular or oval shaped borders for all buttons and headings"
            (docs/decisions.md D-71). */}
        <span className="inline-block rounded-full border border-white/25 px-3 py-1 font-heading text-lg font-bold uppercase tracking-wide">
          {title}
        </span>
        {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
      </span>
    </button>
  )
);
RegionLabel.displayName = "RegionLabel";
