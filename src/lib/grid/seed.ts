import { getBookmarksInFolder } from "../bookmarks/read";
import { getFolderPositions, setFolderPositions } from "../storage/positions";
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
  capacity: GridCapacity = DEFAULT_GRID_CAPACITY,
): Promise<FolderPositions> {
  const [bookmarks, existing] = await Promise.all([
    getBookmarksInFolder(folderId),
    getFolderPositions(folderId),
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
    const cell = getNextFreeCell(occupied, capacity);
    positions[bookmark.id] = cell;
    occupied.push(cell);
  }

  await setFolderPositions(folderId, positions);
  return positions;
}
