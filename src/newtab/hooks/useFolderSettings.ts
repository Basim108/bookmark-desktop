import { useEffect, useState } from "react";
import {
  DEFAULT_FOLDER_SETTINGS,
  getFolderSettings,
} from "../../lib/storage/folderSettings";
import type { FolderSettings } from "../../lib/storage/schema";

/** Loads a folder's sidebar display settings. Live updates on setting changes are wired in Group 9. */
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

  return {
    settings,
    reload: () => setReloadToken((token) => token + 1),
    version: reloadToken,
  };
}
