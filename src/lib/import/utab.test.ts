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
    expect(result.ok && result.summary).toEqual({
      foldersCreated: 1,
      bookmarksCreated: 1,
      skipped: 4,
    });

    const subfolders = await getSubfolders("1");
    expect(subfolders.map((f) => f.title)).toEqual(["Good"]);
    const bookmarks = await getBookmarksInFolder(subfolders[0]!.id);
    expect(bookmarks.map((b) => b.title)).toEqual(["Keep"]);
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

    expect(result.ok && result.summary.skipped).toBe(3);
    expect(result.ok && result.rows.map((r) => [r.id, r.reason])).toEqual([
      ["b1", "empty-title"],
      ["b2", "unsafe-url"],
      ["b3", "unsafe-url"],
    ]);
  });

  it("ignores slots orphaned by a blank-named folder, reporting only real entries", async () => {
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

    // The folder itself plus its one real bookmark — the two slots are not entries.
    expect(result.ok && result.summary.skipped).toBe(2);
    expect(result.ok && result.rows.map((r) => [r.id, r.reason])).toEqual([
      ["f1", "empty-title"],
      ["b1", "parent-skipped"],
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
            { _id: "u1", title: "", url: "https://blank-title.example" },
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
        title: "",
        url: "https://blank-title.example",
        reason: "empty-title",
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

  it("records a blank-name folder and its orphaned bookmarks, leaving the orphans' folder empty", async () => {
    const json = JSON.stringify({
      folders: [
        {
          _id: "f1",
          name: "   ",
          bookmarks: [
            { _id: "b1", title: "Orphan", url: "https://orphan.example" },
          ],
        },
      ],
    });

    const result = await importUtabExport("1", json);

    expect(result.ok && result.rows).toEqual([
      { status: "skipped", id: "f1", title: "   ", reason: "empty-title" },
      {
        status: "skipped",
        id: "b1",
        title: "Orphan",
        url: "https://orphan.example",
        reason: "parent-skipped",
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
