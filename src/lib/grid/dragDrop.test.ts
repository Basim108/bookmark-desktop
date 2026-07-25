import { describe, expect, it } from "vitest";
import { resolveDrop } from "./dragDrop";
import type { LayoutCell } from "./layout";

const page: LayoutCell[] = [
  { bookmarkId: "a", cell: { page: 0, row: 0, col: 0 } },
  { bookmarkId: "b", cell: { page: 0, row: 0, col: 1 } },
];

describe("resolveDrop", () => {
  it("relocates the dragged item when the target cell is empty", () => {
    const updates = resolveDrop("a", { page: 0, row: 1, col: 0 }, page);
    expect(updates).toEqual([
      { bookmarkId: "a", cell: { page: 0, row: 1, col: 0 } },
    ]);
  });

  it("swaps the dragged item with whatever occupies the target cell", () => {
    const updates = resolveDrop("a", { page: 0, row: 0, col: 1 }, page);
    expect(updates).toEqual([
      { bookmarkId: "a", cell: { page: 0, row: 0, col: 1 } },
      { bookmarkId: "b", cell: { page: 0, row: 0, col: 0 } },
    ]);
  });

  it("is a no-op-equivalent single update when dropped on its own cell", () => {
    const updates = resolveDrop("a", { page: 0, row: 0, col: 0 }, page);
    expect(updates).toEqual([
      { bookmarkId: "a", cell: { page: 0, row: 0, col: 0 } },
    ]);
  });

  it("returns no updates if the dragged id isn't in the layout", () => {
    const updates = resolveDrop("missing", { page: 0, row: 0, col: 0 }, page);
    expect(updates).toEqual([]);
  });

  // The full layout spans every page, so a drag begun on one page and ended
  // on another (after a drag-to-edge auto-advance) resolves against both.
  const multiPage: LayoutCell[] = [
    { bookmarkId: "a", cell: { page: 0, row: 0, col: 0 } },
    { bookmarkId: "b", cell: { page: 1, row: 0, col: 1 } },
  ];

  it("moves the dragged item to an empty cell on a different page", () => {
    const updates = resolveDrop("a", { page: 2, row: 1, col: 3 }, multiPage);
    expect(updates).toEqual([
      { bookmarkId: "a", cell: { page: 2, row: 1, col: 3 } },
    ]);
  });

  it("swaps across pages, sending the occupant to the dragged item's origin cell", () => {
    // Drag "a" (page 0) onto "b"'s cell (page 1): "a" takes the page-1 cell,
    // "b" moves back to "a"'s original page-0 cell.
    const updates = resolveDrop("a", { page: 1, row: 0, col: 1 }, multiPage);
    expect(updates).toEqual([
      { bookmarkId: "a", cell: { page: 1, row: 0, col: 1 } },
      { bookmarkId: "b", cell: { page: 0, row: 0, col: 0 } },
    ]);
  });
});
