import { beforeEach, describe, expect, it, vi } from "vitest";
import { installChromeMock } from "../../test/chromeMock";
import { removeBookmark, updateBookmark } from "./edit";

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
