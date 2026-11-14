import { FileText, Image, LayoutGrid, Mail, Package, type LucideIcon } from "lucide-react";

export interface AdminNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

/**
 * The single source of truth for the admin shell's navigation — T3's own
 * "sections Products, Photos, Pages, Layout, Enquiries" list. AdminShell
 * maps this once for both the desktop sidebar and the mobile bottom nav,
 * rather than duplicating the five entries in two places.
 */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/photos", label: "Photos", icon: Image },
  { to: "/admin/pages", label: "Pages", icon: FileText },
  { to: "/admin/layout", label: "Layout", icon: LayoutGrid },
  { to: "/admin/enquiries", label: "Enquiries", icon: Mail },
];
