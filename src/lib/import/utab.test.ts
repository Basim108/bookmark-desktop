import { beforeEach, describe, expect, it, vi } from "vitest";
import { installChromeMock } from "../../test/chromeMock";
import { getBookmarksInFolder, getSubfolders } from "../bookmarks/read";
import { getBookmarkSettings } from "../storage/bookmarkSettings";
import { getFolderSettings } from "../storage/folderSettings";
import { getIcon } from "../storage/iconDb";
import { importUtabExport } from "./utab";

const mock = installChromeMock();

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** A valid PNG data URL (real magic bytes) that passes icon validation once createImageBitmap is stubbed. */
function pngDataUrl(): string {
  const binary = String.fromCharCode(...PNG_HEADER);
  return `data:image/png;base64,${btoa(binary)}`;
}

function stubImageBitmap() {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width: 16, height: 16, close: () => {} })),
  );
}

beforeEach(() => {
  mock.reset();
  vi.clearAllMocks();
  stubImageBitmap();
});

describe("importUtabExport — happy path", () => {
  it("creates subfolders and bookmarks with their icons attached", async () => {
    const json = JSON.stringify({
      folders: [
        {
          name: "Work",
          preview: pngDataUrl(),
          bookmarks: [
            {
              title: "Alpha",
              url: "https://alpha.example",
              preview: pngDataUrl(),
            },
            { title: "Beta", url: "https://beta.example" },
          ],
        },
      ],
    });

    const result = await importUtabExport("1", json);

    expect(result).toEqual({
      ok: true,
      summary: { foldersCreated: 1, bookmarksCreated: 2, skipped: 0 },
    });

    const subfolder = (await getSubfolders("1"))[0]!;
    expect(subfolder.title).toBe("Work");
    expect(await getIcon(subfolder.id)).toBeDefined();
    expect((await getFolderSettings(subfolder.id)).hasCustomIcon).toBe(true);

    const bookmarks = await getBookmarksInFolder(subfolder.id);
    expect(bookmarks.map((b) => b.title)).toEqual(["Alpha", "Beta"]);
    expect(bookmarks.map((b) => b.url)).toEqual([
      "https://alpha.example",
      "https://beta.example",
    ]);
    const [alpha, beta] = bookmarks as [
      chrome.bookmarks.BookmarkTreeNode,
      chrome.bookmarks.BookmarkTreeNode,
    ];
    // Alpha had a preview; Beta did not.
    expect(await getIcon(alpha.id)).toBeDefined();
    expect((await getBookmarkSettings(alpha.id)).hasCustomIcon).toBe(true);
    expect(await getIcon(beta.id)).toBeUndefined();
    expect((await getBookmarkSettings(beta.id)).hasCustomIcon).toBe(false);
  });
});

describe("importUtabExport — skip and report", () => {
  it("skips blank folder names (with their bookmarks), blank titles, and unsafe urls, importing valid siblings", async () => {
    const json = JSON.stringify({
      folders: [
        {
          name: "   ",
          bookmarks: [{ title: "Orphan", url: "https://orphan.example" }],
        },
        {
          name: "Good",
          bookmarks: [
            { title: "", url: "https://blank-title.example" },
            { title: "Danger", url: "javascript:alert(1)" },
            { title: "Keep", url: "https://keep.example" },
          ],
        },
      ],
    });

    const result = await importUtabExport("1", json);

    // Blank folder = 1 + its 1 bookmark = 2 skipped; blank title + unsafe url = 2 more.
    expect(result).toEqual({
      ok: true,
      summary: { foldersCreated: 1, bookmarksCreated: 1, skipped: 4 },
    });

    const subfolders = await getSubfolders("1");
    expect(subfolders.map((f) => f.title)).toEqual(["Good"]);
    const bookmarks = await getBookmarksInFolder(subfolders[0]!.id);
    expect(bookmarks.map((b) => b.title)).toEqual(["Keep"]);
  });
});

describe("importUtabExport — icon fallback", () => {
  it("imports the folder/bookmark but skips the icon when the preview is missing, non-data-url, or invalid", async () => {
    const json = JSON.stringify({
      folders: [
        {
          name: "Fallbacks",
          preview: "https://remote.example/folder.png",
          bookmarks: [
            { title: "NoPreview", url: "https://a.example" },
            {
              title: "BadPreview",
              url: "https://b.example",
              preview: "data:image/png;base64,zzzz",
            },
          ],
        },
      ],
    });

    const result = await importUtabExport("1", json);

    expect(result).toEqual({
      ok: true,
      summary: { foldersCreated: 1, bookmarksCreated: 2, skipped: 0 },
    });

    const subfolder = (await getSubfolders("1"))[0]!;
    expect(await getIcon(subfolder.id)).toBeUndefined();
    expect((await getFolderSettings(subfolder.id)).hasCustomIcon).toBe(false);

    const bookmarks = await getBookmarksInFolder(subfolder.id);
    for (const bookmark of bookmarks) {
      expect(await getIcon(bookmark.id)).toBeUndefined();
      expect((await getBookmarkSettings(bookmark.id)).hasCustomIcon).toBe(
        false,
      );
    }
  });
});

describe("importUtabExport — structural rejection", () => {
  it("rejects non-JSON and creates nothing", async () => {
    const result = await importUtabExport("1", "not json {");
    expect(result).toEqual({ ok: false, error: "invalid-json" });
    expect(await getSubfolders("1")).toEqual([]);
    expect(mock.chrome.bookmarks.create).not.toHaveBeenCalled();
  });

  it("rejects JSON without a folders array and creates nothing", async () => {
    const result = await importUtabExport("1", JSON.stringify({ foo: 1 }));
    expect(result).toEqual({ ok: false, error: "not-utab" });
    expect(await getSubfolders("1")).toEqual([]);
    expect(mock.chrome.bookmarks.create).not.toHaveBeenCalled();
  });
});

describe("importUtabExport — no de-duplication", () => {
  it("creates a fresh set on every import of the same file", async () => {
    const json = JSON.stringify({
      folders: [
        {
          name: "Dup",
          bookmarks: [{ title: "One", url: "https://one.example" }],
        },
      ],
    });

    await importUtabExport("1", json);
    await importUtabExport("1", json);

    const subfolders = await getSubfolders("1");
    expect(subfolders.map((f) => f.title)).toEqual(["Dup", "Dup"]);
    expect(subfolders[0]!.id).not.toBe(subfolders[1]!.id);
  });
});
