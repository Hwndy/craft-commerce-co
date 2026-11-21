import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // Thin-line gold pill — "Next: Film", "Buy / Enquire by email", the
        // active Guided/Explore state (docs/decisions.md D-45, D-71: client
        // feedback asked for thin-line, unfilled circular/oval borders
        // across every button/heading, not solid filled shapes).
        pill: "rounded-full border border-primary bg-transparent text-primary hover:bg-primary/10",
        // Thin-line neutral pill — Home, List view, the inactive Guided/
        // Explore state, region-tab chips (docs/decisions.md D-45, D-71).
        "pill-outline":
          "rounded-full border border-white/40 bg-transparent text-foreground hover:bg-white/10",
        // Client feedback, 21 Nov 2026 (docs/decisions.md D-80): board-chrome
        // headings/labels should use the Shop's own already-established
        // palette instead of gold-on-black — scoped to two new variants,
        // not a rewrite of "pill"/"pill-outline" themselves, since those are
        // shared by FilmStage, the Shop's own Buy/Enquire button, Admin and
        // the enquiry form, none of which this change is meant to touch.
        // text stays shop-ink throughout, never the accent colour itself —
        // shop-accent-pink/shop-teal/shop-gold all measure under WCAG AA's
        // 4.5:1 as text on a light background (computed directly, not
        // assumed), so they're used only as borders/fills here.
        "chrome-pill":
          "rounded-full border border-shop-accent-pink bg-shop-accent-pink/10 text-shop-ink hover:bg-shop-accent-pink/20",
        "chrome-pill-outline":
          "rounded-full border border-shop-ink/30 bg-transparent text-shop-ink hover:bg-shop-ink/10",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
