import { useEffect, useState } from "react";
import { useDndMonitor } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
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
 * Loads a folder's direct subfolders in Chrome's native order. A
 * folder-to-folder drag (see FolderTreeNode) removes the moved folder from
 * the source's list immediately (a synchronous local filter, so it's safe
 * to do optimistically); the destination picking it up relies solely on
 * the live-sync refetch below, triggered by the real chrome.bookmarks.onMoved
 * event. An earlier version also optimistically appended it to the
 * destination via an async chrome.bookmarks.get() call, racing the refetch
 * — whichever settled last won, and under a loaded CI runner the refetch
 * could occasionally resolve with stale data (Chrome's own bookmark store
 * lagging just behind the event it fires) and clobber the correct
 * optimistic state with nothing to re-trigger a retry. One writer avoids
 * the race entirely.
 */
export function useSubfolders(folderId: string): UseSubfoldersResult {
  const [state, setState] = useState<LoadedState>({
    folderId: "",
    folders: [],
  });
  const [reloadToken, setReloadToken] = useState(0);

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
  }, [folderId, reloadToken]);

  // Live sync: refetch on any bookmark/folder structure change, whether it
  // came from this extension's own UI or Chrome's native bookmark manager,
  // and whether it happened in this tab or another open one.
  useEffect(
    () =>
      subscribeToBookmarkChanges(() => setReloadToken((token) => token + 1)),
    [],
  );

  useDndMonitor({
    onDragEnd(event: DragEndEvent) {
      const activeData = event.active.data.current as
        { type?: string; sourceParentId?: string } | undefined;
      const overData = event.over?.data.current as
        { type?: string; folderId?: string } | undefined;
      if (activeData?.type !== "folder" || overData?.type !== "folder") {
        return;
      }
      if (overData.folderId === activeData.sourceParentId) {
        return;
      }
      const movedFolderId = String(event.active.id);

      if (activeData.sourceParentId === folderId) {
        setState((current) =>
          current.folderId === folderId
            ? {
                folderId,
                folders: current.folders.filter((f) => f.id !== movedFolderId),
              }
            : current,
        );
      }
    },
  });

  const loading = state.folderId !== folderId;
  return { folders: loading ? [] : state.folders, loading };
}
