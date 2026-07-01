import { beforeEach, describe, expect, it } from "vitest";
import { installChromeMock } from "../../test/chromeMock";
import { backfillFolderPositions } from "./seed";
import { getFolderPositions } from "../storage/positions";

const mock = installChromeMock();

beforeEach(() => {
  mock.reset();
});

function bookmark(
  id: string,
  parentId: string,
  index: number,
): chrome.bookmarks.BookmarkTreeNode {
  return {
    id,
    parentId,
    index,
    title: `Bookmark ${id}`,
    url: `https://example.com/${id}`,
    syncing: false,
  };
}

describe("backfillFolderPositions", () => {
  it("seeds an empty folder in Chrome's bookmark order", async () => {
    mock.addNode(bookmark("b1", "folder-1", 0));
    mock.addNode(bookmark("b2", "folder-1", 1));
    mock.addNode(bookmark("b3", "folder-1", 2));

    const positions = await backfillFolderPositions("folder-1", {
      cols: 2,
      rows: 2,
    });

    expect(positions.b1).toEqual({ page: 0, row: 0, col: 0 });
    expect(positions.b2).toEqual({ page: 0, row: 0, col: 1 });
    expect(positions.b3).toEqual({ page: 0, row: 1, col: 0 });
  });

  it("only fills in bookmarks that are missing a stored position", async () => {
    mock.addNode(bookmark("b1", "folder-1", 0));
    mock.addNode(bookmark("b2", "folder-1", 1));

    // b1 was manually dragged to a non-sequential spot previously.
    await mock.chrome.storage.local.set({
      positions: { "folder-1": { b1: { page: 0, row: 1, col: 1 } } },
    });

    const positions = await backfillFolderPositions("folder-1", {
      cols: 2,
      rows: 2,
    });

    // b1's existing (manually placed) position must be untouched...
    expect(positions.b1).toEqual({ page: 0, row: 1, col: 1 });
    // ...and b2 must not collide with it.
    expect(positions.b2).toEqual({ page: 0, row: 0, col: 0 });
  });

  it("is a no-op when every bookmark already has a position", async () => {
    mock.addNode(bookmark("b1", "folder-1", 0));
    await mock.chrome.storage.local.set({
      positions: { "folder-1": { b1: { page: 0, row: 0, col: 0 } } },
    });

    const positions = await backfillFolderPositions("folder-1", {
      cols: 2,
      rows: 2,
    });

    expect(positions).toEqual({ b1: { page: 0, row: 0, col: 0 } });
    const stored = await getFolderPositions("folder-1");
    expect(stored).toEqual({ b1: { page: 0, row: 0, col: 0 } });
  });
});
