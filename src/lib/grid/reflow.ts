import { getFolderPositions, setFolderPositions } from "../storage/positions";
import { compareCells, indexToCell } from "./placement";
import type { GridCapacity } from "./types";
import type { FolderPositions } from "../storage/schema";

/**
 * Densely repacks entries into the given capacity, preserving their
 * relative (page, row, col) order as a stable sort key. Used only for
 * column growth: growing cols increases cells-per-page, so later entries
 * shift into newly available earlier-page cells, cascading and
 * potentially collapsing trailing pages — the "column growth backfill"
 * requirement.
 *
 * This mutates stored positions, which is why it must NOT be used for
 * shrinking: per "Pinned Position Resilience Under Shrink," a bookmark's
 * stored position must never change due to a shrink — shrink-driven
 * compaction/overflow is a pure, display-only concern (see
 * lib/grid/layout.ts's paginate), not persisted here.
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
 * Whether a capacity transition is a "pure" column growth that should
 * trigger the mutating backfill repack: columns must increase, and rows
 * must not simultaneously decrease (a simultaneous row shrink is handled
 * separately, display-only, to avoid mutating positions during a shrink).
 * Row-only growth is an intentional no-op — new row cells stay empty.
 */
export function shouldReflowOnGrowth(
  oldCapacity: GridCapacity,
  newCapacity: GridCapacity,
): boolean {
  const colsGrew = newCapacity.cols > oldCapacity.cols;
  const rowsShrunk = newCapacity.rows < oldCapacity.rows;
  return colsGrew && !rowsShrunk;
}

/** Reads, repacks, and persists a folder's positions for a new (grown) capacity. */
export async function reflowFolderPositions(
  folderId: string,
  capacity: GridCapacity,
): Promise<FolderPositions> {
  const positions = await getFolderPositions(folderId);
  const repacked = repackPositions(positions, capacity);
  await setFolderPositions(folderId, repacked);
  return repacked;
}
