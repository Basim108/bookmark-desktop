import { beforeEach, describe, expect, it } from "vitest";
import { installChromeMock } from "../../test/chromeMock";
import { reflowFolderPositions, repackPositions, shouldReflow } from "./reflow";
import { getFolderPositions, setFolderPositions } from "../storage/positions";
import type { FolderPositions } from "../storage/schema";

const mock = installChromeMock();

beforeEach(() => {
  mock.reset();
});

describe("shouldReflow", () => {
  it("reflows when columns increase", () => {
    expect(shouldReflow({ cols: 3, rows: 2 }, { cols: 4, rows: 2 })).toBe(true);
  });

  it("reflows when columns decrease", () => {
    expect(shouldReflow({ cols: 4, rows: 2 }, { cols: 3, rows: 2 })).toBe(true);
  });

  it("reflows when rows decrease", () => {
    expect(shouldReflow({ cols: 3, rows: 3 }, { cols: 3, rows: 2 })).toBe(true);
  });

  it("does NOT reflow when only rows increase", () => {
    expect(shouldReflow({ cols: 3, rows: 2 }, { cols: 3, rows: 3 })).toBe(
      false,
    );
  });

  it("does not reflow when capacity is unchanged", () => {
    expect(shouldReflow({ cols: 3, rows: 2 }, { cols: 3, rows: 2 })).toBe(
      false,
    );
  });
});

describe("repackPositions", () => {
  it("backfills newly available columns by pulling items from the next page, cascading", () => {
    // capacity 3x2 (perPage 6): page0 full (A-F), G/H/I/J on page1 (only
    // 3 cols fit per row at the old capacity).
    const positions: FolderPositions = {
      A: { page: 0, row: 0, col: 0 },
      B: { page: 0, row: 0, col: 1 },
      C: { page: 0, row: 0, col: 2 },
      D: { page: 0, row: 1, col: 0 },
      E: { page: 0, row: 1, col: 1 },
      F: { page: 0, row: 1, col: 2 },
      G: { page: 1, row: 0, col: 0 },
      H: { page: 1, row: 0, col: 1 },
      I: { page: 1, row: 0, col: 2 },
      J: { page: 1, row: 1, col: 0 },
    };

    // Columns grow 3 -> 4 (perPage 8): G and H should be pulled forward
    // onto page 0, while I and J cascade down but stay on page 1 (now
    // holding fewer items than before — the trailing page shrinks).
    const repacked = repackPositions(positions, { cols: 4, rows: 2 });

    expect(repacked.A).toEqual({ page: 0, row: 0, col: 0 });
    expect(repacked.G).toEqual({ page: 0, row: 1, col: 2 });
    expect(repacked.H).toEqual({ page: 0, row: 1, col: 3 });
    expect(repacked.I).toEqual({ page: 1, row: 0, col: 0 });
    expect(repacked.J).toEqual({ page: 1, row: 0, col: 1 });

    const page1Count = Object.values(repacked).filter(
      (cell) => cell.page === 1,
    ).length;
    expect(page1Count).toBe(2); // was 4 before backfill, now only I and J
  });

  it("compacts displaced items into empty cells on shrink instead of leaving gaps", () => {
    // capacity 4x2 (perPage 8), a gap at (0,1) from a removed item.
    const positions: FolderPositions = {
      A: { page: 0, row: 0, col: 0 },
      C: { page: 0, row: 0, col: 2 },
      D: { page: 0, row: 0, col: 3 },
    };

    const repacked = repackPositions(positions, { cols: 4, rows: 2 });

    // Dense repack removes the gap entirely (stable order A, C, D).
    expect(repacked.A).toEqual({ page: 0, row: 0, col: 0 });
    expect(repacked.C).toEqual({ page: 0, row: 0, col: 1 });
    expect(repacked.D).toEqual({ page: 0, row: 0, col: 2 });
  });

  it("is reversible: shrinking then growing back to the original capacity restores the original arrangement", () => {
    const original: FolderPositions = {
      A: { page: 0, row: 0, col: 0 },
      B: { page: 0, row: 0, col: 1 },
      C: { page: 0, row: 0, col: 2 },
      D: { page: 0, row: 0, col: 3 },
      E: { page: 0, row: 1, col: 0 },
      F: { page: 0, row: 1, col: 1 },
      G: { page: 0, row: 1, col: 2 },
      H: { page: 0, row: 1, col: 3 },
      I: { page: 1, row: 0, col: 0 },
      J: { page: 1, row: 0, col: 1 },
    };

    const shrunk = repackPositions(original, { cols: 3, rows: 2 });
    const grownBack = repackPositions(shrunk, { cols: 4, rows: 2 });

    expect(grownBack).toEqual(original);
  });

  it("preserves relative order even after a manual drag reorders entries", () => {
    // Simulate a manual drag: swap A and C's stored positions before repacking.
    const afterDrag: FolderPositions = {
      A: { page: 0, row: 0, col: 2 },
      B: { page: 0, row: 0, col: 1 },
      C: { page: 0, row: 0, col: 0 },
    };

    const shrunk = repackPositions(afterDrag, { cols: 2, rows: 2 });
    const grownBack = repackPositions(shrunk, { cols: 3, rows: 2 });

    expect(grownBack).toEqual(afterDrag);
  });
});

describe("reflowFolderPositions", () => {
  it("reads, repacks, and persists positions for a folder", async () => {
    await setFolderPositions("f1", {
      A: { page: 0, row: 0, col: 0 },
      B: { page: 1, row: 0, col: 0 },
    });

    const result = await reflowFolderPositions("f1", { cols: 2, rows: 2 });

    expect(result.B).toEqual({ page: 0, row: 0, col: 1 });
    expect(await getFolderPositions("f1")).toEqual(result);
  });
});
