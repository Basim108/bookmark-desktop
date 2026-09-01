import { describe, expect, it } from "vitest";
import { filterFolderEntries, projectFolderTree } from "./folderPicker";

const tree: chrome.bookmarks.BookmarkTreeNode[] = [
  {
    id: "0",
    title: "",
    syncing: false,
    children: [
      {
        id: "1",
        parentId: "0",
        title: "Bookmarks Bar",
        syncing: false,
        children: [
          {
            id: "work",
            parentId: "1",
            title: "Work",
            syncing: false,
            children: [
              {
                id: "project",
                parentId: "work",
                title: "Project Alpha",
                syncing: false,
              },
            ],
          },
          {
            id: "bookmark",
            parentId: "1",
            title: "Not a folder",
            url: "https://example.com",
            syncing: false,
          },
        ],
      },
      {
        id: "2",
        parentId: "0",
        title: "Other Bookmarks",
        syncing: false,
        children: [
          {
            id: "other-project",
            parentId: "2",
            title: "Projects",
            syncing: false,
          },
        ],
      },
    ],
  },
];

describe("folder picker model", () => {
  it("projects folders with stable ids, hierarchy, and full paths", () => {
    const projected = projectFolderTree(tree);
    expect(projected.map(({ id, path }) => ({ id, path }))).toEqual([
      { id: "1", path: "Bookmarks Bar" },
      { id: "2", path: "Other Bookmarks" },
    ]);
    expect(projected[0]?.children[0]).toMatchObject({
      id: "work",
      path: "Bookmarks Bar › Work",
    });
    expect(projected[0]?.children[0]?.children[0]?.path).toBe(
      "Bookmarks Bar › Work › Project Alpha",
    );
  });

  it("filters only folder names by trimmed case-insensitive substring and returns flat paths", () => {
    const projected = projectFolderTree(tree);
    expect(
      filterFolderEntries(projected, "  PROJ ").map((item) => item.path),
    ).toEqual([
      "Bookmarks Bar › Work › Project Alpha",
      "Other Bookmarks › Projects",
    ]);
    expect(
      filterFolderEntries(projected, "bookmarks").map((item) => item.id),
    ).toEqual(["1", "2"]);
    expect(filterFolderEntries(projected, "missing")).toEqual([]);
  });
});
