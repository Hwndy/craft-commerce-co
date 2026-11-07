import { describe, expect, it } from "vitest";

import { levelOfDetailForNode, levelOfDetailForWidth, onScreenWidth } from "./levelOfDetail";

describe("levelOfDetailForWidth", () => {
  it("is placeholder below 80px", () => {
    expect(levelOfDetailForWidth(0)).toBe("placeholder");
    expect(levelOfDetailForWidth(79.9)).toBe("placeholder");
  });

  it("is thumbnail from 80px up to 400px", () => {
    expect(levelOfDetailForWidth(80)).toBe("thumbnail");
    expect(levelOfDetailForWidth(399.9)).toBe("thumbnail");
  });

  it("is full from 400px up", () => {
    expect(levelOfDetailForWidth(400)).toBe("full");
    expect(levelOfDetailForWidth(10000)).toBe("full");
  });
});

describe("onScreenWidth", () => {
  it("scales world width by zoom", () => {
    expect(onScreenWidth(100, 2)).toBe(200);
    expect(onScreenWidth(100, 0.5)).toBe(50);
  });
});

describe("levelOfDetailForNode", () => {
  it("combines world width and zoom", () => {
    // 50 world units at zoom 1 = 50px on screen -> placeholder
    expect(levelOfDetailForNode(50, 1)).toBe("placeholder");
    // 50 world units at zoom 10 = 500px on screen -> full
    expect(levelOfDetailForNode(50, 10)).toBe("full");
  });
});
