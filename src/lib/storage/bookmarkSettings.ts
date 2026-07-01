import { getStorageValue, setStorageValue } from "./local";
import { STORAGE_KEYS } from "./schema";
import type { BookmarkLabelDisplay, BookmarkSettings } from "./schema";

export const DEFAULT_BOOKMARK_SETTINGS: BookmarkSettings = {
  labelDisplay: "under-icon",
  hasCustomIcon: false,
};

async function getAllBookmarkSettings(): Promise<
  Record<string, BookmarkSettings>
> {
  const settings = await getStorageValue(STORAGE_KEYS.BOOKMARK_SETTINGS);
  return settings ?? {};
}

export async function getBookmarkSettings(
  bookmarkId: string,
): Promise<BookmarkSettings> {
  const all = await getAllBookmarkSettings();
  return all[bookmarkId] ?? DEFAULT_BOOKMARK_SETTINGS;
}

/** Sets a bookmark's label display mode (under-icon vs. tooltip-only). Independent per bookmark — no inheritance. */
export async function setBookmarkLabelDisplay(
  bookmarkId: string,
  labelDisplay: BookmarkLabelDisplay,
): Promise<void> {
  const all = await getAllBookmarkSettings();
  const current = all[bookmarkId] ?? DEFAULT_BOOKMARK_SETTINGS;
  await setStorageValue(STORAGE_KEYS.BOOKMARK_SETTINGS, {
    ...all,
    [bookmarkId]: { ...current, labelDisplay },
  });
}

/** Used when a custom icon is uploaded/removed to keep this metadata mirror in sync. */
export async function setBookmarkHasCustomIcon(
  bookmarkId: string,
  hasCustomIcon: boolean,
): Promise<void> {
  const all = await getAllBookmarkSettings();
  const current = all[bookmarkId] ?? DEFAULT_BOOKMARK_SETTINGS;
  await setStorageValue(STORAGE_KEYS.BOOKMARK_SETTINGS, {
    ...all,
    [bookmarkId]: { ...current, hasCustomIcon },
  });
}

/** Discards a bookmark's stored settings entirely, e.g. when it's removed. */
export async function removeBookmarkSettings(
  bookmarkId: string,
): Promise<void> {
  const all = await getAllBookmarkSettings();
  if (!(bookmarkId in all)) {
    return;
  }
  const { [bookmarkId]: _removed, ...rest } = all;
  await setStorageValue(STORAGE_KEYS.BOOKMARK_SETTINGS, rest);
}
