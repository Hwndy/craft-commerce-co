import { describe, expect, it } from "vitest";

import { ADMIN_NAV_ITEMS } from "./adminNav";

describe("ADMIN_NAV_ITEMS", () => {
  it("has exactly the five sections the brief names, each with a route and an icon", () => {
    expect(ADMIN_NAV_ITEMS).toHaveLength(5);
    expect(ADMIN_NAV_ITEMS.map((item) => item.label)).toEqual([
      "Products",
      "Photos",
      "Pages",
      "Layout",
      "Enquiries",
    ]);
    expect(ADMIN_NAV_ITEMS.map((item) => item.to)).toEqual([
      "/admin/products",
      "/admin/photos",
      "/admin/pages",
      "/admin/layout",
      "/admin/enquiries",
    ]);
    for (const item of ADMIN_NAV_ITEMS) {
      expect(item.icon).toBeDefined();
    }
  });

  it("has no duplicate routes or labels", () => {
    const routes = ADMIN_NAV_ITEMS.map((item) => item.to);
    const labels = ADMIN_NAV_ITEMS.map((item) => item.label);
    expect(new Set(routes).size).toBe(routes.length);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
