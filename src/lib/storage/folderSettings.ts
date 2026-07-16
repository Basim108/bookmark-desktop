import { getStorageValue, setStorageValue } from "./local";
import { STORAGE_KEYS } from "./schema";
import type { FolderSettings } from "./schema";

export const DEFAULT_FOLDER_SETTINGS: FolderSettings = {
  hasCustomIcon: false,
};

async function getAllFolderSettings(): Promise<Record<string, FolderSettings>> {
  const settings = await getStorageValue(STORAGE_KEYS.FOLDER_SETTINGS);
  return settings ?? {};
}

export async function getFolderSettings(
  folderId: string,
): Promise<FolderSettings> {
  const all = await getAllFolderSettings();
  return all[folderId] ?? DEFAULT_FOLDER_SETTINGS;
}

/** Discards a folder's stored settings entirely, e.g. when it's removed. */
export async function removeFolderSettings(folderId: string): Promise<void> {
  const all = await getAllFolderSettings();
  if (!(folderId in all)) {
    return;
  }
  const { [folderId]: _removed, ...rest } = all;
  await setStorageValue(STORAGE_KEYS.FOLDER_SETTINGS, rest);
}

/** Records whether a folder has a custom uploaded icon, so the sidebar row can pick the custom-icon key vs. the shared default-icon key without an async IndexedDB read. */
export async function setFolderHasCustomIcon(
  folderId: string,
  hasCustomIcon: boolean,
): Promise<void> {
  const all = await getAllFolderSettings();
  const current = all[folderId] ?? DEFAULT_FOLDER_SETTINGS;
  await setStorageValue(STORAGE_KEYS.FOLDER_SETTINGS, {
    ...all,
    [folderId]: { ...current, hasCustomIcon },
  });
}
