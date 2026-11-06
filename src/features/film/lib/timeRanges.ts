export interface Range {
  start: number;
  end: number;
}

/** TimeRanges (video.buffered) isn't array-like enough to map over directly. */
export function timeRangesToArray(ranges: TimeRanges): Range[] {
  const result: Range[] = [];
  for (let i = 0; i < ranges.length; i++) {
    result.push({ start: ranges.start(i), end: ranges.end(i) });
  }
  return result;
}
