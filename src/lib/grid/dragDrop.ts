import type { LayoutCell } from "./layout";
import type { GridCell } from "./types";

export interface PositionUpdate {
  bookmarkId: string;
  cell: GridCell;
}

/**
 * Resolves what stored-position updates should result from dropping
 * `activeId` onto `targetCell`. `layout` is the folder's FULL layout across
 * all pages (not just the displayed one), so a drag that began on one page
 * and ends on another — after drag-to-edge auto-advance — still finds both
 * the dragged item and any occupant of the destination cell. A drag is
 * always authoritative: it overwrites stored position unconditionally,
 * regardless of whether the dragged or displaced item was previously
 * "pinned" or shrink-compacted (see lib/grid/layout.ts). Dropping onto an
 * empty cell just relocates the dragged item; dropping onto an occupied
 * cell swaps the two — including across pages, where the occupant inherits
 * the dragged item's original cell on its original page.
 */
export function resolveDrop(
  activeId: string,
  targetCell: GridCell,
  layout: LayoutCell[],
): PositionUpdate[] {
  const activeEntry = layout.find((e) => e.bookmarkId === activeId);
  if (!activeEntry) {
    return [];
  }

  const occupant = layout.find(
    (e) =>
      e.bookmarkId !== activeId &&
      e.cell.page === targetCell.page &&
      e.cell.row === targetCell.row &&
      e.cell.col === targetCell.col,
  );

  if (!occupant) {
    return [{ bookmarkId: activeId, cell: targetCell }];
  }

  return [
    { bookmarkId: activeId, cell: targetCell },
    { bookmarkId: occupant.bookmarkId, cell: activeEntry.cell },
  ];
}
