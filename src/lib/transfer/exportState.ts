import { getFolderTree, isBookmark } from "../bookmarks/read";
import { blobToDataUrl } from "../import/dataUrl";
import { DEFAULT_BOOKMARK_SETTINGS } from "../storage/bookmarkSettings";
import { getCanvasBackground } from "../storage/canvasBackground";
import { DEFAULT_FOLDER_ICON_KEY } from "../storage/defaultFolderIcon";
import { DEFAULT_FOLDER_SETTINGS } from "../storage/folderSettings";
import { DEFAULT_GENERAL_SETTINGS } from "../storage/generalSettings";
import { getIcon } from "../storage/iconDb";
import { getStorageValue } from "../storage/local";
import { STORAGE_KEYS } from "../storage/schema";
import type {
  BookmarkSettings,
  FolderPositions,
  FolderSettings,
} from "../storage/schema";
import { getSidebarWidth } from "../storage/sidebarSettings";
import { slotToExportPosition } from "./positionCompat";
import { PROTECTED_ROOT_IDS } from "./roots";
import type {
  ExportFileV1,
  ExportNode,
  ExportRoot,
  ProtectedRootId,
} from "./types";
import { EXPORT_FORMAT_VERSION } from "./version";

/** Reads a stored icon blob and inlines it as a base64 data URL, or null when absent. */
async function inlineIcon(itemId: string): Promise<string | null> {
  const blob = await getIcon(itemId);
  return blob ? await blobToDataUrl(blob) : null;
}

interface StorageSnapshot {
  positions: Record<string, FolderPositions>;
  bookmarkSettings: Record<string, BookmarkSettings>;
  folderSettings: Record<string, FolderSettings>;
}

async function buildNode(
  node: chrome.bookmarks.BookmarkTreeNode,
  snapshot: StorageSnapshot,
): Promise<ExportNode> {
  if (isBookmark(node)) {
    const parentId = node.parentId ?? "";
    const slot = snapshot.positions[parentId]?.[node.id] ?? null;
    return {
      type: "bookmark",
      title: node.title,
      url: node.url ?? "",
      slot,
      position: slot === null ? null : slotToExportPosition(slot),
      settings: snapshot.bookmarkSettings[node.id] ?? DEFAULT_BOOKMARK_SETTINGS,
      icon: await inlineIcon(node.id),
    };
  }
  const children: ExportNode[] = [];
  for (const child of node.children ?? []) {
    children.push(await buildNode(child, snapshot));
  }
  return {
    type: "folder",
    title: node.title,
    settings: snapshot.folderSettings[node.id] ?? DEFAULT_FOLDER_SETTINGS,
    icon: await inlineIcon(node.id),
    children,
  };
}

/**
 * Serializes the entire extension state into a self-contained, id-free
 * ExportFileV1: every folder/bookmark under the protected roots with its
 * settings, position, and custom icon inlined, plus the general block (sidebar
 * width, general settings, and the two global images). Reads chrome.bookmarks,
 * chrome.storage.local, and the IndexedDB icon store; the caller downloads the
 * returned object as JSON.
 */
export async function exportState(): Promise<ExportFileV1> {
  const [tree, positions, bookmarkSettings, folderSettings] = await Promise.all(
    [
      getFolderTree(),
      getStorageValue(STORAGE_KEYS.POSITIONS),
      getStorageValue(STORAGE_KEYS.BOOKMARK_SETTINGS),
      getStorageValue(STORAGE_KEYS.FOLDER_SETTINGS),
    ],
  );
  const snapshot: StorageSnapshot = {
    positions: positions ?? {},
    bookmarkSettings: bookmarkSettings ?? {},
    folderSettings: folderSettings ?? {},
  };

  // getTree returns the synthetic root "0"; its children are the protected roots.
  const rootChildren = tree[0]?.children ?? [];
  const roots: Partial<Record<ProtectedRootId, ExportRoot>> = {};
  for (const root of rootChildren) {
    if (!PROTECTED_ROOT_IDS.includes(root.id as ProtectedRootId)) {
      continue;
    }
    const children: ExportNode[] = [];
    for (const child of root.children ?? []) {
      children.push(await buildNode(child, snapshot));
    }
    roots[root.id as ProtectedRootId] = { title: root.title, children };
  }

  const [generalSettings, sidebarWidth, backgroundBlob, defaultFolderIcon] =
    await Promise.all([
      getStorageValue(STORAGE_KEYS.GENERAL_SETTINGS),
      getSidebarWidth(),
      getCanvasBackground(),
      inlineIcon(DEFAULT_FOLDER_ICON_KEY),
    ]);

  return {
    version: EXPORT_FORMAT_VERSION,
    roots,
    general: {
      sidebarWidth,
      generalSettings: generalSettings ?? DEFAULT_GENERAL_SETTINGS,
      canvasBackgroundIcon: backgroundBlob
        ? await blobToDataUrl(backgroundBlob)
        : null,
      defaultFolderIcon,
    },
  };
}
