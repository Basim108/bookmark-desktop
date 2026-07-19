import { beforeEach, describe, expect, it, vi } from "vitest";
import { installChromeMock } from "../../test/chromeMock";
import {
  forceBookmarkResync,
  registerBookmarkListeners,
  subscribeToBookmarkChanges,
} from "./events";
import { getFolderPositions } from "../storage/positions";
import {
  getBookmarkSettings,
  setBookmarkHasCustomIcon,
} from "../storage/bookmarkSettings";
import {
  getFolderSettings,
  setFolderHasCustomIcon,
} from "../storage/folderSettings";
import { getIcon, putIcon } from "../storage/iconDb";
import { TRANSFER_LOCK_MAX_AGE_MS } from "../transfer/lockRecord";

const mock = installChromeMock();

function node(
  id: string,
  parentId: string,
  overrides: Partial<chrome.bookmarks.BookmarkTreeNode> = {},
): chrome.bookmarks.BookmarkTreeNode {
  return {
    id,
    parentId,
    index: 0,
    title: `Node ${id}`,
    url: `https://example.com/${id}`,
    syncing: false,
    ...overrides,
  };
}

function folderNode(
  id: string,
  parentId: string,
  overrides: Partial<Omit<chrome.bookmarks.BookmarkTreeNode, "url">> = {},
): chrome.bookmarks.BookmarkTreeNode {
  return {
    id,
    parentId,
    index: 0,
    title: `Folder ${id}`,
    syncing: false,
    ...overrides,
  };
}

