import { beforeEach, describe, expect, it } from "vitest";
import { installChromeMock } from "../../test/chromeMock";
import { getLastFolderId, setLastFolderId } from "./lastFolder";

const mock = installChromeMock();

beforeEach(() => {
  mock.reset();
});

/** A folder node (no url) in the fake tree. */
function addFolder(id: string, parentId = "1") {
  mock.addNode({
    id,
    parentId,
    index: 0,
    title: `Folder ${id}`,
    syncing: false,
  });
}

/** A bookmark node (has a url) in the fake tree. */
function addBookmark(id: string, parentId = "1") {
  mock.addNode({
    id,
    parentId,
    index: 0,
    title: `Bookmark ${id}`,
    url: "https://example.com",
    syncing: false,
  });
}

describe("getLastFolderId", () => {
  it("returns the stored id when it resolves to a folder", async () => {
    addFolder("42");
    await setLastFolderId("42");
    expect(await getLastFolderId()).toBe("42");
  });

  it("returns undefined when nothing is stored", async () => {
    expect(await getLastFolderId()).toBeUndefined();
  });

  it("returns undefined when the stored id no longer exists", async () => {
    addFolder("42");
    await setLastFolderId("42");
    mock.removeNode("42");
    expect(await getLastFolderId()).toBeUndefined();
  });

  it("returns undefined when the stored id resolves to a bookmark", async () => {
    // Chrome reassigns ids across profiles (sync, or a state-transfer import),
    // so a stored folder id can legitimately come back as a bookmark.
    addBookmark("42");
    await setLastFolderId("42");
    expect(await getLastFolderId()).toBeUndefined();
  });

  it("does not write a fallback back to storage when the id is stale", async () => {
    addFolder("42");
    await setLastFolderId("42");
    mock.removeNode("42");
    await getLastFolderId();
    expect((await chrome.storage.local.get("lastFolderId")).lastFolderId).toBe(
      "42",
    );
  });
});

describe("setLastFolderId", () => {
  it("stores the folder id", async () => {
    await setLastFolderId("7");
    expect((await chrome.storage.local.get("lastFolderId")).lastFolderId).toBe(
      "7",
    );
  });

  it("replaces any previously stored id", async () => {
    await setLastFolderId("7");
    await setLastFolderId("9");
    expect((await chrome.storage.local.get("lastFolderId")).lastFolderId).toBe(
      "9",
    );
  });
});
