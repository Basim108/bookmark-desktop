import { describe, expect, it } from "vitest";
import { resolveCrossFolderDrop } from "./dragResolve";

describe("resolveCrossFolderDrop", () => {
  it("resolves a bookmark dropped onto a different folder", () => {
    expect(
      resolveCrossFolderDrop(
        "bookmark-1",
        { type: "bookmark", sourceFolderId: "folder-a" },
        { type: "folder", folderId: "folder-b" },
      ),
    ).toEqual({
      kind: "move-bookmark",
      bookmarkId: "bookmark-1",
      destFolderId: "folder-b",
    });
  });

  it("resolves a folder dropped onto a different parent folder", () => {
    expect(
      resolveCrossFolderDrop(
        "folder-c",
        { type: "folder", sourceParentId: "folder-a" },
        { type: "folder", folderId: "folder-b" },
      ),
    ).toEqual({
      kind: "move-folder",
      folderId: "folder-c",
      destFolderId: "folder-b",
    });
  });

  it("returns null when the drop target isn't a folder", () => {
    expect(
      resolveCrossFolderDrop(
        "bookmark-1",
        { type: "bookmark", sourceFolderId: "folder-a" },
        { type: "cell" },
      ),
    ).toBeNull();
  });

  it("returns null when a folder is dropped onto itself", () => {
    expect(
      resolveCrossFolderDrop(
        "folder-a",
        { type: "folder", sourceParentId: "folder-root" },
        { type: "folder", folderId: "folder-a" },
      ),
    ).toBeNull();
  });

  it("returns null when a bookmark is dropped onto its own current folder", () => {
    expect(
      resolveCrossFolderDrop(
        "bookmark-1",
        { type: "bookmark", sourceFolderId: "folder-a" },
        { type: "folder", folderId: "folder-a" },
      ),
    ).toBeNull();
  });

  it("returns null when a folder is dropped onto its own current parent", () => {
    expect(
      resolveCrossFolderDrop(
        "folder-c",
        { type: "folder", sourceParentId: "folder-a" },
        { type: "folder", folderId: "folder-a" },
      ),
    ).toBeNull();
  });

  it("returns null when there is no drop target", () => {
    expect(
      resolveCrossFolderDrop(
        "bookmark-1",
        { type: "bookmark", sourceFolderId: "folder-a" },
        undefined,
      ),
    ).toBeNull();
  });
});
