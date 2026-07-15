import { describe, expect, it } from "vitest";
import { computeGridCapacity, resolveTierIconSize } from "./sizing";

describe("resolveTierIconSize", () => {
  it("returns 80px below the 1660px breakpoint", () => {
    expect(resolveTierIconSize(0)).toBe(80);
    expect(resolveTierIconSize(1659)).toBe(80);
  });

  it("returns 106px from 1660px up to (not including) 2100px", () => {
    expect(resolveTierIconSize(1660)).toBe(106);
    expect(resolveTierIconSize(2099)).toBe(106);
  });

  it("returns 166px at 2100px and wider", () => {
    expect(resolveTierIconSize(2100)).toBe(166);
    expect(resolveTierIconSize(3000)).toBe(166);
  });
});

describe("computeGridCapacity", () => {
  it("fits as many whole cells as the available space allows", () => {
    // 1000/80 = 12.5 -> 12 cols; 500/80 = 6.25 -> 6 rows
    expect(computeGridCapacity(1000, 500, 80)).toEqual({ cols: 12, rows: 6 });
  });

  it("leaves leftover space unused rather than stretching icons", () => {
    // 400/106 = 3.77 -> 3 cols, with ~82px of unused slack
    expect(computeGridCapacity(400, 106, 106)).toEqual({ cols: 3, rows: 1 });
  });

  it("never returns fewer than 1 column or row", () => {
    expect(computeGridCapacity(10, 10, 100)).toEqual({ cols: 1, rows: 1 });
  });
});
