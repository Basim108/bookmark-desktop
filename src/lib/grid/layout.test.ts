import { describe, expect, it } from "vitest";
import { paginate } from "./layout";
import type { FolderPositions } from "../storage/schema";

const ample = { cols: 4, rows: 4 };

describe("paginate", () => {
  it("returns a single empty page when there are no positions", () => {
    expect(paginate({}, ample)).toEqual([[]]);
  });

  it("groups entries onto their stored page when everything fits", () => {
    const pages = paginate(
      {
        a: { page: 0, row: 0, col: 0 },
        b: { page: 1, row: 0, col: 0 },
      },
      ample,
    );
    expect(pages).toHaveLength(2);
    expect(pages[0]?.map((e) => e.bookmarkId)).toEqual(["a"]);
    expect(pages[1]?.map((e) => e.bookmarkId)).toEqual(["b"]);
  });

  it("sorts entries within a page in reading order (row-major)", () => {
    const pages = paginate(
      {
        c: { page: 0, row: 0, col: 2 },
        a: { page: 0, row: 0, col: 0 },
        d: { page: 0, row: 1, col: 0 },
        b: { page: 0, row: 0, col: 1 },
      },
      ample,
    );
    expect(pages[0]?.map((e) => e.bookmarkId)).toEqual(["a", "b", "c", "d"]);
  });

  it("produces empty intermediate pages if a higher page number is referenced", () => {
    const pages = paginate({ a: { page: 2, row: 0, col: 0 } }, ample);
    expect(pages).toHaveLength(3);
    expect(pages[0]).toEqual([]);
    expect(pages[1]).toEqual([]);
    expect(pages[2]?.map((e) => e.bookmarkId)).toEqual(["a"]);
  });

  describe("shrink: display-only compaction (never mutates storage)", () => {
    it("compacts a displaced item into an empty cell on the same page", () => {
      const positions: FolderPositions = {
        a: { page: 0, row: 0, col: 0 },
        // b no longer fits once cols shrink to 2 (col index 2 is out of range)
        b: { page: 0, row: 0, col: 2 },
      };

      const pages = paginate(positions, { cols: 2, rows: 2 });

      // b compacts into the gap at (0, 1) instead of overflowing to a new page.
      expect(pages).toHaveLength(1);
      expect(pages[0]?.map((e) => e.bookmarkId)).toEqual(["a", "b"]);
      expect(pages[0]?.find((e) => e.bookmarkId === "b")?.cell).toEqual({
        page: 0,
        row: 0,
        col: 1,
      });

      // The input is never mutated.
      expect(positions.b).toEqual({ page: 0, row: 0, col: 2 });
    });

    it("cascades a displaced item to the next page once the current page has no gaps", () => {
      const positions: FolderPositions = {
        a: { page: 0, row: 0, col: 0 },
        b: { page: 0, row: 0, col: 1 },
        // c no longer fits at col 2 once cols shrink to 2; page 0 is full
        // (a, b), so c must cascade to page 1.
        c: { page: 0, row: 0, col: 2 },
      };

      const pages = paginate(positions, { cols: 2, rows: 1 });

      expect(pages).toHaveLength(2);
      expect(pages[0]?.map((e) => e.bookmarkId)).toEqual(["a", "b"]);
      expect(pages[1]?.map((e) => e.bookmarkId)).toEqual(["c"]);
    });

    it("never mutates the stored positions object passed in", () => {
      const positions: FolderPositions = {
        a: { page: 0, row: 0, col: 0 },
        b: { page: 0, row: 0, col: 3 },
      };
      const snapshot = structuredClone(positions);

      paginate(positions, { cols: 2, rows: 2 });

      expect(positions).toEqual(snapshot);
    });

    it("restores an item to its exact stored position once capacity grows back", () => {
      const positions: FolderPositions = {
        a: { page: 0, row: 0, col: 0 },
        b: { page: 0, row: 0, col: 3 },
      };

      // Shrink: b gets displayed elsewhere, but storage is untouched.
      paginate(positions, { cols: 2, rows: 2 });

      // Grow back to the original capacity: b displays at its true
      // stored cell again, with zero special-casing needed.
      const restored = paginate(positions, { cols: 4, rows: 4 });
      expect(restored.flat().find((e) => e.bookmarkId === "b")?.cell).toEqual({
        page: 0,
        row: 0,
        col: 3,
      });
    });
  });
});
