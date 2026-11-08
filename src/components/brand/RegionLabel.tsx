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
        "flex flex-col gap-3 rounded-2xl border border-white/10 bg-card/80 p-4 text-left transition-colors hover:border-primary/40 hover:bg-card",
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
        <span className="font-heading text-lg font-bold uppercase tracking-wide">{title}</span>
        {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
      </span>
    </button>
  )
);
RegionLabel.displayName = "RegionLabel";
