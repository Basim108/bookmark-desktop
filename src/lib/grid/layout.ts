import { cellToIndex, compareCells, indexToCell } from "./placement";
import type { FolderPositions } from "../storage/schema";
import type { GridCapacity, GridCell } from "./types";

export interface LayoutCell {
  bookmarkId: string;
  cell: GridCell;
}

function fitsCapacity(cell: GridCell, capacity: GridCapacity): boolean {
  return cell.row < capacity.rows && cell.col < capacity.cols;
}

/**
 * Groups a folder's current stored positions into pages for rendering.
 * Purely a display computation — NEVER mutates storage, and never should:
 * per "Pinned Position Resilience Under Shrink," an item whose stored
 * cell no longer fits the current capacity must be displayed elsewhere
 * (compacted into an empty cell, cascading to later pages) without its
 * stored position ever changing, so it reappears exactly where it was
 * once capacity allows it to fit again.
 *
 * Displaced items are assigned the lowest free display index in reading
 * order, which naturally prefers same-page gaps before spilling to a
 * later page — the "compact first, cascade second" rule, applied purely
 * at render time.
 */
export function paginate(
  positions: FolderPositions,
  capacity: GridCapacity,
): LayoutCell[][] {
  const entries: LayoutCell[] = Object.entries(positions).map(
    ([bookmarkId, cell]) => ({ bookmarkId, cell }),
  );

  const fitting: LayoutCell[] = [];
  const displaced: LayoutCell[] = [];
  for (const entry of entries) {
    (fitsCapacity(entry.cell, capacity) ? fitting : displaced).push(entry);
  }
  displaced.sort((a, b) => compareCells(a.cell, b.cell));

  const occupiedIndexes = new Set(
    fitting.map((entry) => cellToIndex(entry.cell, capacity)),
  );
  const displayEntries: LayoutCell[] = [...fitting];
  for (const entry of displaced) {
    let index = 0;
    while (occupiedIndexes.has(index)) {
      index += 1;
    }
    occupiedIndexes.add(index);
    displayEntries.push({
      bookmarkId: entry.bookmarkId,
      cell: indexToCell(index, capacity),
    });
  }

  const pageCount = displayEntries.reduce(
    (max, entry) => Math.max(max, entry.cell.page + 1),
    1,
  );

  const pages: LayoutCell[][] = Array.from({ length: pageCount }, () => []);
  for (const entry of displayEntries) {
    pages[entry.cell.page]?.push(entry);
  }
  for (const page of pages) {
    page.sort((a, b) => a.cell.row - b.cell.row || a.cell.col - b.cell.col);
  }

  return pages;
}
