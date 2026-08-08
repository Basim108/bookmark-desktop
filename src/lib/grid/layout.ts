import { slotToCell } from "./placement";
import type { FolderPositions } from "../storage/schema";
import type { GridCapacity, GridCell } from "./types";

export interface LayoutCell {
  bookmarkId: string;
  cell: GridCell;
}

/**
 * Groups a folder's stored slots into pages for rendering.
 *
 * Purely a display computation — NEVER mutates storage, and never should: a
 * window resize changes where things are drawn, not where they are stored, so
 * returning the window to any size it has been at redisplays the arrangement
 * exactly. That is the whole guarantee, and it holds by arithmetic rather than
 * by remembering anything.
 *
 * Reflow is a relabeling of the slot sequence, so it depends only on how many
 * cells a page holds — never on which dimension changed. Gaining cells pulls
 * later slots forward and can collapse a trailing page; losing them pushes
 * slots back and can add one. An unassigned slot is displayed as an empty cell
 * and keeps its place in the sequence: a gap the user left is part of the
 * arrangement, not slack to remove.
 *
 * There is no "does it fit" test here. slotToCell is total, so no stored
 * position can fail to fit the current grid, and there is nothing to displace
 * or compact.
 */
export function paginate(
  positions: FolderPositions,
  capacity: GridCapacity,
): LayoutCell[][] {
  const entries: LayoutCell[] = Object.entries(positions).map(
    ([bookmarkId, slot]) => ({ bookmarkId, cell: slotToCell(slot, capacity) }),
  );

  const pageCount = entries.reduce(
    (max, entry) => Math.max(max, entry.cell.page + 1),
    1,
  );

  const pages: LayoutCell[][] = Array.from({ length: pageCount }, () => []);
  for (const entry of entries) {
    pages[entry.cell.page]?.push(entry);
  }
  for (const page of pages) {
    page.sort((a, b) => a.cell.row - b.cell.row || a.cell.col - b.cell.col);
  }

  return pages;
}
