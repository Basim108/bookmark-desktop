import { getStorageValue, setStorageValue } from "./local";
import { STORAGE_KEYS } from "./schema";
import type { FolderSettings, FolderSidebarDisplay } from "./schema";

export const DEFAULT_FOLDER_SETTINGS: FolderSettings = {
  sidebarDisplay: "label-only",
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

/**
 * Resolves what should actually be rendered for a folder's sidebar row,
 * clamping to "label-only" if the stored setting requests an icon the
 * folder doesn't currently have (e.g. a custom icon was later removed).
 * Folders have no favicon-equivalent fallback, so there's no icon to show
 * without an explicit upload.
 */
export function resolveFolderDisplay(
  settings: FolderSettings,
): FolderSidebarDisplay {
  if (!settings.hasCustomIcon && settings.sidebarDisplay !== "label-only") {
    return "label-only";
  }
  return settings.sidebarDisplay;
}

/**
 * Sets a folder's sidebar display mode. Rejects icon-involving modes when
 * the folder has no custom icon, since there's nothing to render.
 */
export async function setFolderSidebarDisplay(
  folderId: string,
  display: FolderSidebarDisplay,
): Promise<void> {
  const all = await getAllFolderSettings();
  const current = all[folderId] ?? DEFAULT_FOLDER_SETTINGS;
  if (!current.hasCustomIcon && display !== "label-only") {
    throw new Error(
      `Folder ${folderId} has no custom icon; only "label-only" is available.`,
    );
  }
  await setStorageValue(STORAGE_KEYS.FOLDER_SETTINGS, {
    ...all,
    [folderId]: { ...current, sidebarDisplay: display },
  });
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

/** Used by Group 7 when a custom icon is uploaded/removed to keep this metadata mirror in sync. */
export async function setFolderHasCustomIcon(
  folderId: string,
  hasCustomIcon: boolean,
): Promise<void> {
  const all = await getAllFolderSettings();
  const current = all[folderId] ?? DEFAULT_FOLDER_SETTINGS;
  const next: FolderSettings = {
    ...current,
    hasCustomIcon,
    sidebarDisplay: hasCustomIcon ? current.sidebarDisplay : "label-only",
  };
  await setStorageValue(STORAGE_KEYS.FOLDER_SETTINGS, {
    ...all,
    [folderId]: next,
  });
}
