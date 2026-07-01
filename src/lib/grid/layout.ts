import type { FolderPositions } from "../storage/schema";
import type { GridCell } from "./types";

export interface LayoutCell {
  bookmarkId: string;
  cell: GridCell;
}

/**
 * Groups a folder's current stored positions into pages for rendering,
 * sorted in reading order (row-major) within each page. Purely a display
 * grouping — never mutates storage. Always returns at least one (possibly
 * empty) page so the UI has something to render.
 */
export function paginate(positions: FolderPositions): LayoutCell[][] {
  const entries: LayoutCell[] = Object.entries(positions).map(
    ([bookmarkId, cell]) => ({ bookmarkId, cell }),
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
