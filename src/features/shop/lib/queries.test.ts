import { describe, expect, it } from "vitest";

import { mapProductRow } from "./queries";

function baseRow(overrides: Partial<Parameters<typeof mapProductRow>[0]> = {}) {
  return {
    id: "product-1",
    slug: "sample-belt-no-5",
    name: "Sample Belt No.5",
    price_amount: 40,
    price_currency: "GBP",
    description: "Black tyre belt with aluminium buckle.",
    bullets: ["Belt made from repurposed bike tyre", "Buckle sand-cast using discarded aluminium"],
    status: "available",
    zone: "floor",
    on_sale: false,
    poster_media_id: null,
    video_media_id: null,
    ...overrides,
  };
}

describe("mapProductRow", () => {
  it("maps a row with no poster to a product with poster: null", () => {
    const product = mapProductRow(baseRow(), new Map());
    expect(product).toMatchObject({
      id: "product-1",
      slug: "sample-belt-no-5",
      name: "Sample Belt No.5",
      priceAmount: 40,
      priceCurrency: "GBP",
      status: "available",
      zone: "floor",
      onSale: false,
      poster: null,
    });
    expect(product.bullets).toHaveLength(2);
  });

  it("resolves the poster from the media map by poster_media_id", () => {
    const mediaById = new Map([
      [
        "media-1",
        {
          id: "media-1",
          width: 2000,
          height: 1500,
          blur_data_url: "data:image/webp;base64,AAA",
          renditions: { "640": "products/p1/640.webp" },
          storage_path: "products/p1",
          hls_master: null,
        },
      ],
    ]);
    const product = mapProductRow(baseRow({ poster_media_id: "media-1" }), mediaById);
    expect(product.poster).toEqual({
      id: "media-1",
      width: 2000,
      height: 1500,
      blurDataUrl: "data:image/webp;base64,AAA",
      renditions: { "640": "products/p1/640.webp" },
      storagePath: "products/p1",
      hlsMaster: null,
    });
  });

  it("maps on_sale: true through to onSale", () => {
    const product = mapProductRow(baseRow({ on_sale: true }), new Map());
    expect(product.onSale).toBe(true);
  });

  it("rejects a row whose status isn't one of the three real statuses", () => {
    expect(() => mapProductRow(baseRow({ status: "discontinued" }), new Map())).toThrow();
  });

  it("rejects a row whose zone isn't 'wall' or 'floor'", () => {
    expect(() => mapProductRow(baseRow({ zone: "ceiling" }), new Map())).toThrow();
  });

  it("rejects a row whose bullets aren't an array of strings", () => {
    expect(() => mapProductRow(baseRow({ bullets: "not an array" }), new Map())).toThrow();
  });
});
