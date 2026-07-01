export function isBookmark(node: chrome.bookmarks.BookmarkTreeNode): boolean {
  return typeof node.url === "string";
}

export function isFolder(node: chrome.bookmarks.BookmarkTreeNode): boolean {
  return !isBookmark(node);
}

export async function getFolderTree(): Promise<
  chrome.bookmarks.BookmarkTreeNode[]
> {
  return chrome.bookmarks.getTree();
}

/** Direct children of a folder, in Chrome's native order. */
export async function getFolderChildren(
  folderId: string,
): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
  return chrome.bookmarks.getChildren(folderId);
}

export interface SplitChildren {
  bookmarks: chrome.bookmarks.BookmarkTreeNode[];
  folders: chrome.bookmarks.BookmarkTreeNode[];
}

/** Separates a folder's direct children into leaf bookmarks and subfolders, preserving Chrome's native order within each group. */
export function splitChildren(
  children: chrome.bookmarks.BookmarkTreeNode[],
): SplitChildren {
  const bookmarks: chrome.bookmarks.BookmarkTreeNode[] = [];
  const folders: chrome.bookmarks.BookmarkTreeNode[] = [];
  for (const child of children) {
    if (isBookmark(child)) {
      bookmarks.push(child);
    } else {
      folders.push(child);
    }
  }
  return { bookmarks, folders };
}

/** The folder's direct bookmark children only (canvas content), in Chrome's native order. */
export async function getBookmarksInFolder(
  folderId: string,
): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
  const children = await getFolderChildren(folderId);
  return splitChildren(children).bookmarks;
}

/** The folder's direct subfolders only (sidebar content), in Chrome's native order. */
export async function getSubfolders(
  folderId: string,
): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
  const children = await getFolderChildren(folderId);
  return splitChildren(children).folders;
}
