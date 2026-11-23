import { describe, expect, it } from "vitest";

import {
  isUniqueViolation,
  regionForZone,
  reorderSwap,
  slugCandidate,
  slugify,
  type AdminProductRow,
} from "./adminProducts";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Sample Belt No.5")).toBe("sample-belt-no-5");
  });

  it("trims leading/trailing hyphens from punctuation at the edges", () => {
    expect(slugify("  !Belt! ")).toBe("belt");
  });

  it("collapses runs of non-alphanumeric characters into one hyphen", () => {
    expect(slugify("A -- B   C")).toBe("a-b-c");
  });

  it("returns an empty string for a name with no alphanumeric characters", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("slugCandidate", () => {
  it("attempt 0 is the bare slug", () => {
    expect(slugCandidate("sample-belt", 0)).toBe("sample-belt");
  });

  it("later attempts append a 1-indexed numeric suffix starting at -2", () => {
    expect(slugCandidate("sample-belt", 1)).toBe("sample-belt-2");
    expect(slugCandidate("sample-belt", 2)).toBe("sample-belt-3");
  });
});

describe("isUniqueViolation", () => {
  it("is true for a Postgres unique-violation error code", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
  });

  it("is false for any other error shape", () => {
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
    expect(isUniqueViolation(new Error("network error"))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });
});

describe("regionForZone", () => {
  it("maps wall to shop-wall and floor to shop-floor", () => {
    expect(regionForZone("wall")).toBe("shop-wall");
    expect(regionForZone("floor")).toBe("shop-floor");
  });
});

function product(id: string, sortOrder: number): AdminProductRow {
  return {
    id,
    slug: id,
    name: id,
    priceAmount: 40,
    priceCurrency: "GBP",
    description: null,
    bullets: [],
    status: "available",
    zone: "floor",
    onSale: false,
    sortOrder,
    posterMediaId: null,
    videoMediaId: null,
    published: true,
  };
}

describe("reorderSwap", () => {
  const products = [product("a", 0), product("b", 1), product("c", 2)];

  it("swaps sortOrder with the previous item on 'up'", () => {
    expect(reorderSwap(products, "b", "up")).toEqual([
      { id: "b", sortOrder: 0 },
      { id: "a", sortOrder: 1 },
    ]);
  });

  it("swaps sortOrder with the next item on 'down'", () => {
    expect(reorderSwap(products, "b", "down")).toEqual([
      { id: "b", sortOrder: 2 },
      { id: "c", sortOrder: 1 },
    ]);
  });

  it("returns null moving the first item up", () => {
    expect(reorderSwap(products, "a", "up")).toBeNull();
  });

  it("returns null moving the last item down", () => {
    expect(reorderSwap(products, "c", "down")).toBeNull();
  });

  it("returns null for an id that isn't in the list", () => {
    expect(reorderSwap(products, "missing", "up")).toBeNull();
  });
});
