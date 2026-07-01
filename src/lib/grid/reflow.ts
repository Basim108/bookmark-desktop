import { getFolderPositions, setFolderPositions } from "../storage/positions";
import { indexToCell } from "./placement";
import type { GridCapacity, GridCell } from "./types";
import type { FolderPositions } from "../storage/schema";

function compareCells(a: GridCell, b: GridCell): number {
  return a.page - b.page || a.row - b.row || a.col - b.col;
}

/**
 * Densely repacks entries into the given capacity, preserving their
 * relative (page, row, col) order as a stable sort key. This is the one
 * algorithm behind three spec requirements at once:
 *  - column growth backfill: growing cols increases cells-per-page, so
 *    later entries shift into newly available earlier-page cells,
 *    cascading and potentially collapsing trailing pages.
 *  - shrink compaction/cascade: a dense repack has zero gaps by
 *    construction, which is the strongest form of "compact first, cascade
 *    to the next page only once a page is full."
 *  - resuming exact positions: because the sort key is the *current*
 *    stored (page, row, col) and repacking preserves relative order,
 *    repacking into a capacity that's later restored exactly reproduces
 *    the pre-shrink arrangement, with no special-casing needed.
 * Row-only growth deliberately does not call this (see shouldReflow) —
 * the spec wants new row cells left empty, not backfilled.
 */
export function repackPositions(
  positions: FolderPositions,
  capacity: GridCapacity,
): FolderPositions {
  const sorted = Object.entries(positions).sort(([, a], [, b]) =>
    compareCells(a, b),
  );
  const repacked: FolderPositions = {};
  sorted.forEach(([bookmarkId], index) => {
    repacked[bookmarkId] = indexToCell(index, capacity);
  });
  return repacked;
}

/**
 * Whether a capacity transition warrants running the reflow (repack)
 * algorithm. Column count changing in either direction reflows (backfill
 * on growth, compaction on shrink); rows only reflow on shrink — row-only
 * growth is an intentional no-op that leaves new cells empty.
 */
export function shouldReflow(
  oldCapacity: GridCapacity,
  newCapacity: GridCapacity,
): boolean {
  const colsChanged = oldCapacity.cols !== newCapacity.cols;
  const rowsDecreased = newCapacity.rows < oldCapacity.rows;
  return colsChanged || rowsDecreased;
}

/** Reads, repacks, and persists a folder's positions for a new capacity. */
export async function reflowFolderPositions(
  folderId: string,
  capacity: GridCapacity,
): Promise<FolderPositions> {
  const positions = await getFolderPositions(folderId);
  const repacked = repackPositions(positions, capacity);
  await setFolderPositions(folderId, repacked);
  return repacked;
}
