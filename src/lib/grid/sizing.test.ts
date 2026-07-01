import { describe, expect, it } from "vitest";
import {
  computeAutoCapacity,
  computeAutoIconSize,
  computeFixedIconSize,
} from "./sizing";

describe("computeAutoCapacity", () => {
  it("fits as many columns/rows as possible at the minimum icon size", () => {
    // 1000/48 = 20.8 -> 20 cols; 500/48 = 10.4 -> 10 rows
    expect(computeAutoCapacity(1000, 500, 48)).toEqual({ cols: 20, rows: 10 });
  });

  it("never returns fewer than 1 column or row", () => {
    expect(computeAutoCapacity(10, 10, 500)).toEqual({ cols: 1, rows: 1 });
  });
});

describe("computeAutoIconSize", () => {
  it("stretches icons to fill available space when below max", () => {
    // 480 / 6 cols = 80px, below max of 96 -> icons grow to fill
    const size = computeAutoIconSize(480, 320, { cols: 6, rows: 4 }, 96);
    expect(size).toBe(80);
  });

  it("caps icon size at maxIconSize, leaving slack space", () => {
    // 1200 / 6 cols = 200px, way above max -> capped at 96
    const size = computeAutoIconSize(1200, 400, { cols: 6, rows: 4 }, 96);
    expect(size).toBe(96);
  });

  it("is limited by the tighter of width-per-col and height-per-row", () => {
    // width allows 100/col, height allows 50/row -> capped by height
    const size = computeAutoIconSize(600, 200, { cols: 6, rows: 4 }, 96);
    expect(size).toBe(50);
  });
});

describe("computeFixedIconSize", () => {
  it("scales icon size to fit a fixed cell count", () => {
    const result = computeFixedIconSize(480, 320, { cols: 6, rows: 4 }, 32, 96);
    expect(result).toEqual({ iconSize: 80, needsScroll: false });
  });

  it("clamps at maxIconSize when there is excess space", () => {
    const result = computeFixedIconSize(
      1200,
      800,
      { cols: 6, rows: 4 },
      32,
      96,
    );
    expect(result).toEqual({ iconSize: 96, needsScroll: false });
  });

  it("stops shrinking at minIconSize and flags scroll instead", () => {
    // natural fit = 100/6 ≈ 16.7px, below the 32px floor
    const result = computeFixedIconSize(100, 100, { cols: 6, rows: 4 }, 32, 96);
    expect(result.iconSize).toBe(32);
    expect(result.needsScroll).toBe(true);
  });
});
