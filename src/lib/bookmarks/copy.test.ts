import { beforeEach, describe, expect, it, vi } from "vitest";
import { installChromeMock } from "../../test/chromeMock";
import {
  getBookmarkSettings,
  setBookmarkSettings,
} from "../storage/bookmarkSettings";
import { getIcon, putIcon } from "../storage/iconDb";
import { copyBookmarkToFolder } from "./copy";

const mock = installChromeMock();

beforeEach(() => mock.reset());

function source() {
  const node: chrome.bookmarks.BookmarkTreeNode = {
    id: "source",
    parentId: "folder-a",
    index: 4,
    title: "Example",
    url: "https://example.com",
    dateAdded: 10,
    syncing: false,
  };
  mock.addNode(node);
  return node;
}

describe("copyBookmarkToFolder", () => {
  it("creates an independent bookmark and copies its complete metadata but no position fields", async () => {
    const node = source();
    const settings = {
      labelDisplay: "tooltip" as const,
      hasCustomIcon: true,
      futureColor: "violet",
    };
    await setBookmarkSettings(node.id, settings);
    await putIcon(node.id, new Blob(["icon bytes"], { type: "image/png" }));

    const result = await copyBookmarkToFolder(node, "folder-b");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.node.id).not.toBe(node.id);
    expect(result.node).toMatchObject({
      parentId: "folder-b",
      title: "Example",
      url: "https://example.com",
    });
    expect(chrome.bookmarks.create).toHaveBeenCalledWith({
      parentId: "folder-b",
      title: "Example",
      url: "https://example.com",
    });
    expect(await getBookmarkSettings(result.node.id)).toEqual(settings);
    expect(await (await getIcon(result.node.id))?.text()).toBe("icon bytes");
    expect((await chrome.bookmarks.get(node.id))[0]?.parentId).toBe("folder-a");
  });

  it("removes a newly created bookmark when metadata copying fails", async () => {
    const node = source();
    await setBookmarkSettings(node.id, {
      labelDisplay: "tooltip",
      hasCustomIcon: true,
    });
    await putIcon(node.id, new Blob(["icon"], { type: "image/png" }));
    vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(
      new Error("settings unavailable"),
    );

    const result = await copyBookmarkToFolder(node, "folder-b");

    expect(result).toEqual({ ok: false, error: "copy-failed" });
    const createResults = vi.mocked(chrome.bookmarks.create).mock.results;
    const createdId = createResults.at(-1)?.value;
    const created = await createdId;
    expect(chrome.bookmarks.remove).toHaveBeenCalledWith(created.id);
  });

  it("reports when rollback also fails", async () => {
    const node = source();
    vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(
      new Error("write"),
    );
    vi.mocked(chrome.bookmarks.remove).mockRejectedValueOnce(
      new Error("remove"),
    );

    expect(await copyBookmarkToFolder(node, "folder-b")).toEqual({
      ok: false,
      error: "rollback-failed",
    });
  });
});
