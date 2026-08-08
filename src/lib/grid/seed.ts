import { getBookmarksInFolder } from "../bookmarks/read";
import { withPositionsLock } from "../concurrency/positionsLock";
import {
  getFolderPositionsUnlocked,
  setFolderPositionsUnlocked,
} from "../storage/positions";
import { migratePositionsUnlocked } from "../storage/positionsMigration";
import { getNextFreeSlot } from "./placement";
import type { FolderPositions } from "../storage/schema";

/**
 * Ensures every bookmark currently in a folder has a stored slot, assigning
 * missing ones to the next free slot in Chrome's bookmark order. This is the
 * "first run" seed for a folder the extension has never laid out before, and
 * also transparently backfills any bookmark that somehow ended up without a
 * position (belt-and-braces alongside the event listeners in
 * bookmarks/events.ts).
 *
 * Chrome's order is used only to pick a deterministic processing order for
 * items that are all simultaneously missing a position; it is never consulted
 * for bookmarks that already have one.
 *
 * Takes no capacity: a slot is the lowest free integer, so every context
 * computes the same answer without knowing how large the grid is.
 */
export async function backfillFolderPositions(
  folderId: string,
): Promise<FolderPositions> {
  // Read and write inside one lock acquisition. This writes the folder's whole
  // map, so a snapshot taken before the lock could discard placements the
  // background worker committed while this was computing — the bug that left
  // bookmarks stranded with no position.
  return withPositionsLock(async () => {
    // First locked operation in a new-tab page, so this is where a profile
    // upgrading from cell-shaped positions is converted.
    await migratePositionsUnlocked();

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
      const slot = getNextFreeSlot(occupied);
      positions[bookmark.id] = slot;
      occupied.push(slot);
    }

    await setFolderPositionsUnlocked(folderId, positions);
    return positions;
  });
}
