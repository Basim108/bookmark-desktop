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

    expect(result.ok && result.summary).toEqual({
      foldersCreated: 1,
      bookmarksCreated: 2,
      skipped: 0,
    });
    expect(result.ok && result.rows).toEqual([]);

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
  it("skips only unusable urls, defaulting blank names rather than dropping them", async () => {
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

    // The blank folder name and the blank bookmark title both fall back now, so
    // the unsafe url is the only entry left that cannot be imported.
    expect(result.ok && result.summary).toEqual({
      foldersCreated: 2,
      bookmarksCreated: 3,
      skipped: 1,
    });

    const subfolders = await getSubfolders("1");
    expect(subfolders.map((f) => f.title)).toEqual(["New Folder", "Good"]);
    expect(
      (await getBookmarksInFolder(subfolders[0]!.id)).map((b) => b.title),
    ).toEqual(["Orphan"]);
    expect(
      (await getBookmarksInFolder(subfolders[1]!.id)).map((b) => b.title),
    ).toEqual(["https://blank-title.example", "Keep"]);
  });
});

describe("importUtabExport — empty uTab slots", () => {
  it("ignores an entry with no url, in every form the absence takes", async () => {
    const json = JSON.stringify({
      folders: [
        {
          name: "Slots",
          bookmarks: [
            { title: "Keep", url: "https://keep.example" },
            { _id: "s1" },
            { _id: "s2", title: "", url: "" },
            { _id: "s3", url: "   " },
            { _id: "s4", url: 42 },
          ],
        },
      ],
    });

    const result = await importUtabExport("1", json);

    expect(result.ok && result.summary).toEqual({
      foldersCreated: 1,
      bookmarksCreated: 1,
      skipped: 0,
    });
    expect(result.ok && result.rows).toEqual([]);

    const bookmarks = await getBookmarksInFolder(
      (await getSubfolders("1"))[0]!.id,
    );
    expect(bookmarks.map((b) => b.title)).toEqual(["Keep"]);
  });

  it("reports nothing at all when every unimported entry is a slot", async () => {
    const json = JSON.stringify({
      folders: [{ name: "AllSlots", bookmarks: [{}, {}, {}] }],
    });

    const result = await importUtabExport("1", json);

    expect(result.ok && result.summary).toEqual({
      foldersCreated: 1,
      bookmarksCreated: 0,
      skipped: 0,
    });
    expect(result.ok && result.rows).toEqual([]);
  });

  it("still skips and reports an entry whose url is present but unusable", async () => {
    const json = JSON.stringify({
      folders: [
        {
          name: "Boundary",
          bookmarks: [
            { _id: "s1" },
            { _id: "b1", title: "", url: "https://blank-title.example" },
            { _id: "b2", title: "Danger", url: "javascript:alert(1)" },
            { _id: "b3", title: "Scheme Less", url: "google.com" },
          ],
        },
      ],
    });

    const result = await importUtabExport("1", json);

    // b1 has a usable url, so its blank title falls back rather than skipping;
    // only the two unusable urls remain skips. The slot is not an entry at all.
    expect(result.ok && result.summary.skipped).toBe(2);
    expect(result.ok && result.rows.map((r) => [r.id, r.reason])).toEqual([
      ["b2", "unsafe-url"],
      ["b3", "unsafe-url"],
    ]);
    expect(result.ok && result.summary.bookmarksCreated).toBe(1);
  });

  it("ignores slots inside a blank-named folder, which is itself defaulted rather than dropped", async () => {
    const json = JSON.stringify({
      folders: [
        {
          _id: "f1",
          name: "   ",
          bookmarks: [
            { _id: "s1" },
            { _id: "s2", url: "" },
            { _id: "b1", title: "Orphan", url: "https://orphan.example" },
          ],
        },
      ],
    });

    const result = await importUtabExport("1", json);

    expect(result.ok && result.summary).toEqual({
      foldersCreated: 1,
      bookmarksCreated: 1,
      skipped: 0,
    });
    expect(result.ok && result.rows).toEqual([]);
    const subfolder = (await getSubfolders("1"))[0]!;
    expect(subfolder.title).toBe("New Folder");
    expect(
      (await getBookmarksInFolder(subfolder.id)).map((b) => b.title),
    ).toEqual(["Orphan"]);
  });
});

