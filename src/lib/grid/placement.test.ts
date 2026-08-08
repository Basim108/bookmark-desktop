import { describe, expect, it } from "vitest";
import { cellToSlot, getNextFreeSlot, slotToCell } from "./placement";
import type { GridCapacity } from "./types";

const capacity: GridCapacity = { cols: 3, rows: 2 };

describe("cellToSlot / slotToCell", () => {
  it("round-trips the first cell of the first page", () => {
    const cell = { page: 0, row: 0, col: 0 };
    expect(cellToSlot(cell, capacity)).toBe(0);
    expect(slotToCell(0, capacity)).toEqual(cell);
  });

  it("wraps to the next row within a page", () => {
    const cell = { page: 0, row: 1, col: 2 };
    expect(cellToSlot(cell, capacity)).toBe(5);
    expect(slotToCell(5, capacity)).toEqual(cell);
  });

  it("wraps to the next page after the page is full", () => {
    const cell = { page: 1, row: 0, col: 0 };
    expect(cellToSlot(cell, capacity)).toBe(6);
    expect(slotToCell(6, capacity)).toEqual(cell);
  });

  it("is total: every slot yields a cell inside the capacity, so nothing can fail to fit", () => {
    const capacities: GridCapacity[] = [
      { cols: 1, rows: 1 },
      { cols: 3, rows: 2 },
      { cols: 8, rows: 5 },
    ];
    for (const target of capacities) {
      for (let slot = 0; slot < 200; slot += 1) {
        const cell = slotToCell(slot, target);
        expect(cell.row).toBeLessThan(target.rows);
        expect(cell.col).toBeLessThan(target.cols);
        expect(cell.row).toBeGreaterThanOrEqual(0);
        expect(cell.col).toBeGreaterThanOrEqual(0);
        expect(cell.page).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("round-trips every slot at every capacity, so a size change is reversible", () => {
    const capacities: GridCapacity[] = [
      { cols: 1, rows: 1 },
      { cols: 3, rows: 2 },
      { cols: 4, rows: 1 },
      { cols: 8, rows: 5 },
    ];
    for (const target of capacities) {
      for (let slot = 0; slot < 200; slot += 1) {
        expect(cellToSlot(slotToCell(slot, target), target)).toBe(slot);
      }
    }
  });
});

describe("getNextFreeSlot", () => {
  it("returns the first slot when nothing is occupied", () => {
    expect(getNextFreeSlot([])).toBe(0);
  });

  it("appends after a densely occupied run", () => {
    expect(getNextFreeSlot([0, 1])).toBe(2);
  });

  it("fills a gap left by a removed item instead of appending", () => {
    expect(getNextFreeSlot([0, 2])).toBe(1);
  });

  it("fills an earlier gap before extending past the last bookmark", () => {
    expect(getNextFreeSlot([0, 1, 2, 3, 5, 17])).toBe(4);
  });

  it("ignores the order occupied slots are supplied in", () => {
    expect(getNextFreeSlot([17, 2, 0, 1])).toBe(3);
  });

  it("needs no capacity, so every context agrees on the answer", () => {
    const occupied = [0, 1, 2, 3, 4, 5];
    expect(getNextFreeSlot(occupied)).toBe(6);
  });
});
