import { describe, expect, it } from "vitest";
import { cellToIndex, getNextFreeCell, indexToCell } from "./placement";
import type { GridCapacity } from "./types";

const capacity: GridCapacity = { cols: 3, rows: 2 };

describe("cellToIndex / indexToCell", () => {
  it("round-trips the first cell of the first page", () => {
    const cell = { page: 0, row: 0, col: 0 };
    expect(cellToIndex(cell, capacity)).toBe(0);
    expect(indexToCell(0, capacity)).toEqual(cell);
  });

  it("wraps to the next row within a page", () => {
    const cell = { page: 0, row: 1, col: 2 };
    expect(cellToIndex(cell, capacity)).toBe(5);
    expect(indexToCell(5, capacity)).toEqual(cell);
  });

  it("wraps to the next page after the page is full", () => {
    const cell = { page: 1, row: 0, col: 0 };
    expect(cellToIndex(cell, capacity)).toBe(6);
    expect(indexToCell(6, capacity)).toEqual(cell);
  });
});

describe("getNextFreeCell", () => {
  it("returns the first cell when nothing is occupied", () => {
    expect(getNextFreeCell([], capacity)).toEqual({
      page: 0,
      row: 0,
      col: 0,
    });
  });

  it("fills the next sequential cell in reading order", () => {
    const occupied = [
      { page: 0, row: 0, col: 0 },
      { page: 0, row: 0, col: 1 },
    ];
    expect(getNextFreeCell(occupied, capacity)).toEqual({
      page: 0,
      row: 0,
      col: 2,
    });
  });

  it("fills a gap left by a removed item instead of appending", () => {
    const occupied = [
      { page: 0, row: 0, col: 0 },
      { page: 0, row: 0, col: 2 },
    ];
    expect(getNextFreeCell(occupied, capacity)).toEqual({
      page: 0,
      row: 0,
      col: 1,
    });
  });

  it("spills onto the next page once the first page is full", () => {
    const occupied = [
      { page: 0, row: 0, col: 0 },
      { page: 0, row: 0, col: 1 },
      { page: 0, row: 0, col: 2 },
      { page: 0, row: 1, col: 0 },
      { page: 0, row: 1, col: 1 },
      { page: 0, row: 1, col: 2 },
    ];
    expect(getNextFreeCell(occupied, capacity)).toEqual({
      page: 1,
      row: 0,
      col: 0,
    });
  });

  it("does not double-place onto a cell already reserved by a pinned overflow item", () => {
    const occupied = [
      { page: 0, row: 0, col: 0 },
      { page: 0, row: 0, col: 1 },
      { page: 0, row: 0, col: 2 },
      { page: 0, row: 1, col: 0 },
      { page: 0, row: 1, col: 1 },
      { page: 0, row: 1, col: 2 },
      { page: 1, row: 0, col: 0 },
      { page: 1, row: 0, col: 1 },
      { page: 1, row: 0, col: 2 },
      { page: 1, row: 1, col: 0 },
      { page: 1, row: 1, col: 1 },
      { page: 1, row: 1, col: 2 },
      // Pinned item sitting exactly where the naive "next" slot would be.
      { page: 2, row: 0, col: 0 },
    ];
    expect(getNextFreeCell(occupied, capacity)).toEqual({
      page: 2,
      row: 0,
      col: 1,
    });
  });
});
