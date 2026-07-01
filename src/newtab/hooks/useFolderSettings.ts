import { useEffect, useState } from "react";
import {
  DEFAULT_FOLDER_SETTINGS,
  getFolderSettings,
} from "../../lib/storage/folderSettings";
import { onStorageKeysChanged } from "../../lib/storage/onChanged";
import { STORAGE_KEYS } from "../../lib/storage/schema";
import type { FolderSettings } from "../../lib/storage/schema";

/** Loads a folder's sidebar display settings, live-updating when changed from any open new-tab page (this one or another). */
export function useFolderSettings(folderId: string): {
  settings: FolderSettings;
  reload: () => void;
  /** Bumped every reload; pass to CustomIconImage so it refetches after an upload/removal that doesn't change folderId. */
  version: number;
} {
  const [settings, setSettings] = useState<FolderSettings>(
    DEFAULT_FOLDER_SETTINGS,
  );
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void getFolderSettings(folderId).then((result) => {
      if (!cancelled) {
        setSettings(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [folderId, reloadToken]);

  useEffect(
    () =>
      onStorageKeysChanged([STORAGE_KEYS.FOLDER_SETTINGS], () =>
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
