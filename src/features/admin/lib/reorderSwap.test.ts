import { describe, expect, it } from "vitest";

import { reorderSwap, type Sortable } from "./reorderSwap";

function item(id: string, sortOrder: number): Sortable {
  return { id, sortOrder };
}

describe("reorderSwap", () => {
  const items = [item("a", 0), item("b", 1), item("c", 2)];

  it("renumbers the whole list by new position, moving up", () => {
    expect(reorderSwap(items, "b", "up")).toEqual([
      { id: "b", sortOrder: 0 },
      { id: "a", sortOrder: 1 },
      { id: "c", sortOrder: 2 },
    ]);
  });

  it("renumbers the whole list by new position, moving down", () => {
    expect(reorderSwap(items, "b", "down")).toEqual([
      { id: "a", sortOrder: 0 },
      { id: "c", sortOrder: 1 },
      { id: "b", sortOrder: 2 },
    ]);
  });

  it("returns null moving the first item up", () => {
    expect(reorderSwap(items, "a", "up")).toBeNull();
  });

  it("returns null moving the last item down", () => {
    expect(reorderSwap(items, "c", "down")).toBeNull();
  });

  it("returns null for an id that isn't in the list", () => {
    expect(reorderSwap(items, "missing", "up")).toBeNull();
  });

  it("breaks a tie between the swapped pair", () => {
    const tied = [item("a", 0), item("b", 0), item("c", 2)];
    expect(reorderSwap(tied, "b", "up")).toEqual([
      { id: "b", sortOrder: 0 },
      { id: "a", sortOrder: 1 },
      { id: "c", sortOrder: 2 },
    ]);
  });

  it("breaks a tie further down a longer list", () => {
    const tied = [item("a", 0), item("b", 1), item("c", 5), item("d", 5)];
    expect(reorderSwap(tied, "d", "up")).toEqual([
      { id: "a", sortOrder: 0 },
      { id: "b", sortOrder: 1 },
      { id: "d", sortOrder: 2 },
      { id: "c", sortOrder: 3 },
    ]);
  });

  it("doesn't create a new tie with a third row when the swapped pair's own values already differ", () => {
    const ranked = [item("b", 0), item("c", 0), item("a", 1)];
    expect(reorderSwap(ranked, "c", "down")).toEqual([
      { id: "b", sortOrder: 0 },
      { id: "a", sortOrder: 1 },
      { id: "c", sortOrder: 2 },
    ]);
  });
});
