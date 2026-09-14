import { isFolder } from "./read";

export interface FolderPickerEntry {
  id: string;
  name: string;
  path: string;
  children: FolderPickerEntry[];
}

function projectNodes(
  nodes: readonly chrome.bookmarks.BookmarkTreeNode[],
  parentPath: string,
): FolderPickerEntry[] {
  return nodes.filter(isFolder).map((node) => {
    const path = parentPath ? `${parentPath} › ${node.title}` : node.title;
    return {
      id: node.id,
      name: node.title,
      path,
      children: projectNodes(node.children ?? [], path),
    };
  });
}

export function projectFolderTree(
  tree: readonly chrome.bookmarks.BookmarkTreeNode[],
): FolderPickerEntry[] {
  const roots =
    tree.length === 1 && tree[0]?.id === "0" ? (tree[0].children ?? []) : tree;
  return projectNodes(roots, "");
}

export function flattenFolderEntries(
  entries: readonly FolderPickerEntry[],
): FolderPickerEntry[] {
  return entries.flatMap((entry) => [
    entry,
    ...flattenFolderEntries(entry.children),
  ]);
}

export function filterFolderEntries(
  entries: readonly FolderPickerEntry[],
  query: string,
): FolderPickerEntry[] {
  const pattern = query.trim().toLocaleLowerCase();
  if (!pattern) return flattenFolderEntries(entries);
  return flattenFolderEntries(entries).filter((entry) =>
    entry.name.toLocaleLowerCase().includes(pattern),
  );
}
