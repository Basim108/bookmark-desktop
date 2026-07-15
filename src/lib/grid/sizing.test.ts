import { describe, expect, it } from "vitest";
import { computeGridCapacity, resolveTier } from "./sizing";

describe("resolveTier", () => {
  it("returns the 80px/0.75rem tier below the 512px breakpoint", () => {
    expect(resolveTier(0)).toEqual({ iconSize: 80, labelFontSize: "0.75rem" });
    expect(resolveTier(511)).toEqual({
      iconSize: 80,
      labelFontSize: "0.75rem",
    });
  });

  it("returns the 106px/0.85rem tier from 512px up to (not including) 1024px", () => {
    expect(resolveTier(512)).toEqual({
      iconSize: 106,
      labelFontSize: "0.85rem",
    });
    expect(resolveTier(1023)).toEqual({
      iconSize: 106,
      labelFontSize: "0.85rem",
    });
  });

  it("returns the 166px/1rem tier at 1024px and wider", () => {
    expect(resolveTier(1024)).toEqual({
      iconSize: 166,
      labelFontSize: "1rem",
    });
    expect(resolveTier(3000)).toEqual({
      iconSize: 166,
      labelFontSize: "1rem",
    });
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
