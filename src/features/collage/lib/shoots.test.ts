import { describe, expect, it } from "vitest";

import { distinctShoots } from "./shoots";
import type { CollagePhoto } from "./queries";

function photo(id: string, shootId: string, shootTitle: string): CollagePhoto {
  return {
    id,
    title: `Photo ${id}`,
    takenOn: null,
    shoot: { id: shootId, title: shootTitle },
    media: { id: `media-${id}`, width: null, height: null, blurDataUrl: null, renditions: {} },
  };
}

describe("distinctShoots", () => {
  it("returns no shoots for an empty photo list", () => {
    expect(distinctShoots([])).toEqual([]);
  });

  it("collapses photos from the same shoot into one entry", () => {
    const photos = [photo("1", "set-a", "Studio"), photo("2", "set-a", "Studio"), photo("3", "set-a", "Studio")];
    expect(distinctShoots(photos)).toEqual([{ id: "set-a", title: "Studio" }]);
  });

  it("lists multiple shoots in first-seen order", () => {
    const photos = [
      photo("1", "set-a", "Studio"),
      photo("2", "set-b", "On location"),
      photo("3", "set-a", "Studio"),
      photo("4", "set-c", "Workshop"),
    ];
    expect(distinctShoots(photos)).toEqual([
      { id: "set-a", title: "Studio" },
      { id: "set-b", title: "On location" },
      { id: "set-c", title: "Workshop" },
    ]);
  });
});
