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
