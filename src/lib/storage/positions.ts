import { withPositionsLock } from "../concurrency/positionsLock";
import type { GridCell } from "../grid/types";
import { getStorageValue, setStorageValue } from "./local";
import { STORAGE_KEYS } from "./schema";
import type { FolderPositions } from "./schema";

/**
 * Every write in this module is a read-modify-write against one storage key,
 * from two independent JS realms (background service worker + new-tab pages).
 * They are therefore serialized by withPositionsLock. Two layers exist so that
 * composite operations — ones that read, compute, and only then write (see
 * grid/seed.ts, grid/reflow.ts, bookmarks/events.ts) — can hold the lock across
 * both halves without deadlocking on a nested acquisition:
 *
 *   - `…Unlocked` primitives: no lock, ONLY safe inside a held lock.
 *   - public operations: acquire the lock exactly once, then use the primitives.
 *
 * The rule that keeps this deadlock-free: a locked function never calls another
 * locked function. Web Locks are not reentrant.
 */

/** Reads the whole positions map. Caller MUST already hold the positions lock. */
export async function readAllPositionsUnlocked(): Promise<
  Record<string, FolderPositions>
> {
  const positions = await getStorageValue(STORAGE_KEYS.POSITIONS);
  return positions ?? {};
}

/** Writes the whole positions map. Caller MUST already hold the positions lock. */
export async function writeAllPositionsUnlocked(
  all: Record<string, FolderPositions>,
): Promise<void> {
  await setStorageValue(STORAGE_KEYS.POSITIONS, all);
}

/**
 * Merges one folder's positions into the stored map. Caller MUST already hold
 * the positions lock.
 */
export async function setFolderPositionsUnlocked(
  folderId: string,
  positions: FolderPositions,
): Promise<void> {
  const all = await readAllPositionsUnlocked();
  await writeAllPositionsUnlocked({ ...all, [folderId]: positions });
}

/**
 * Reads one folder's positions. Caller MUST already hold the positions lock —
 * use this when the value read is about to be written back, so the snapshot
 * cannot go stale in between.
 */
export async function getFolderPositionsUnlocked(
  folderId: string,
): Promise<FolderPositions> {
  const all = await readAllPositionsUnlocked();
  return all[folderId] ?? {};
}

/**
 * Read-only snapshot of the whole map. Unlocked deliberately: readers that
 * never write back (rendering, export) don't need to contend for the lock.
 */
export async function getAllPositions(): Promise<
  Record<string, FolderPositions>
> {
  return readAllPositionsUnlocked();
}

/** Read-only snapshot of one folder. See getAllPositions on why this is unlocked. */
export async function getFolderPositions(
  folderId: string,
): Promise<FolderPositions> {
  return getFolderPositionsUnlocked(folderId);
}

export async function setFolderPositions(
  folderId: string,
  positions: FolderPositions,
): Promise<void> {
  await withPositionsLock(() =>
    setFolderPositionsUnlocked(folderId, positions),
  );
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
  await withPositionsLock(() => writeAllPositionsUnlocked(positions));
}

export async function setBookmarkPosition(
  folderId: string,
  bookmarkId: string,
  cell: GridCell,
): Promise<void> {
  await withPositionsLock(async () => {
    const folderPositions = await getFolderPositionsUnlocked(folderId);
    await setFolderPositionsUnlocked(folderId, {
      ...folderPositions,
      [bookmarkId]: cell,
    });
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
  await withPositionsLock(async () => {
    const folderPositions = await getFolderPositionsUnlocked(folderId);
    const next = { ...folderPositions };
    for (const update of updates) {
      next[update.bookmarkId] = update.cell;
    }
    await setFolderPositionsUnlocked(folderId, next);
  });
}

export async function removeBookmarkPosition(
  folderId: string,
  bookmarkId: string,
): Promise<void> {
  await withPositionsLock(async () => {
    const folderPositions = await getFolderPositionsUnlocked(folderId);
    if (!(bookmarkId in folderPositions)) {
      return;
    }
    const { [bookmarkId]: _removed, ...rest } = folderPositions;
    await setFolderPositionsUnlocked(folderId, rest);
  });
}
