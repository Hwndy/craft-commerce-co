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

  // Always renumbers the whole list by its new array position, not just
  // the two swapped rows' own values — see the function's own doc
  // comment for why a plain two-value swap isn't safe in general (found
  // in review, CodeRabbit, PR #38, across two rounds of follow-up).
  it("renumbers the whole list by new position, moving up", () => {
    expect(reorderSwap(products, "b", "up")).toEqual([
      { id: "b", sortOrder: 0 },
      { id: "a", sortOrder: 1 },
      { id: "c", sortOrder: 2 },
    ]);
  });

  it("renumbers the whole list by new position, moving down", () => {
    expect(reorderSwap(products, "b", "down")).toEqual([
      { id: "a", sortOrder: 0 },
      { id: "c", sortOrder: 1 },
      { id: "b", sortOrder: 2 },
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

  it("breaks a tie between the swapped pair", () => {
    const tied = [product("a", 0), product("b", 0), product("c", 2)];
    expect(reorderSwap(tied, "b", "up")).toEqual([
      { id: "b", sortOrder: 0 },
      { id: "a", sortOrder: 1 },
      { id: "c", sortOrder: 2 },
    ]);
  });

  it("breaks a tie further down a longer list", () => {
    const tied = [product("a", 0), product("b", 1), product("c", 5), product("d", 5)];
    expect(reorderSwap(tied, "d", "up")).toEqual([
      { id: "a", sortOrder: 0 },
      { id: "b", sortOrder: 1 },
      { id: "d", sortOrder: 2 },
      { id: "c", sortOrder: 3 },
    ]);
  });

  // CodeRabbit's own follow-up example: a plain swap of just the two
  // moved rows' values can land on a THIRD row's existing rank even when
  // the swapped pair's own values already differ — (b,0) (c,0) (a,1),
  // moving "c" down would swap c→1/a→0, giving "a" the same rank 0 "b"
  // already has, a tie the swap itself creates between a row it never
  // touched and one it did. Always renumbering by position avoids this
  // whole class of case rather than special-casing it.
  it("doesn't create a new tie with a third row when the swapped pair's own values already differ", () => {
    const ranked = [product("b", 0), product("c", 0), product("a", 1)];
    expect(reorderSwap(ranked, "c", "down")).toEqual([
      { id: "b", sortOrder: 0 },
      { id: "a", sortOrder: 1 },
      { id: "c", sortOrder: 2 },
    ]);
  });
});
