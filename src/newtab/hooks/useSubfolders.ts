import { useEffect, useState } from "react";
import { getSubfolders } from "../../lib/bookmarks/read";
import { subscribeToBookmarkChanges } from "../../lib/bookmarks/events";

interface UseSubfoldersResult {
  folders: chrome.bookmarks.BookmarkTreeNode[];
  loading: boolean;
}

interface LoadedState {
  folderId: string;
  folders: chrome.bookmarks.BookmarkTreeNode[];
}

/**
 * Loads a folder's direct subfolders in Chrome's native order.
 *
 * The list has exactly one writer: the live-sync refetch below, triggered by
 * real chrome.bookmarks events. No drop is ever predicted locally — not on the
 * source side of a folder move, not on the destination side.
 *
 * Both halves of that rule were learned the hard way. An early version
 * optimistically appended the moved folder to the destination via an async
 * chrome.bookmarks.get(), racing the refetch: whichever settled last won, and
 * under a loaded CI runner the refetch could resolve with stale data (Chrome's
 * own bookmark store lagging just behind the event it fires) and clobber the
 * correct state with nothing to re-trigger a retry. A later version kept a
 * synchronous optimistic *removal* on the source side, which looked safe but
 * re-derived — incompletely — a decision that resolveCrossFolderDrop was
 * already making: it dropped the row for drops the resolver rejects (onto the
 * folder itself, onto one of its own descendants), so a folder that never moved
 * vanished from the sidebar with no event coming to bring it back.
 *
 * One writer avoids both. What a drop means is decided in exactly one place
 * (resolveCrossFolderDrop, executed by App); this hook only reports what the
 * bookmark tree actually says.
 */
export function useSubfolders(folderId: string): UseSubfoldersResult {
  const [state, setState] = useState<LoadedState>({
    folderId: "",
    folders: [],
  });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void getSubfolders(folderId)
      .then((result) => {
        if (!cancelled) {
          setState({ folderId, folders: result });
        }
      })
      // The folder can be deleted out from under us — a state-transfer import
      // replaces the whole tree, or the folder is removed in Chrome's native
      // manager — leaving a stale id whose read rejects. Swallow it; a
      // resync/reload settles the view.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [folderId, reloadToken]);

  // Live sync: refetch on any bookmark/folder structure change, whether it
  // came from this extension's own UI or Chrome's native bookmark manager,
  // and whether it happened in this tab or another open one.
  useEffect(
    () =>
      subscribeToBookmarkChanges(() => setReloadToken((token) => token + 1)),
    [],
  );

  const loading = state.folderId !== folderId;
  return { folders: loading ? [] : state.folders, loading };
}
