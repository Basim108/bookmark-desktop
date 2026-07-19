import type { GridCell } from "../grid/types";
import { getStorageValue, setStorageValue } from "./local";
import { STORAGE_KEYS } from "./schema";
import type { FolderPositions } from "./schema";

export async function getAllPositions(): Promise<
  Record<string, FolderPositions>
> {
  const positions = await getStorageValue(STORAGE_KEYS.POSITIONS);
  return positions ?? {};
}

export async function getFolderPositions(
  folderId: string,
): Promise<FolderPositions> {
  const all = await getAllPositions();
  return all[folderId] ?? {};
}

export async function setFolderPositions(
  folderId: string,
  positions: FolderPositions,
): Promise<void> {
  const all = await getAllPositions();
  await setStorageValue(STORAGE_KEYS.POSITIONS, {
    ...all,
    [folderId]: positions,
  });
}

/**
 * Writes the complete positions map, replacing whatever was stored rather than
 * merging into it (contrast setFolderPositions, which spreads into the existing
 * map). Exists for the state-transfer import: a replace-import deletes the whole
 * tree under a lock that suspends the per-item removal cleanup, so the importer
 * must leave this store holding exactly the entries it wrote — anything merged
 * over would strand the replaced tree's positions with no way to reclaim them.
 */
export async function replaceAllPositions(
  positions: Record<string, FolderPositions>,
): Promise<void> {
  await setStorageValue(STORAGE_KEYS.POSITIONS, positions);
}

export async function setBookmarkPosition(
  folderId: string,
  bookmarkId: string,
  cell: GridCell,
): Promise<void> {
  const folderPositions = await getFolderPositions(folderId);
  await setFolderPositions(folderId, {
    ...folderPositions,
    [bookmarkId]: cell,
  });
}

/**
 * Applies multiple position updates in one read-modify-write. Required
 * for anything that changes more than one bookmark's position at once
 * (e.g. a drag-and-drop swap) — applying such updates via separate
 * setBookmarkPosition calls races two independent read-modify-writes
 * against the same storage key, and the second call's write can clobber
 * the first's change since it started from a stale snapshot.
 */
export async function setBookmarkPositions(
  folderId: string,
  updates: { bookmarkId: string; cell: GridCell }[],
): Promise<void> {
  const folderPositions = await getFolderPositions(folderId);
  const next = { ...folderPositions };
  for (const update of updates) {
    next[update.bookmarkId] = update.cell;
  }
  await setFolderPositions(folderId, next);
}

export async function removeBookmarkPosition(
  folderId: string,
  bookmarkId: string,
): Promise<void> {
  const folderPositions = await getFolderPositions(folderId);
  if (!(bookmarkId in folderPositions)) {
    return;
  }
  const { [bookmarkId]: _removed, ...rest } = folderPositions;
  await setFolderPositions(folderId, rest);
}
