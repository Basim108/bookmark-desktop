import type { GridCapacity, GridCell, Slot } from "./types";

/**
 * Frame capacity for the one-time conversion of positions stored as
 * `(page, row, col)` by a version that predates slots — see
 * storage/positionsMigration.ts. Used only when no new-tab page ever recorded a
 * measurement to frame that conversion on.
 *
 * It is NOT a placement default. Placement no longer consults a capacity at all
 * (see getNextFreeSlot), which is what removed the whole class of bug where the
 * service worker and the canvas had to agree on one.
 */
export const DEFAULT_GRID_CAPACITY: GridCapacity = { cols: 6, rows: 4 };

/** Cells one page holds at this capacity — the only property reflow depends on. */
export function cellsPerPage(capacity: GridCapacity): number {
  return capacity.cols * capacity.rows;
}

export function cellToSlot(cell: GridCell, capacity: GridCapacity): Slot {
  return (
    cell.page * cellsPerPage(capacity) + cell.row * capacity.cols + cell.col
  );
}

/**
 * The cell a slot occupies at this capacity. Total: every slot yields a cell
 * within the capacity's rows and cols, so no stored position can ever fail to
 * fit the current grid and there is nothing to compact or displace.
 */
export function slotToCell(slot: Slot, capacity: GridCapacity): GridCell {
  const perPage = cellsPerPage(capacity);
  const withinPage = slot % perPage;
  return {
    page: Math.floor(slot / perPage),
    row: Math.floor(withinPage / capacity.cols),
    col: withinPage % capacity.cols,
  };
}

/**
 * Lowest slot not already taken — the whole of placement.
 *
 * Deliberately capacity-free: every context that places a bookmark (a new-tab
 * page, or the background service worker handling one created by Chrome's own
 * UI or arriving via sync) computes the same answer without needing to know,
 * measure, or agree on a grid capacity.
 *
 * Fills a gap the user left before extending past the last bookmark, so the
 * arrangement's holes are reused in reading order rather than accumulating.
 */
export function getNextFreeSlot(occupied: Slot[]): Slot {
  const taken = new Set(occupied);
  let slot = 0;
  while (taken.has(slot)) {
    slot += 1;
  }
  return slot;
}