describe("importUtabExport — blank folder names", () => {
  it('imports a folder with a blank name as "New Folder"', async () => {
    const json = JSON.stringify({
      folders: [
        { _id: "f1", name: "", bookmarks: [] },
        { _id: "f2", name: "   ", bookmarks: [] },
      ],
    });

    const result = await importUtabExport("1", json);

    expect(result.ok && result.summary).toEqual({
      foldersCreated: 2,
      bookmarksCreated: 0,
      skipped: 0,
    });
    expect(result.ok && result.rows).toEqual([]);
    expect((await getSubfolders("1")).map((f) => f.title)).toEqual([
      "New Folder",
      "New Folder",
    ]);
  });

  it("keeps a blank-named folder's bookmarks instead of dropping the subtree", async () => {
    const json = JSON.stringify({
      folders: [
        {
          name: " ",
          bookmarks: [
            { title: "Kept", url: "https://kept.example" },
            { title: "AlsoKept", url: "https://also.example" },
          ],
        },
      ],
    });

    const result = await importUtabExport("1", json);

    expect(result.ok && result.summary).toEqual({
      foldersCreated: 1,
      bookmarksCreated: 2,
      skipped: 0,
    });
    const subfolder = (await getSubfolders("1"))[0]!;
    expect(subfolder.title).toBe("New Folder");
    expect(
      (await getBookmarksInFolder(subfolder.id)).map((b) => b.title),
    ).toEqual(["Kept", "AlsoKept"]);
  });
});

