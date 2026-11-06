import { describe, expect, it } from "vitest";

import { timeRangesToArray } from "./timeRanges";

function fakeTimeRanges(ranges: Array<[number, number]>): TimeRanges {
  return {
    length: ranges.length,
    start: (i: number) => ranges[i][0],
    end: (i: number) => ranges[i][1],
  } as TimeRanges;
}

describe("timeRangesToArray", () => {
  it("converts an empty TimeRanges to an empty array", () => {
    expect(timeRangesToArray(fakeTimeRanges([]))).toEqual([]);
  });

  it("converts a single range", () => {
    expect(timeRangesToArray(fakeTimeRanges([[0, 12.5]]))).toEqual([{ start: 0, end: 12.5 }]);
  });

  it("converts multiple disjoint ranges, preserving order", () => {
    expect(timeRangesToArray(fakeTimeRanges([[0, 10], [20, 30]]))).toEqual([
      { start: 0, end: 10 },
      { start: 20, end: 30 },
    ]);
  });
});
