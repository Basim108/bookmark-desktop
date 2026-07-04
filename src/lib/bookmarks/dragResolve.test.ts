import { beforeEach, describe, expect, it } from "vitest";
import { installChromeMock } from "../../test/chromeMock";
import { resolveCrossFolderDrop } from "./dragResolve";

const mock = installChromeMock();

function folderNode(
  id: string,
  parentId: string,
): chrome.bookmarks.BookmarkTreeNode {
  return { id, parentId, index: 0, title: `Folder ${id}`, syncing: false };
}

beforeEach(() => {
  mock.reset();
});

describe("resolveCrossFolderDrop", () => {
  it("resolves a bookmark dropped onto a different folder", async () => {
    await expect(
      resolveCrossFolderDrop(
        "bookmark-1",
        { type: "bookmark", sourceFolderId: "folder-a" },
        { type: "folder", folderId: "folder-b" },
      ),
    ).resolves.toEqual({
      kind: "move-bookmark",
      bookmarkId: "bookmark-1",
      destFolderId: "folder-b",
    });
  });

  it("resolves a folder dropped onto a different, unrelated parent folder", async () => {
    mock.addNode(folderNode("folder-a", "0"));
    mock.addNode(folderNode("folder-b", "0"));
    mock.addNode(folderNode("folder-c", "folder-a"));

    await expect(
      resolveCrossFolderDrop(
        "folder-c",
        { type: "folder", sourceParentId: "folder-a" },
        { type: "folder", folderId: "folder-b" },
      ),
    ).resolves.toEqual({
      kind: "move-folder",
      folderId: "folder-c",
      destFolderId: "folder-b",
    });
  });

  it("returns null when the drop target isn't a folder", async () => {
    await expect(
      resolveCrossFolderDrop(
        "bookmark-1",
        { type: "bookmark", sourceFolderId: "folder-a" },
        { type: "cell" },
      ),
    ).resolves.toBeNull();
  });

  it("returns null when a folder is dropped onto itself", async () => {
    await expect(
      resolveCrossFolderDrop(
        "folder-a",
        { type: "folder", sourceParentId: "folder-root" },
        { type: "folder", folderId: "folder-a" },
      ),
    ).resolves.toBeNull();
  });

  it("returns null when a bookmark is dropped onto its own current folder", async () => {
    await expect(
      resolveCrossFolderDrop(
        "bookmark-1",
        { type: "bookmark", sourceFolderId: "folder-a" },
        { type: "folder", folderId: "folder-a" },
      ),
    ).resolves.toBeNull();
  });

  it("returns null when a folder is dropped onto its own current parent", async () => {
    await expect(
      resolveCrossFolderDrop(
        "folder-c",
        { type: "folder", sourceParentId: "folder-a" },
        { type: "folder", folderId: "folder-a" },
      ),
    ).resolves.toBeNull();
  });

  it("returns null when there is no drop target", async () => {
    await expect(
      resolveCrossFolderDrop(
        "bookmark-1",
        { type: "bookmark", sourceFolderId: "folder-a" },
        undefined,
      ),
    ).resolves.toBeNull();
  });

  it("returns null when dragging a protected root folder (Bookmarks Bar)", async () => {
    mock.addNode(folderNode("2", "0"));

    await expect(
      resolveCrossFolderDrop(
        "1",
        { type: "folder", sourceParentId: "0" },
        { type: "folder", folderId: "2" },
      ),
    ).resolves.toBeNull();
  });

  it("returns null when dropping a folder onto its own descendant (cycle)", async () => {
    mock.addNode(folderNode("folder-a", "0"));
    mock.addNode(folderNode("folder-b", "folder-a"));
    mock.addNode(folderNode("folder-c", "folder-b"));

    await expect(
      resolveCrossFolderDrop(
        "folder-a",
        { type: "folder", sourceParentId: "0" },
        { type: "folder", folderId: "folder-c" },
      ),
    ).resolves.toBeNull();
  });
});
