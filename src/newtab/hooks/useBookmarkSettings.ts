import { useEffect, useState } from "react";
import {
  DEFAULT_BOOKMARK_SETTINGS,
  getBookmarkSettings,
} from "../../lib/storage/bookmarkSettings";
import { onStorageKeysChanged } from "../../lib/storage/onChanged";
import { STORAGE_KEYS } from "../../lib/storage/schema";
import type { BookmarkSettings } from "../../lib/storage/schema";

/** Loads a bookmark's label-display + custom-icon settings, live-updating when changed from any open new-tab page (this one or another). */
export function useBookmarkSettings(bookmarkId: string): {
  settings: BookmarkSettings;
  reload: () => void;
  /** Bumped every reload; pass to CustomIconImage so it refetches after an upload/removal that doesn't change bookmarkId. */
  version: number;
} {
  const [settings, setSettings] = useState<BookmarkSettings>(
    DEFAULT_BOOKMARK_SETTINGS,
  );
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void getBookmarkSettings(bookmarkId).then((result) => {
      if (!cancelled) {
        setSettings(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [bookmarkId, reloadToken]);

  useEffect(
    () =>
      onStorageKeysChanged([STORAGE_KEYS.BOOKMARK_SETTINGS], () =>
        setReloadToken((token) => token + 1),
      ),
    [],
  );

  return {
    settings,
    reload: () => setReloadToken((token) => token + 1),
    version: reloadToken,
  };
}
