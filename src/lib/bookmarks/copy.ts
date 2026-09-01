import {
  getBookmarkSettings,
  setBookmarkSettings,
} from "../storage/bookmarkSettings";
import { getIcon, putIcon } from "../storage/iconDb";

export type BookmarkCopyResult =
  | { ok: true; node: chrome.bookmarks.BookmarkTreeNode }
  | { ok: false; error: "copy-failed" | "rollback-failed" };

interface BookmarkMetadataSnapshot {
  settings: Awaited<ReturnType<typeof getBookmarkSettings>>;
  icon: Blob | undefined;
}

async function readBookmarkMetadata(
  bookmarkId: string,
): Promise<BookmarkMetadataSnapshot> {
  const [settings, icon] = await Promise.all([
    getBookmarkSettings(bookmarkId),
    getIcon(bookmarkId),
  ]);
  return { settings, icon };
}

async function writeBookmarkMetadata(
  bookmarkId: string,
  snapshot: BookmarkMetadataSnapshot,
): Promise<void> {
  await setBookmarkSettings(bookmarkId, snapshot.settings);
  if (snapshot.icon) await putIcon(bookmarkId, snapshot.icon);
}

/** Creates an independent bookmark and clones all bookmark-owned metadata. */
export async function copyBookmarkToFolder(
  source: chrome.bookmarks.BookmarkTreeNode,
  destinationFolderId: string,
): Promise<BookmarkCopyResult> {
  const url = source.url;
  if (!url) return { ok: false, error: "copy-failed" };
  try {
    const metadata = await readBookmarkMetadata(source.id);
    const node = await chrome.bookmarks.create({
      parentId: destinationFolderId,
      title: source.title,
      url,
    });
    try {
      await writeBookmarkMetadata(node.id, metadata);
      return { ok: true, node };
    } catch {
      try {
        await chrome.bookmarks.remove(node.id);
        return { ok: false, error: "copy-failed" };
      } catch {
        return { ok: false, error: "rollback-failed" };
      }
    }
  } catch {
    return { ok: false, error: "copy-failed" };
  }
}
