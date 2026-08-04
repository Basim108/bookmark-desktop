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

  describe("reorder gaps (between-rows drops)", () => {
    /**
     * parent "p" holds, in Chrome's child order:
     *   [0] bookmark  [1] F1  [2] bookmark  [3] F2  [4] F3
     * The sidebar shows only F1, F2, F3.
     */
    function seedInterleavedParent() {
      mock.addNode(folderNode("p", "0"));
      mock.addNode({
        id: "bm-a",
        parentId: "p",
        index: 0,
        title: "bm-a",
        syncing: false,
        url: "https://example.com/a",
      });
      mock.addNode({ ...folderNode("F1", "p"), index: 1 });
      mock.addNode({
        id: "bm-b",
        parentId: "p",
        index: 2,
        title: "bm-b",
        syncing: false,
        url: "https://example.com/b",
      });
      mock.addNode({ ...folderNode("F2", "p"), index: 3 });
      mock.addNode({ ...folderNode("F3", "p"), index: 4 });
    }

    it("resolves a folder dropped into a gap among its own siblings", async () => {
      seedInterleavedParent();

      await expect(
        resolveCrossFolderDrop(
          "F3",
          { type: "folder", sourceParentId: "p" },
          {
            type: "folder-gap",
            gapParentId: "p",
            slot: { kind: "before", subfolderId: "F1" },
          },
        ),
      ).resolves.toEqual({
        kind: "reorder-folder",
        folderId: "F3",
        parentId: "p",
        // F1's own child index — not its visible position among subfolders.
        index: 1,
      });
    });

    it("resolves a drop into the end gap to the parent's child count", async () => {
      seedInterleavedParent();

      await expect(
        resolveCrossFolderDrop(
          "F1",
          { type: "folder", sourceParentId: "p" },
          { type: "folder-gap", gapParentId: "p", slot: { kind: "end" } },
        ),
      ).resolves.toEqual({
        kind: "reorder-folder",
        folderId: "F1",
        parentId: "p",
        index: 5,
      });
    });

    it("returns null for a gap belonging to a different parent", async () => {
      seedInterleavedParent();
      mock.addNode(folderNode("other", "0"));

      await expect(
        resolveCrossFolderDrop(
          "F1",
          { type: "folder", sourceParentId: "p" },
          {
            type: "folder-gap",
            gapParentId: "other",
            slot: { kind: "end" },
          },
        ),
      ).resolves.toBeNull();
    });

    it("returns null for the gap immediately before the dragged folder", async () => {
      seedInterleavedParent();

      await expect(
        resolveCrossFolderDrop(
          "F2",
          { type: "folder", sourceParentId: "p" },
          {
            type: "folder-gap",
            gapParentId: "p",
            slot: { kind: "before", subfolderId: "F2" },
          },
        ),
      ).resolves.toBeNull();
    });

    it("returns null for the gap immediately after the dragged folder", async () => {
      seedInterleavedParent();

      // The gap after F1 is the "before F2" gap — F2 is F1's next subfolder
      // sibling even though a bookmark sits between them in child order.
      await expect(
        resolveCrossFolderDrop(
          "F1",
          { type: "folder", sourceParentId: "p" },
          {
            type: "folder-gap",
            gapParentId: "p",
            slot: { kind: "before", subfolderId: "F2" },
          },
        ),
      ).resolves.toBeNull();
    });

    it("returns null for the end gap when the folder is already last", async () => {
      seedInterleavedParent();

      await expect(
        resolveCrossFolderDrop(
          "F3",
          { type: "folder", sourceParentId: "p" },
          { type: "folder-gap", gapParentId: "p", slot: { kind: "end" } },
        ),
      ).resolves.toBeNull();
    });

    it("returns null for a bookmark dropped into a gap", async () => {
      seedInterleavedParent();

      await expect(
        resolveCrossFolderDrop(
          "bm-a",
          { type: "bookmark", sourceFolderId: "p" },
          { type: "folder-gap", gapParentId: "p", slot: { kind: "end" } },
        ),
      ).resolves.toBeNull();
    });

    it("returns null when dragging a protected root folder over a gap", async () => {
      mock.addNode(folderNode("1", "0"));
      mock.addNode(folderNode("2", "0"));

      await expect(
        resolveCrossFolderDrop(
          "1",
          { type: "folder", sourceParentId: "0" },
          { type: "folder-gap", gapParentId: "0", slot: { kind: "end" } },
        ),
      ).resolves.toBeNull();
    });

    it("returns null when the gap carries no slot data", async () => {
      seedInterleavedParent();

      await expect(
        resolveCrossFolderDrop(
          "F1",
          { type: "folder", sourceParentId: "p" },
          { type: "folder-gap", gapParentId: "p" },
        ),
      ).resolves.toBeNull();
    });
  });
});
