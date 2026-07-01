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
 * Loads a folder's direct subfolders in Chrome's native order, kept live
 * across a folder-to-folder drag (see FolderTreeNode) by optimistically
 * patching the affected side(s) locally on drop rather than waiting for a
 * reload — full cross-tab structure sync is wired in Group 9.
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

      if (overData.folderId === folderId) {
        void chrome.bookmarks.get(movedFolderId).then(([node]) => {
          if (!node) return;
          setState((current) =>
            current.folderId === folderId &&
            !current.folders.some((f) => f.id === movedFolderId)
              ? { folderId, folders: [...current.folders, node] }
              : current,
          );
        });
      }
    },
  });

  const loading = state.folderId !== folderId;
  return { folders: loading ? [] : state.folders, loading };
}