describe("importUtabExport — blank bookmark titles", () => {
  it("imports a blank-titled bookmark under its full url, shown only as a tooltip", async () => {
    const json = JSON.stringify({
      folders: [
        {
          name: "Rescued",
          bookmarks: [
            { _id: "b1", title: "", url: "https://example.com/deep/path?a=1" },
            { _id: "b2", title: "   ", url: "https://example.com/other" },
          ],
        },
      ],
    });

    const result = await importUtabExport("1", json);

    expect(result.ok && result.summary).toEqual({
      foldersCreated: 1,
      bookmarksCreated: 2,
      skipped: 0,
    });
    expect(result.ok && result.rows).toEqual([]);

    const bookmarks = await getBookmarksInFolder(
      (await getSubfolders("1"))[0]!.id,
    );
    expect(bookmarks.map((b) => b.title)).toEqual([
      "https://example.com/deep/path?a=1",
      "https://example.com/other",
    ]);
    for (const bookmark of bookmarks) {
      expect((await getBookmarkSettings(bookmark.id)).labelDisplay).toBe(
        "tooltip",
      );
    }
  });

  it("keeps entries that differ only by path distinguishable", async () => {
    const json = JSON.stringify({
      folders: [
        {
          name: "Same Host",
          bookmarks: [
            { title: "", url: "https://host.example/jira/boards/1" },
            { title: "", url: "https://host.example/wiki/pages/2" },
          ],
        },
      ],
    });

    const result = await importUtabExport("1", json);

    const titles = (
      await getBookmarksInFolder((await getSubfolders("1"))[0]!.id)
    ).map((b) => b.title);
    expect(result.ok && result.summary.bookmarksCreated).toBe(2);
    expect(new Set(titles).size).toBe(2);
    expect(titles).toEqual([
      "https://host.example/jira/boards/1",
      "https://host.example/wiki/pages/2",
    ]);
  });

  it("leaves a bookmark that has a real title at the default label display", async () => {
    const json = JSON.stringify({
      folders: [
        {
          name: "Named",
          bookmarks: [{ title: "Real Title", url: "https://real.example" }],
        },
      ],
    });

    await importUtabExport("1", json);

    const bookmark = (
      await getBookmarksInFolder((await getSubfolders("1"))[0]!.id)
    )[0]!;
    expect(bookmark.title).toBe("Real Title");
    expect((await getBookmarkSettings(bookmark.id)).labelDisplay).toBe(
      "under-icon",
    );
  });

  it("does not let the fallback smuggle an unsafe url past the safety check", async () => {
    const json = JSON.stringify({
      folders: [
        {
          name: "Unsafe",
          bookmarks: [
            { _id: "b1", title: "", url: "javascript:alert(1)" },
            { _id: "b2", title: "", url: "google.com" },
          ],
        },
      ],
    });

    const result = await importUtabExport("1", json);

    expect(result.ok && result.summary.bookmarksCreated).toBe(0);
    expect(result.ok && result.summary.skipped).toBe(2);
    expect(result.ok && result.rows.map((r) => [r.id, r.reason])).toEqual([
      ["b1", "unsafe-url"],
      ["b2", "unsafe-url"],
    ]);
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

    expect(result.ok && result.summary).toEqual({
      foldersCreated: 1,
      bookmarksCreated: 2,
      skipped: 0,
    });
    // The folder's remote-url preview and the bookmark's undecodable one were
    // both present but unusable, so each is a warning; NoPreview had none.
    expect(result.ok && result.rows.map((r) => [r.status, r.title])).toEqual([
      ["warning", "Fallbacks"],
      ["warning", "BadPreview"],
    ]);

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

describe("importUtabExport — report rows", () => {
  it("records no rows for a clean import", async () => {
    const json = JSON.stringify({
      folders: [
        {
          name: "Clean",
          bookmarks: [{ title: "One", url: "https://one.example" }],
        },
      ],
    });

    const result = await importUtabExport("1", json);

    expect(result.ok).toBe(true);
    expect(result.ok && result.rows).toEqual([]);
  });

  it("records a skipped row per dropped entry, carrying the uTab _id", async () => {
    const json = JSON.stringify({
      folders: [
        {
          name: "Good",
          bookmarks: [
            { _id: "u1", title: "", url: "javascript:void(0)" },
            { _id: "u2", title: "Danger", url: "javascript:alert(1)" },
            { _id: "u3", title: "Keep", url: "https://keep.example" },
          ],
        },
      ],
    });

    const result = await importUtabExport("1", json);

    expect(result.ok && result.rows).toEqual([
      {
        status: "skipped",
        id: "u1",
        folder: "Good",
        // The entry's own blank title, not the url substituted for it: the row
        // points back at the source file, not at what would have been created.
        title: "",
        url: "javascript:void(0)",
        reason: "unsafe-url",
      },
      {
        status: "skipped",
        id: "u2",
        folder: "Good",
        title: "Danger",
        url: "javascript:alert(1)",
        reason: "unsafe-url",
      },
    ]);
  });

  it("records a warning for an unusable preview while still creating the item", async () => {
    const json = JSON.stringify({
      folders: [
        {
          name: "Icons",
          bookmarks: [
            {
              _id: "b1",
              title: "BadPreview",
              url: "https://b.example",
              preview: "data:image/png;base64,zzzz",
            },
          ],
        },
      ],
    });

    const result = await importUtabExport("1", json);

    expect(result.ok && result.summary).toEqual({
      foldersCreated: 1,
      bookmarksCreated: 1,
      skipped: 0,
    });
    expect(result.ok && result.rows).toEqual([
      {
        status: "warning",
        id: "b1",
        folder: "Icons",
        title: "BadPreview",
        url: "https://b.example",
        reason: "icon-failed",
      },
    ]);

    const bookmarks = await getBookmarksInFolder(
      (await getSubfolders("1"))[0]!.id,
    );
    expect(bookmarks.map((b) => b.title)).toEqual(["BadPreview"]);
  });

  it("records no row for an absent preview", async () => {
    const json = JSON.stringify({
      folders: [
        {
          name: "NoIcons",
          bookmarks: [{ title: "Plain", url: "https://a.example" }],
        },
      ],
    });

    const result = await importUtabExport("1", json);

    expect(result.ok && result.rows).toEqual([]);
  });

  it("ends with a fatal row and keeps rows recorded before the failure", async () => {
    const json = JSON.stringify({
      folders: [
        {
          name: "Partial",
          bookmarks: [
            { _id: "b1", title: "Danger", url: "javascript:alert(1)" },
            { _id: "b2", title: "Boom", url: "https://boom.example" },
            { _id: "b3", title: "Never", url: "https://never.example" },
          ],
        },
      ],
    });
    // First create() is the folder, second is the skipped-url bookmark (never
    // reached), so let the folder through and fail the next real create.
    const create = mock.chrome.bookmarks.create;
    const original = create.getMockImplementation()!;
    let calls = 0;
    create.mockImplementation(async (arg: chrome.bookmarks.CreateDetails) => {
      calls += 1;
      if (calls === 2) throw new Error("QUOTA_BYTES quota exceeded");
      return original(arg);
    });

    const result = await importUtabExport("1", json);

    expect(result.ok).toBe(true);
    const rows = result.ok ? result.rows : [];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ status: "skipped", id: "b1" });
    expect(rows[1]!.status).toBe("fatal");
    expect(rows[1]!.error).toContain("QUOTA_BYTES quota exceeded");
    // The folder created before the failure is still reported as created.
    expect(result.ok && result.summary.foldersCreated).toBe(1);
    expect(result.ok && result.summary.bookmarksCreated).toBe(0);
  });

  it("returns no rows for a structurally rejected file", async () => {
    const invalid = await importUtabExport("1", "not json {");
    expect(invalid).toEqual({ ok: false, error: "invalid-json" });
    const notUtab = await importUtabExport("1", JSON.stringify({ foo: 1 }));
    expect(notUtab).toEqual({ ok: false, error: "not-utab" });
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
