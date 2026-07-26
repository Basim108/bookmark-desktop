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
    // width:  (1000 - 16) usable, (984 + 8) / (80 + 8) = 11.27 -> 11 cols
    // height: (500 - 16) usable, (484 + 8) / (80 + 8) = 5.59 -> 5 rows
    expect(computeGridCapacity(1000, 500, 80, 8, 8)).toEqual({
      cols: 11,
      rows: 5,
    });
  });

  it("counts the gap between cells, not just the cells", () => {
    // Without the gaps, 984 usable px would fit floor(984/80) = 12 columns,
    // which is exactly the over-count that clipped the right-most column.
    expect(computeGridCapacity(1000, 500, 80, 8, 8).cols).toBe(11);
    expect(computeGridCapacity(1000, 500, 80, 0, 8).cols).toBe(12);
  });

  it("counts the grid's padding on both sides", () => {
    expect(computeGridCapacity(1000, 500, 80, 8, 0).cols).toBe(11);
    // 24px of padding a side drops usable width below an 11th cell's share.
    expect(computeGridCapacity(1000, 500, 80, 8, 24).cols).toBe(10);
  });

  it("fits 9 columns in the width that previously clipped a 10th", () => {
    // The reported case: 1918px window, 240px sidebar -> 1678px canvas at the
    // 166px tier. The old floor(1678 / 166) = 10 needed 1748px to render.
    const { cols } = computeGridCapacity(1678, 958, 166, 8, 8);
    expect(cols).toBe(9);
    // What that many cells actually consume must fit the canvas.
    expect(cols * 166 + (cols - 1) * 8 + 2 * 8).toBeLessThanOrEqual(1678);
  });

  it("fits an exact number of cells when the space divides evenly", () => {
    // 3 cells + 2 gaps + 2 padding = 3*166 + 2*8 + 16 = 530
    expect(computeGridCapacity(530, 530, 166, 8, 8)).toEqual({
      cols: 3,
      rows: 3,
    });
    // One pixel short of that must not round up to a clipped 3rd cell.
    expect(computeGridCapacity(529, 529, 166, 8, 8)).toEqual({
      cols: 2,
      rows: 2,
    });
  });

  it("derives rows from height exactly as it derives columns from width", () => {
    const square = computeGridCapacity(700, 700, 106, 8, 8);
    expect(square.rows).toBe(square.cols);
  });

  it("never returns fewer than 1 column or row", () => {
    expect(computeGridCapacity(10, 10, 100, 8, 8)).toEqual({
      cols: 1,
      rows: 1,
    });
    // Padding alone exceeding the available space must not go negative.
    expect(computeGridCapacity(0, 0, 100, 8, 8)).toEqual({ cols: 1, rows: 1 });
  });
});