async function flush() {
  // Listeners fire storage/IndexedDB work asynchronously (via the mutex);
  // let those settle before asserting. IndexedDB callbacks (deleteIcon)
  // resolve over multiple event-loop turns, so a single setTimeout(0)
  // isn't always enough — loop a few turns to be safe.
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

beforeEach(() => {
  mock.reset();
  registerBookmarkListeners();
});

describe("onCreated", () => {
  it("places a newly created bookmark in the next free cell", async () => {
    const bookmark = node("b1", "folder-1");
    mock.addNode(bookmark);
    mock.chrome.bookmarks.onCreated.emit("b1", bookmark);
    await flush();

    const positions = await getFolderPositions("folder-1");
    expect(positions.b1).toEqual({ page: 0, row: 0, col: 0 });
  });

  it("does not place a newly created folder (folders have no canvas position)", async () => {
    const folder = folderNode("f1", "folder-1");
    mock.addNode(folder);
    mock.chrome.bookmarks.onCreated.emit("f1", folder);
    await flush();

    const positions = await getFolderPositions("folder-1");
    expect(positions.f1).toBeUndefined();
  });
});

describe("onRemoved", () => {
  it("removes the stored position of a removed bookmark", async () => {
    await mock.chrome.storage.local.set({
      positions: { "folder-1": { b1: { page: 0, row: 0, col: 0 } } },
    });

    mock.chrome.bookmarks.onRemoved.emit("b1", {
      parentId: "folder-1",
      index: 0,
      node: node("b1", "folder-1"),
    });
    await flush();

    const positions = await getFolderPositions("folder-1");
    expect(positions.b1).toBeUndefined();
  });

  it("recursively cleans up every bookmark nested inside a removed folder", async () => {
    await mock.chrome.storage.local.set({
      positions: {
        "folder-1": { f1: { page: 0, row: 0, col: 0 } },
        f1: { b1: { page: 0, row: 0, col: 0 } },
        f2: { b2: { page: 0, row: 0, col: 0 } },
      },
    });

    const removedFolder = folderNode("f1", "folder-1", {
      children: [
        node("b1", "f1"),
        {
          ...folderNode("f2", "f1"),
          children: [node("b2", "f2")],
        },
      ],
    });

    mock.chrome.bookmarks.onRemoved.emit("f1", {
      parentId: "folder-1",
      index: 0,
      node: removedFolder,
    });
    await flush();

    expect(await getFolderPositions("f1")).toEqual({});
    expect(await getFolderPositions("f2")).toEqual({});
  });

  it("discards a removed bookmark's settings and custom icon", async () => {
    await setBookmarkHasCustomIcon("b1", true);
    await putIcon("b1", new Blob(["x"], { type: "image/png" }));

    mock.chrome.bookmarks.onRemoved.emit("b1", {
      parentId: "folder-1",
      index: 0,
      node: node("b1", "folder-1"),
    });
    await flush();

    expect(await getBookmarkSettings("b1")).toEqual({
      labelDisplay: "under-icon",
      hasCustomIcon: false,
    });
    expect(await getIcon("b1")).toBeUndefined();
  });

  it("discards a removed folder's settings and custom icon", async () => {
    await setFolderHasCustomIcon("f1", true);
    await putIcon("f1", new Blob(["x"], { type: "image/png" }));

    mock.chrome.bookmarks.onRemoved.emit("f1", {
      parentId: "folder-1",
      index: 0,
      node: folderNode("f1", "folder-1"),
    });
    await flush();

    expect(await getFolderSettings("f1")).toEqual({
      hasCustomIcon: false,
    });
    expect(await getIcon("f1")).toBeUndefined();
  });

  it("recursively discards settings for every bookmark nested inside a removed folder", async () => {
    await setBookmarkHasCustomIcon("b1", true);

    const removedFolder = folderNode("f1", "folder-1", {
      children: [node("b1", "f1")],
    });
    mock.chrome.bookmarks.onRemoved.emit("f1", {
      parentId: "folder-1",
      index: 0,
      node: removedFolder,
    });
    await flush();

    expect(await getBookmarkSettings("b1")).toEqual({
      labelDisplay: "under-icon",
      hasCustomIcon: false,
    });
  });
});

describe("forceBookmarkResync", () => {
  it("invokes every subscribeToBookmarkChanges listener", () => {
    const callback = vi.fn();
    subscribeToBookmarkChanges(callback);

    forceBookmarkResync();

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("does not invoke listeners that have unsubscribed", () => {
    const callback = vi.fn();
    const unsubscribe = subscribeToBookmarkChanges(callback);
    unsubscribe();

    forceBookmarkResync();

    expect(callback).not.toHaveBeenCalled();
  });
});

describe("onMoved", () => {
  it("ignores same-parent moves (Chrome-native reordering)", async () => {
    await mock.chrome.storage.local.set({
      positions: { "folder-1": { b1: { page: 0, row: 2, col: 3 } } },
    });

    mock.chrome.bookmarks.onMoved.emit("b1", {
      parentId: "folder-1",
      oldParentId: "folder-1",
      index: 5,
      oldIndex: 0,
    });
    await flush();

    const positions = await getFolderPositions("folder-1");
    expect(positions.b1).toEqual({ page: 0, row: 2, col: 3 });
  });

  it("discards the old position and places the bookmark fresh in the new folder", async () => {
    await mock.chrome.storage.local.set({
      positions: { "folder-a": { b1: { page: 0, row: 2, col: 3 } } },
    });
    mock.addNode(node("b1", "folder-b"));

    mock.chrome.bookmarks.onMoved.emit("b1", {
      parentId: "folder-b",
      oldParentId: "folder-a",
      index: 0,
      oldIndex: 0,
    });
    await flush();

    expect(await getFolderPositions("folder-a")).toEqual({});
    expect((await getFolderPositions("folder-b")).b1).toEqual({
      page: 0,
      row: 0,
      col: 0,
    });
  });

  it("does not assign a canvas position when a folder (not a bookmark) is moved", async () => {
    mock.addNode(folderNode("f1", "folder-b"));

    mock.chrome.bookmarks.onMoved.emit("f1", {
      parentId: "folder-b",
      oldParentId: "folder-a",
      index: 0,
      oldIndex: 0,
    });
    await flush();

    expect(await getFolderPositions("folder-b")).toEqual({});
  });
});

describe("subscribeToBookmarkChanges", () => {
  it("invokes the callback for created, removed, moved, changed, and reordered events", () => {
    const callback = vi.fn();
    subscribeToBookmarkChanges(callback);

    mock.chrome.bookmarks.onCreated.emit("b1", node("b1", "f1"));
    mock.chrome.bookmarks.onRemoved.emit("b1", {
      parentId: "f1",
      index: 0,
      node: node("b1", "f1"),
    });
    mock.chrome.bookmarks.onMoved.emit("b1", {
      parentId: "f2",
      oldParentId: "f1",
      index: 0,
      oldIndex: 0,
    });
    mock.chrome.bookmarks.onChanged.emit("b1", { title: "New title" });
    mock.chrome.bookmarks.onChildrenReordered.emit("f1", { childIds: [] });

    expect(callback).toHaveBeenCalledTimes(5);
  });

  it("stops receiving events after unsubscribing", () => {
    const callback = vi.fn();
    const unsubscribe = subscribeToBookmarkChanges(callback);
    unsubscribe();

    mock.chrome.bookmarks.onCreated.emit("b1", node("b1", "f1"));

    expect(callback).not.toHaveBeenCalled();
  });
});

describe("bulk import batching", () => {
  it("buffers onCreated during import and backfills affected folders once import ends", async () => {
    mock.chrome.bookmarks.onImportBegan.emit();

    const b1 = node("b1", "folder-1", { index: 0 });
    const b2 = node("b2", "folder-1", { index: 1 });
    mock.addNode(b1);
    mock.addNode(b2);
    mock.chrome.bookmarks.onCreated.emit("b1", b1);
    mock.chrome.bookmarks.onCreated.emit("b2", b2);
    await flush();

    // Nothing placed yet — import still in progress.
    expect(await getFolderPositions("folder-1")).toEqual({});

    mock.chrome.bookmarks.onImportEnded.emit();
    await flush();

    const positions = await getFolderPositions("folder-1");
    expect(positions.b1).toEqual({ page: 0, row: 0, col: 0 });
    expect(positions.b2).toEqual({ page: 0, row: 0, col: 1 });
  });
});

describe("durable transfer lock", () => {
  /**
   * Writes the storage.session lock record directly, without the in-memory
   * flag — exactly the state a service worker sees after being torn down and
   * restarted mid-import, since registerBookmarkListeners runs fresh with
   * transferImportLocked back at its `false` initial value.
   */
  async function seedLockRecord(takenAt: number) {
    await mock.chrome.storage.session.set({
      transferImportLock: { takenAt },
    });
  }

  it("stands down for onCreated when only the stored record is held", async () => {
    await seedLockRecord(Date.now());

    const bookmark = node("b1", "folder-1");
    mock.addNode(bookmark);
    mock.chrome.bookmarks.onCreated.emit("b1", bookmark);
    await flush();

    // Auto-placement would fight the importer's authoritative position writes.
    expect(await getFolderPositions("folder-1")).toEqual({});
  });

  it("stands down for onRemoved when only the stored record is held", async () => {
    await putIcon("b1", new Blob(["icon"], { type: "image/png" }));
    await setBookmarkHasCustomIcon("b1", true);
    await seedLockRecord(Date.now());

    mock.chrome.bookmarks.onRemoved.emit("b1", {
      parentId: "folder-1",
      index: 0,
      node: node("b1", "folder-1"),
    });
    await flush();

    // Cleanup here would delete data for ids the importer just created.
    expect(await getIcon("b1")).toBeDefined();
    expect(await getBookmarkSettings("b1")).toEqual({
      labelDisplay: "under-icon",
      hasCustomIcon: true,
    });
  });

  it("ignores a record older than the staleness bound", async () => {
    // An importer that died without releasing must not suspend synchronization
    // for the rest of the browser session.
    await seedLockRecord(Date.now() - (TRANSFER_LOCK_MAX_AGE_MS + 1000));

    const bookmark = node("b1", "folder-1");
    mock.addNode(bookmark);
    mock.chrome.bookmarks.onCreated.emit("b1", bookmark);
    await flush();

    expect(await getFolderPositions("folder-1")).toEqual({
      b1: { page: 0, row: 0, col: 0 },
    });
  });

  it("resumes normal behavior once the record is cleared", async () => {
    await seedLockRecord(Date.now());
    await mock.chrome.storage.session.remove("transferImportLock");

    const bookmark = node("b1", "folder-1");
    mock.addNode(bookmark);
    mock.chrome.bookmarks.onCreated.emit("b1", bookmark);
    await flush();

    expect(await getFolderPositions("folder-1")).toEqual({
      b1: { page: 0, row: 0, col: 0 },
    });
  });
});
