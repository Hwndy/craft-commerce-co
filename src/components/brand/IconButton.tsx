import * as React from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface IconButtonProps extends Omit<ButtonProps, "size" | "children"> {
  "aria-label": string;
  children: React.ReactNode;
  /** @default "default" — the viewer's prev/next arrows use "lg". */
  size?: "sm" | "default" | "lg";
}

const SIZE_CLASSES: Record<NonNullable<IconButtonProps["size"]>, string> = {
  sm: "h-8 w-8",
  default: "h-10 w-10",
  lg: "h-12 w-12",
};

/**
 * Round, dark-translucent icon-only button — zoom controls, Home, Close,
 * prev/next (docs/decisions.md D-45). Built on Button's own "pill-outline"
 * variant rather than a hand-rolled style, per docs/04-design-and-motion.md
 * §5 ("use shadcn primitives where they fit"). Requires aria-label since an
 * icon alone has no accessible name.
 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant = "pill-outline", size = "default", ...props }, ref) => (
    <Button
      ref={ref}
      variant={variant}
      className={cn(SIZE_CLASSES[size], "p-0", className)}
      {...props}
    />
  )
);
IconButton.displayName = "IconButton";
