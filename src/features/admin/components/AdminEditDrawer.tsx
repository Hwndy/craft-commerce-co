import type { ReactNode } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export interface AdminEditDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * T3's edit-drawer pattern — a thin wrapper over the existing ui/sheet.tsx
 * primitive, following the same open/onOpenChange/side convention
 * navigation.tsx's mobile menu already uses (the one real precedent for
 * Sheet in this app). No form or mutation logic here: each of T5–T9's
 * own edit drawers supplies its real react-hook-form + Zod content as
 * children, and its own Save/Cancel actions as footer.
 */
export function AdminEditDrawer({ open, onOpenChange, title, description, children, footer }: AdminEditDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && <SheetFooter>{footer}</SheetFooter>}
      </SheetContent>
    </Sheet>
  );
}
