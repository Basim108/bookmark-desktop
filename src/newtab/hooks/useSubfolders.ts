import { useEffect, useState } from "react";
import { getSubfolders } from "../../lib/bookmarks/read";

interface UseSubfoldersResult {
  folders: chrome.bookmarks.BookmarkTreeNode[];
  loading: boolean;
}

interface LoadedState {
  folderId: string;
  folders: chrome.bookmarks.BookmarkTreeNode[];
}

/**
 * Loads a folder's direct subfolders in Chrome's native order. Live
 * updates on bookmark structure changes are wired in Group 9; for now
 * this fetches once per folderId.
 *
 * `loading` is derived by comparing the last-loaded folderId against the
 * requested one, rather than a separate boolean set synchronously inside
 * the effect, so the only setState call happens after the async fetch
 * resolves.
 */
export function useSubfolders(folderId: string): UseSubfoldersResult {
  const [state, setState] = useState<LoadedState>({
    folderId: "",
    folders: [],
  });

  useEffect(() => {
    let cancelled = false;
    void getSubfolders(folderId).then((result) => {
      if (!cancelled) {
        setState({ folderId, folders: result });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [folderId]);

  const loading = state.folderId !== folderId;
  return { folders: loading ? [] : state.folders, loading };
}
