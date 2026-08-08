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

    const positions = await backfillFolderPositions("folder-1");

    expect(positions).toEqual({ b1: 0, b2: 1, b3: 2 });
  });

  it("only fills in bookmarks that are missing a stored position", async () => {
    mock.addNode(bookmark("b1", "folder-1", 0));
    mock.addNode(bookmark("b2", "folder-1", 1));

    // b1 was manually dragged to a non-sequential slot previously.
    await mock.chrome.storage.local.set({
      positions: { "folder-1": { b1: 3 } },
    });

    const positions = await backfillFolderPositions("folder-1");

    // b1's existing (manually placed) position must be untouched...
    expect(positions.b1).toBe(3);
    // ...and b2 must take the lowest free slot without colliding with it.
    expect(positions.b2).toBe(0);
  });

  it("is a no-op when every bookmark already has a position", async () => {
    mock.addNode(bookmark("b1", "folder-1", 0));
    await mock.chrome.storage.local.set({
      positions: { "folder-1": { b1: 0 } },
    });

    const positions = await backfillFolderPositions("folder-1");

    expect(positions).toEqual({ b1: 0 });
    expect(await getFolderPositions("folder-1")).toEqual({ b1: 0 });
  });

  it("needs no capacity, so the same folder seeds identically in any context", async () => {
    mock.addNode(bookmark("b1", "folder-1", 0));
    mock.addNode(bookmark("b2", "folder-1", 1));
    // A capacity recorded by an older build must not influence seeding.
    await mock.chrome.storage.local.set({ gridCapacity: { cols: 2, rows: 2 } });

    expect(await backfillFolderPositions("folder-1")).toEqual({ b1: 0, b2: 1 });
  });

  it("converts a pre-slot store on the way through", async () => {
    mock.addNode(bookmark("b1", "folder-1", 0));
    mock.addNode(bookmark("b2", "folder-1", 1));
    await mock.chrome.storage.local.set({
      gridCapacity: { cols: 6, rows: 3 },
      positions: { "folder-1": { b1: { page: 0, row: 2, col: 5 } } },
    });

    const positions = await backfillFolderPositions("folder-1");

    expect(positions.b1).toBe(17);
    expect(positions.b2).toBe(0);
  });
});
