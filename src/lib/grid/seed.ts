import { getBookmarksInFolder } from "../bookmarks/read";
import { withPositionsLock } from "../concurrency/positionsLock";
import { getMeasuredGridCapacity } from "../storage/gridCapacity";
import {
  getFolderPositionsUnlocked,
  setFolderPositionsUnlocked,
} from "../storage/positions";
import { DEFAULT_GRID_CAPACITY, getNextFreeCell } from "./placement";
import type { GridCapacity } from "./types";
import type { FolderPositions } from "../storage/schema";

/**
 * Ensures every bookmark currently in a folder has a stored position,
 * assigning missing ones to the next free cell in Chrome's bookmark order.
 * This is the "first run" seed for a folder the extension has never laid
 * out before, and also transparently backfills any bookmark that somehow
 * ended up without a position (belt-and-braces alongside the event
 * listeners in bookmarks/events.ts).
 *
 * Chrome's order is used only to pick a deterministic processing order
 * for items that are all simultaneously missing a position; it is never
 * consulted for bookmarks that already have one.
 */
export async function backfillFolderPositions(
  folderId: string,
  capacity?: GridCapacity,
): Promise<FolderPositions> {
  // A new-tab page passes the capacity it just measured. Callers that cannot
  // measure one — the service worker's onImportEnded backfill — omit it and get
  // the last measurement any page published, falling back to the bootstrap
  // capacity only when no page has ever rendered. Resolved before the lock:
  // Web Locks are not reentrant and the critical section should stay short.
  const resolved =
    capacity ?? (await getMeasuredGridCapacity()) ?? DEFAULT_GRID_CAPACITY;
  // Read and write inside one lock acquisition. This writes the folder's whole
  // map, so a snapshot taken before the lock could discard placements the
  // background worker committed while this was computing — the bug that left
  // bookmarks stranded with no position.
  return withPositionsLock(async () => {
    const [bookmarks, existing] = await Promise.all([
      getBookmarksInFolder(folderId),
      getFolderPositionsUnlocked(folderId),
    ]);

    const unpositioned = bookmarks.filter(
      (bookmark) => !(bookmark.id in existing),
    );
    if (unpositioned.length === 0) {
      return existing;
    }

    const positions: FolderPositions = { ...existing };
    const occupied = Object.values(positions);
    for (const bookmark of unpositioned) {
      const cell = getNextFreeCell(occupied, resolved);
      positions[bookmark.id] = cell;
      occupied.push(cell);
    }

    await setFolderPositionsUnlocked(folderId, positions);
    return positions;
  });
}
