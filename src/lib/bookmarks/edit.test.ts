import { beforeEach, describe, expect, it, vi } from "vitest";
import { installChromeMock } from "../../test/chromeMock";
import {
  removeBookmark,
  removeFolder,
  updateBookmark,
  updateFolderTitle,
} from "./edit";

const mock = installChromeMock();

function seedBookmark(id = "b1") {
  mock.addNode({
    id,
    parentId: "1",
    index: 0,
    title: `Bookmark ${id}`,
    url: "https://example.com",
    syncing: false,
  });
}

beforeEach(() => {
  mock.reset();
  vi.clearAllMocks();
});

describe("updateBookmark", () => {
  it("persists a trimmed title and a safe url", async () => {
    seedBookmark();
    const result = await updateBookmark("b1", {
      title: "  New Name  ",
      url: "https://new.example.com/",
    });

    expect(result).toEqual({ ok: true });
    expect(mock.chrome.bookmarks.update).toHaveBeenCalledWith("b1", {
      title: "New Name",
      url: "https://new.example.com/",
    });
  });

  it("rejects an empty or whitespace-only title without calling Chrome", async () => {
    seedBookmark();
    const result = await updateBookmark("b1", {
      title: "   ",
      url: "https://example.com",
    });

    expect(result).toEqual({ ok: false, error: "empty-title" });
    expect(mock.chrome.bookmarks.update).not.toHaveBeenCalled();
  });

  it("rejects a url whose scheme is not on the safe allowlist", async () => {
    seedBookmark();
    const result = await updateBookmark("b1", {
      title: "Name",
      url: "javascript:alert(1)",
    });

    expect(result).toEqual({ ok: false, error: "unsafe-url" });
    expect(mock.chrome.bookmarks.update).not.toHaveBeenCalled();
  });
});

describe("removeBookmark", () => {
  it("delegates to chrome.bookmarks.remove", async () => {
    seedBookmark();
    await removeBookmark("b1");
    expect(mock.chrome.bookmarks.remove).toHaveBeenCalledWith("b1");
  });
});

function seedFolder(id = "f1") {
  mock.addNode({
    id,
    parentId: "1",
    index: 0,
    title: `Folder ${id}`,
    syncing: false,
  });
}

describe("updateFolderTitle", () => {
  it("persists a trimmed title", async () => {
    seedFolder();
    const result = await updateFolderTitle("f1", "  Renamed  ");

    expect(result).toEqual({ ok: true });
    expect(mock.chrome.bookmarks.update).toHaveBeenCalledWith("f1", {
      title: "Renamed",
    });
  });

  it("rejects an empty or whitespace-only title without calling Chrome", async () => {
    seedFolder();
    const result = await updateFolderTitle("f1", "   ");

    expect(result).toEqual({ ok: false, error: "empty-title" });
    expect(mock.chrome.bookmarks.update).not.toHaveBeenCalled();
  });
});

describe("removeFolder", () => {
  it("delegates to chrome.bookmarks.removeTree, not remove", async () => {
    seedFolder();
    await removeFolder("f1");
    expect(mock.chrome.bookmarks.removeTree).toHaveBeenCalledWith("f1");
    expect(mock.chrome.bookmarks.remove).not.toHaveBeenCalled();
  });
});
