import type { GridCapacity, GridCell } from "./types";

/**
 * Default capacity used until Group 4 wires in per-folder resolved grid
 * settings (auto/fixed mode + inheritance chain). See design.md open
 * questions.
 */
export const DEFAULT_GRID_CAPACITY: GridCapacity = { cols: 6, rows: 4 };

export function cellToIndex(cell: GridCell, capacity: GridCapacity): number {
  const perPage = capacity.cols * capacity.rows;
  return cell.page * perPage + cell.row * capacity.cols + cell.col;
}

export function indexToCell(index: number, capacity: GridCapacity): GridCell {
  const perPage = capacity.cols * capacity.rows;
  const page = Math.floor(index / perPage);
  const withinPage = index % perPage;
  const row = Math.floor(withinPage / capacity.cols);
  const col = withinPage % capacity.cols;
  return { page, row, col };
}

/** Reading-order comparator: page, then row, then col. */
export function compareCells(a: GridCell, b: GridCell): number {
  return a.page - b.page || a.row - b.row || a.col - b.col;
}

/**
 * Finds the lowest-index empty cell given the currently occupied cells.
 * Occupied cells may come from any page/row/col combination (including
 * cells that don't fit the current capacity, e.g. pinned overflow items);
 * those still block their linear index from being reused.
 */
export function getNextFreeCell(
  occupied: GridCell[],
  capacity: GridCapacity,
): GridCell {
  const occupiedIndexes = new Set(
    occupied.map((cell) => cellToIndex(cell, capacity)),
  );
  let index = 0;
  while (occupiedIndexes.has(index)) {
    index += 1;
  }
  return indexToCell(index, capacity);
}
