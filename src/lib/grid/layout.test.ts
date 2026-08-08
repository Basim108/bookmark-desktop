import { describe, expect, it } from "vitest";
import { paginate } from "./layout";
import type { FolderPositions } from "../storage/schema";
import type { GridCapacity } from "./types";

const ample = { cols: 4, rows: 4 };

/** Page contents as bookmark ids, with unassigned slots shown as gaps. */
function render(
  positions: FolderPositions,
  capacity: GridCapacity,
): (string | null)[][] {
  const perPage = capacity.cols * capacity.rows;
  return paginate(positions, capacity).map((page) => {
    const cells: (string | null)[] = Array.from(
      { length: perPage },
      () => null,
    );
    for (const entry of page) {
      cells[entry.cell.row * capacity.cols + entry.cell.col] = entry.bookmarkId;
    }
    return cells;
  });
}

describe("paginate", () => {
  it("returns a single empty page when there are no positions", () => {
    expect(paginate({}, ample)).toEqual([[]]);
  });

  it("groups entries onto the page their slot falls on", () => {
    const pages = paginate({ a: 0, b: 16 }, ample);
    expect(pages).toHaveLength(2);
    expect(pages[0]?.map((e) => e.bookmarkId)).toEqual(["a"]);
    expect(pages[1]?.map((e) => e.bookmarkId)).toEqual(["b"]);
  });

  it("sorts entries within a page in reading order (row-major)", () => {
    const pages = paginate({ c: 2, a: 0, d: 4, b: 1 }, ample);
    expect(pages[0]?.map((e) => e.bookmarkId)).toEqual(["a", "b", "c", "d"]);
  });

  it("produces empty intermediate pages if a higher slot is referenced", () => {
    const pages = paginate({ a: 32 }, ample);
    expect(pages).toHaveLength(3);
    expect(pages[0]).toEqual([]);
    expect(pages[1]).toEqual([]);
    expect(pages[2]?.map((e) => e.bookmarkId)).toEqual(["a"]);
  });

  it("never mutates the stored positions object passed in", () => {
    const positions: FolderPositions = { a: 0, b: 17 };
    const snapshot = structuredClone(positions);
    paginate(positions, { cols: 2, rows: 2 });
    expect(positions).toEqual(snapshot);
  });

  describe("reflow depends only on cells per page", () => {
    // The worked example from the change's design.md: slot 4 is deliberately
    // unassigned, and travels with the sequence.
    const positions: FolderPositions = {
      "B1-1": 0,
      "B1-2": 1,
      "B1-3": 2,
      "B2-1": 3,
      "B2-2": 5,
    };

    it("wraps at three cells per page", () => {
      expect(render(positions, { cols: 3, rows: 1 })).toEqual([
        ["B1-1", "B1-2", "B1-3"],
        ["B2-1", null, "B2-2"],
      ]);
    });

    it("pulls the sequence forward at four cells per page", () => {
      expect(render(positions, { cols: 4, rows: 1 })).toEqual([
        ["B1-1", "B1-2", "B1-3", "B2-1"],
        [null, "B2-2", null, null],
      ]);
    });

    it("collapses the trailing page entirely at six cells per page", () => {
      expect(render(positions, { cols: 6, rows: 1 })).toEqual([
        ["B1-1", "B1-2", "B1-3", "B2-1", null, "B2-2"],
      ]);
    });

    it("treats a gained row exactly like a gained column", () => {
      // Both capacities hold six cells per page, so both must lay out the
      // sequence identically once flattened into reading order.
      const byColumns = paginate(positions, { cols: 6, rows: 1 });
      const byRows = paginate(positions, { cols: 3, rows: 2 });
      expect(byColumns).toHaveLength(1);
      expect(byRows).toHaveLength(1);
      expect(byColumns[0]?.map((e) => e.bookmarkId)).toEqual(
        byRows[0]?.map((e) => e.bookmarkId),
      );
    });
  });

  describe("stored positions survive every capacity change", () => {
    it("restores an item to its exact cell once capacity returns", () => {
      const positions: FolderPositions = { a: 0, b: 3 };
      const at4 = paginate(positions, { cols: 4, rows: 4 });

      // Any excursion in either direction, then back.
      paginate(positions, { cols: 2, rows: 2 });
      paginate(positions, { cols: 8, rows: 6 });

      expect(paginate(positions, { cols: 4, rows: 4 })).toEqual(at4);
    });

    it("round-trips every pair of capacities", () => {
      const positions: FolderPositions = { a: 0, b: 1, pinned: 17, later: 18 };
      const capacities: GridCapacity[] = [
        { cols: 1, rows: 1 },
        { cols: 3, rows: 2 },
        { cols: 6, rows: 3 },
        { cols: 8, rows: 5 },
      ];
      for (const from of capacities) {
        const before = paginate(positions, from);
        for (const via of capacities) {
          paginate(positions, via);
          expect(paginate(positions, from)).toEqual(before);
        }
      }
    });
  });

  describe("reading order is preserved at every capacity", () => {
    it("rewraps rather than scrambling when capacity is lost", () => {
      // Twelve bookmarks laid out across two rows of six, viewed at four
      // columns. The old compaction placed displaced items after items that
      // still fit, putting B5 and B6 below B7-B10.
      const positions: FolderPositions = Object.fromEntries(
        Array.from({ length: 12 }, (_, i) => [`B${i + 1}`, i]),
      );

      expect(render(positions, { cols: 4, rows: 3 })).toEqual([
        [
          "B1",
          "B2",
          "B3",
          "B4",
          "B5",
          "B6",
          "B7",
          "B8",
          "B9",
          "B10",
          "B11",
          "B12",
        ],
      ]);
    });

    it("never displays a bookmark ahead of one that precedes it in slot order", () => {
      const positions: FolderPositions = Object.fromEntries(
        Array.from({ length: 20 }, (_, i) => [`b${i}`, i * 2]),
      );
      const capacities: GridCapacity[] = [
        { cols: 1, rows: 1 },
        { cols: 3, rows: 2 },
        { cols: 5, rows: 4 },
        { cols: 9, rows: 3 },
      ];
      for (const capacity of capacities) {
        const order = paginate(positions, capacity)
          .flat()
          .map((e) => e.bookmarkId);
        expect(order).toEqual(Array.from({ length: 20 }, (_, i) => `b${i}`));
      }
    });
  });
});
