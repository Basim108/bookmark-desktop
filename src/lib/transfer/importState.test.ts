import { beforeEach, describe, expect, it, vi } from "vitest";
import { installChromeMock } from "../../test/chromeMock";
import { getBookmarksInFolder, getSubfolders } from "../bookmarks/read";
import {
  getBookmarkSettings,
  setBookmarkLabelDisplay,
} from "../storage/bookmarkSettings";
import { getCanvasBackground } from "../storage/canvasBackground";
import { DEFAULT_FOLDER_ICON_KEY } from "../storage/defaultFolderIcon";
import { setFolderHasCustomIcon } from "../storage/folderSettings";
import { getIcon, putIcon } from "../storage/iconDb";
import { getStorageValue } from "../storage/local";
import { getFolderPositions, setFolderPositions } from "../storage/positions";
import { STORAGE_KEYS } from "../storage/schema";
import { getSidebarWidth } from "../storage/sidebarSettings";
import { EXPORT_FORMAT_VERSION, parseVersion } from "./version";
import { importState } from "./importState";
import type { ExportFileV1 } from "./types";

const mock = installChromeMock();
const currentMajor = parseVersion(EXPORT_FORMAT_VERSION)!.major;

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
function pngDataUrl(): string {
  return `data:image/png;base64,${btoa(String.fromCharCode(...PNG_HEADER))}`;
}
function stubImageBitmap() {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width: 16, height: 16, close: () => {} })),
  );
}

function root(id: string, title: string, index: number) {
  return { id, parentId: "0", title, index, syncing: false } as const;
}

/** Seeds the three protected roots under "0". */
function seedRoots() {
  mock.addNode(root("1", "Bookmarks Bar", 0));
  mock.addNode(root("2", "Other Bookmarks", 1));
  mock.addNode(root("3", "Mobile Bookmarks", 2));
}

function baseFile(overrides: Partial<ExportFileV1> = {}): ExportFileV1 {
  return {
    version: EXPORT_FORMAT_VERSION,
    roots: {},
    general: {
      sidebarWidth: 240,
      generalSettings: { background: { kind: "none" } },
      canvasBackgroundIcon: null,
      defaultFolderIcon: null,
    },
    ...overrides,
  };
}

beforeEach(() => {
  mock.reset();
  vi.clearAllMocks();
  stubImageBitmap();
});

describe("importState — denials (nothing changes)", () => {
  it("denies non-JSON", async () => {
    expect(await importState("{not json")).toEqual({
      ok: false,
      denied: "invalid-json",
    });
  });

  it("denies a missing/garbage version", async () => {
    expect(await importState(JSON.stringify({ roots: {} }))).toEqual({
      ok: false,
      denied: "invalid-version",
    });
  });

  it("denies a lower major as too-old", async () => {
    const file = baseFile({ version: `${currentMajor - 1}.0.0` });
    expect(await importState(JSON.stringify(file))).toEqual({
      ok: false,
      denied: "too-old",
    });
  });

  it("denies a higher major as too-new", async () => {
    const file = baseFile({ version: `${currentMajor + 1}.0.0` });
    expect(await importState(JSON.stringify(file))).toEqual({
      ok: false,
      denied: "too-new",
    });
  });

  it("does not delete anything on a denial", async () => {
    seedRoots();
    mock.addNode({
      id: "keep",
      parentId: "1",
      title: "Keep",
      url: "https://k",
      index: 0,
      syncing: false,
    });
    await importState("not json");
    expect((await getBookmarksInFolder("1")).map((b) => b.id)).toEqual([
      "keep",
    ]);
  });
});

describe("importState — replace strategy", () => {
  it("removes all pre-existing non-root content and recreates the file tree under the right roots", async () => {
    seedRoots();
    // Pre-existing content that must be wiped.
    mock.addNode({
      id: "old-f",
      parentId: "1",
      title: "Old",
      index: 0,
      syncing: false,
    });
    mock.addNode({
      id: "old-b",
      parentId: "old-f",
      title: "OldBm",
      url: "https://old",
      index: 0,
      syncing: false,
    });

    const file = baseFile({
      roots: {
        "1": {
          title: "Bookmarks Bar",
          children: [
            {
              type: "folder",
              title: "Work",
              settings: { hasCustomIcon: false },
              icon: null,
              children: [
                {
                  type: "bookmark",
                  title: "Docs",
                  url: "https://docs.example",
                  position: { page: 0, row: 1, col: 2 },
                  settings: { labelDisplay: "tooltip", hasCustomIcon: false },
                  icon: null,
                },
              ],
            },
          ],
        },
        "2": {
          title: "Other Bookmarks",
          children: [
            {
              type: "bookmark",
              title: "Direct",
              url: "https://direct.example",
              position: null,
              settings: { labelDisplay: "under-icon", hasCustomIcon: false },
              icon: null,
            },
          ],
        },
      },
    });

    const result = await importState(JSON.stringify(file));

    expect(result).toMatchObject({
      ok: true,
      foldersCreated: 1,
      bookmarksCreated: 2,
    });
    // Roots survive; old content gone.
    expect(await getSubfolders("1")).toHaveLength(1);
    const work = (await getSubfolders("1"))[0]!;
    expect(work.title).toBe("Work");
    expect(mock.chrome.bookmarks.get).not.toBeUndefined();
    const docs = (await getBookmarksInFolder(work.id))[0]!;
    expect(docs).toMatchObject({ title: "Docs", url: "https://docs.example" });
    const direct = (await getBookmarksInFolder("2"))[0]!;
    expect(direct.title).toBe("Direct");
  });

  it("restores positions, settings, and icons under the new ids", async () => {
    seedRoots();
    const file = baseFile({
      roots: {
        "1": {
          title: "Bookmarks Bar",
          children: [
            {
              type: "folder",
              title: "Work",
              settings: { hasCustomIcon: true },
              icon: pngDataUrl(),
              children: [
                {
                  type: "bookmark",
                  title: "Docs",
                  url: "https://docs.example",
                  position: { page: 1, row: 2, col: 3 },
                  settings: { labelDisplay: "tooltip", hasCustomIcon: true },
                  icon: pngDataUrl(),
                },
              ],
            },
          ],
        },
      },
    });

    await importState(JSON.stringify(file));

    const work = (await getSubfolders("1"))[0]!;
    const docs = (await getBookmarksInFolder(work.id))[0]!;

    expect(await getFolderPositions(work.id)).toEqual({
      [docs.id]: { page: 1, row: 2, col: 3 },
    });
    expect(await getBookmarkSettings(docs.id)).toEqual({
      labelDisplay: "tooltip",
      hasCustomIcon: true,
    });
    expect(await getIcon(work.id)).toBeDefined();
    expect(await getIcon(docs.id)).toBeDefined();
  });
});

describe("importState — general block", () => {
  it("restores sidebar width, general settings, and sets/clears global images", async () => {
    seedRoots();
    // Pre-seed a background that the file (null) should clear.
    await putIcon(
      "__canvas_background__",
      new Blob(["OLD"], { type: "image/png" }),
    );

    const file = baseFile({
      general: {
        sidebarWidth: 321,
        generalSettings: { background: { kind: "upload", fit: "contain" } },
        canvasBackgroundIcon: null,
        defaultFolderIcon: pngDataUrl(),
      },
    });

    await importState(JSON.stringify(file));

    expect(await getSidebarWidth()).toBe(321);
    expect(await getStorageValue(STORAGE_KEYS.GENERAL_SETTINGS)).toEqual({
      background: { kind: "upload", fit: "contain" },
    });
    expect(await getCanvasBackground()).toBeUndefined(); // cleared
    expect(await getIcon(DEFAULT_FOLDER_ICON_KEY)).toBeDefined(); // set
  });
});

describe("importState — skip and report", () => {
  it("skips blank titles and unsafe urls with correct path + reason, and carries a folder's descendants", async () => {
    seedRoots();
    const file = baseFile({
      roots: {
        "1": {
          title: "Bookmarks Bar",
          children: [
            // Bad bookmark: unsafe url.
            {
              type: "bookmark",
              title: "Evil",
              url: "javascript:alert(1)",
              position: null,
              settings: { labelDisplay: "under-icon", hasCustomIcon: false },
              icon: null,
            },
            // Bad folder: empty title → its child is parent-skipped.
            {
              type: "folder",
              title: "   ",
              settings: { hasCustomIcon: false },
              icon: null,
              children: [
                {
                  type: "bookmark",
                  title: "Orphan",
                  url: "https://orphan.example",
                  position: null,
                  settings: {
                    labelDisplay: "under-icon",
                    hasCustomIcon: false,
                  },
                  icon: null,
                },
              ],
            },
            // Good folder with a good bookmark.
            {
              type: "folder",
              title: "Good",
              settings: { hasCustomIcon: false },
              icon: null,
              children: [
                {
                  type: "bookmark",
                  title: "Fine",
                  url: "https://fine.example",
                  position: null,
                  settings: {
                    labelDisplay: "under-icon",
                    hasCustomIcon: false,
                  },
                  icon: null,
                },
              ],
            },
          ],
        },
      },
    });

    const result = await importState(JSON.stringify(file));

    expect(result).toMatchObject({
      ok: true,
      foldersCreated: 1,
      bookmarksCreated: 1,
    });
    if (!result.ok) throw new Error("expected ok");
    expect(result.skipped).toEqual([
      {
        absoluteFolderPath: "Bookmarks Bar",
        name: "Evil",
        url: "javascript:alert(1)",
        reason: "unsafe-url",
      },
      {
        absoluteFolderPath: "Bookmarks Bar",
        name: "   ",
        url: null,
        reason: "empty-title",
      },
      {
        absoluteFolderPath: "Bookmarks Bar/   ",
        name: "Orphan",
        url: "https://orphan.example",
        reason: "parent-skipped",
      },
    ]);
    // The good folder still imported.
    expect((await getSubfolders("1")).map((f) => f.title)).toEqual(["Good"]);
  });

  it("keeps an item whose icon fails validation, falling back without a skip", async () => {
    seedRoots();
    const file = baseFile({
      roots: {
        "1": {
          title: "Bookmarks Bar",
          children: [
            {
              type: "bookmark",
              title: "NoIcon",
              url: "https://noicon.example",
              position: null,
              settings: { labelDisplay: "under-icon", hasCustomIcon: true },
              icon: "data:image/png;base64,not-a-real-image",
            },
          ],
        },
      },
    });

    const result = await importState(JSON.stringify(file));

    expect(result).toMatchObject({ ok: true, bookmarksCreated: 1 });
    if (!result.ok) throw new Error("expected ok");
    expect(result.skipped).toEqual([]);
    const bm = (await getBookmarksInFolder("1"))[0]!;
    expect(await getIcon(bm.id)).toBeUndefined(); // fell back
    expect((await getBookmarkSettings(bm.id)).hasCustomIcon).toBe(false);
  });
});

describe("importState — root titles and missing roots", () => {
  it("uses the file's root title (not a constant) for a skipped entry's path", async () => {
    seedRoots();
    const file = baseFile({
      roots: {
        "1": {
          title: "My Custom Bar",
          children: [
            {
              type: "bookmark",
              title: "Evil",
              url: "javascript:alert(1)",
              position: null,
              settings: { labelDisplay: "under-icon", hasCustomIcon: false },
              icon: null,
            },
          ],
        },
      },
    });

    const result = await importState(JSON.stringify(file));

    if (!result.ok) throw new Error("expected ok");
    expect(result.skipped[0]?.absoluteFolderPath).toBe("My Custom Bar");
  });

  it("reports (does not silently drop or crash) a root whose creation fails", async () => {
    seedRoots();
    // Simulate Chrome refusing to create into an unavailable Mobile root "3".
    mock.chrome.bookmarks.create.mockImplementationOnce(async () => {
      throw new Error("Can't find bookmark for id.");
    });

    const file = baseFile({
      roots: {
        "3": {
          title: "Mobile Bookmarks",
          children: [
            {
              type: "bookmark",
              title: "Phone",
              url: "https://phone.example",
              position: null,
              settings: { labelDisplay: "under-icon", hasCustomIcon: false },
              icon: null,
            },
          ],
        },
      },
    });

    const result = await importState(JSON.stringify(file));

    // Import completes; the unreachable root's subtree is reported, not dropped.
    expect(result).toMatchObject({ ok: true, bookmarksCreated: 0 });
    if (!result.ok) throw new Error("expected ok");
    expect(result.skipped).toEqual([
      {
        absoluteFolderPath: "Mobile Bookmarks",
        name: "Phone",
        url: "https://phone.example",
        reason: "root-unavailable",
      },
    ]);
  });

  it("still recreates a present root's contents (title from the file)", async () => {
    seedRoots();
    const file = baseFile({
      roots: {
        "3": {
          title: "Mobile Bookmarks",
          children: [
            {
              type: "bookmark",
              title: "Phone",
              url: "https://phone.example",
              position: null,
              settings: { labelDisplay: "under-icon", hasCustomIcon: false },
              icon: null,
            },
          ],
        },
      },
    });

    const result = await importState(JSON.stringify(file));

    expect(result).toMatchObject({ ok: true, bookmarksCreated: 1 });
    expect((await getBookmarksInFolder("3")).map((b) => b.title)).toEqual([
      "Phone",
    ]);
  });

  it("creates the new children before deleting the old ones (create-before-delete)", async () => {
    seedRoots();
    mock.addNode({
      id: "old-1",
      parentId: "1",
      title: "Old",
      index: 0,
      syncing: false,
    });
    const file = baseFile({
      roots: {
        "1": {
          title: "Bookmarks Bar",
          children: [
            {
              type: "folder",
              title: "New",
              settings: { hasCustomIcon: false },
              icon: null,
              children: [],
            },
          ],
        },
      },
    });

    await importState(JSON.stringify(file));

    // The new folder was created before the old one was removed.
    const create = mock.chrome.bookmarks.create;
    const removeTree = mock.chrome.bookmarks.removeTree;
    expect(create.mock.invocationCallOrder[0]).toBeLessThan(
      removeTree.mock.invocationCallOrder[0]!,
    );
    // Old content is gone; only the restored content remains.
    expect((await getSubfolders("1")).map((f) => f.title)).toEqual(["New"]);
  });

  it("reports a genuinely absent root (getChildren throws) without attempting creation", async () => {
    seedRoots();
    const original = mock.chrome.bookmarks.getChildren.getMockImplementation()!;
    mock.chrome.bookmarks.getChildren.mockImplementation(async (id: string) => {
      if (id === "3") throw new Error("Can't find bookmark for id.");
      return original(id);
    });

    const file = baseFile({
      roots: {
        "3": {
          title: "Mobile Bookmarks",
          children: [
            {
              type: "bookmark",
              title: "Phone",
              url: "https://phone.example",
              position: null,
              settings: { labelDisplay: "under-icon", hasCustomIcon: false },
              icon: null,
            },
          ],
        },
      },
    });

    try {
      const result = await importState(JSON.stringify(file));

      expect(result).toMatchObject({ ok: true, bookmarksCreated: 0 });
      if (!result.ok) throw new Error("expected ok");
      expect(result.skipped[0]?.reason).toBe("root-unavailable");
      // Never tried to create into the absent root.
      expect(mock.chrome.bookmarks.create).not.toHaveBeenCalled();
    } finally {
      mock.chrome.bookmarks.getChildren.mockImplementation(original);
    }
  });
});

describe("importState — hooks", () => {
  it("aborts before any change when confirmImport returns cancel", async () => {
    seedRoots();
    mock.addNode({
      id: "keep",
      parentId: "1",
      title: "Keep",
      url: "https://k",
      index: 0,
      syncing: false,
    });

    const result = await importState(JSON.stringify(baseFile()), {
      confirmImport: () => "cancel",
    });

    expect(result).toEqual({ ok: false, aborted: true });
    expect((await getBookmarksInFolder("1")).map((b) => b.id)).toEqual([
      "keep",
    ]);
  });

  it("runs performBackup only when confirmImport returns backup, after the gate", async () => {
    seedRoots();
    const performBackup = vi.fn(async () => {});
    await importState(JSON.stringify(baseFile()), {
      confirmImport: () => "backup",
      performBackup,
    });
    expect(performBackup).toHaveBeenCalledOnce();

    performBackup.mockClear();
    await importState(JSON.stringify(baseFile()), {
      confirmImport: () => "no-backup",
      performBackup,
    });
    expect(performBackup).not.toHaveBeenCalled();
  });

  it("does not confirm or back up a denied (bad) file", async () => {
    const confirmImport = vi.fn(() => "backup" as const);
    const performBackup = vi.fn(async () => {});
    await importState("garbage", { confirmImport, performBackup });
    expect(confirmImport).not.toHaveBeenCalled();
    expect(performBackup).not.toHaveBeenCalled();
  });
});

describe("importState — the replaced tree's stored data does not survive", () => {
  /** A file placing one bookmark (with icon + tooltip setting) under the bar. */
  function fileWithOneBookmark() {
    return baseFile({
      roots: {
        "1": {
          title: "Bookmarks Bar",
          children: [
            {
              type: "bookmark",
              title: "Kept",
              url: "https://kept.example",
              position: { page: 0, row: 0, col: 0 },
              settings: { labelDisplay: "tooltip", hasCustomIcon: true },
              icon: pngDataUrl(),
            },
          ],
        },
      },
    });
  }

  it("prunes positions, settings, and icon blobs belonging to the replaced tree", async () => {
    seedRoots();
    // An existing tree with stored data of every kind, as a real profile would
    // have. These ids are deleted by the import; under the transfer lock the
    // onRemoved cleanup stands down, so the importer must collect them.
    const oldId = "old-bm";
    mock.addNode({
      id: oldId,
      parentId: "1",
      title: "Old",
      url: "https://old.example",
      index: 0,
      syncing: false,
    });
    await setFolderPositions("1", { [oldId]: { page: 3, row: 3, col: 3 } });
    await setBookmarkLabelDisplay(oldId, "tooltip");
    await setFolderHasCustomIcon("old-folder", true);
    await putIcon(oldId, new Blob(["old-icon"], { type: "image/png" }));

    await importState(JSON.stringify(fileWithOneBookmark()));

    const kept = (await getBookmarksInFolder("1"))[0]!;

    // Nothing keyed by the replaced tree's ids remains, in any store.
    const positions = await getStorageValue(STORAGE_KEYS.POSITIONS);
    expect(JSON.stringify(positions)).not.toContain(oldId);
    expect(
      await getStorageValue(STORAGE_KEYS.BOOKMARK_SETTINGS),
    ).not.toHaveProperty(oldId);
    expect(
      await getStorageValue(STORAGE_KEYS.FOLDER_SETTINGS),
    ).not.toHaveProperty("old-folder");
    expect(await getIcon(oldId)).toBeUndefined();

    // ...while everything the import wrote is intact.
    expect(await getFolderPositions("1")).toEqual({
      [kept.id]: { page: 0, row: 0, col: 0 },
    });
    expect(await getBookmarkSettings(kept.id)).toEqual({
      labelDisplay: "tooltip",
      hasCustomIcon: true,
    });
    expect(await getIcon(kept.id)).toBeDefined();
  });

  it("does not accumulate across repeated imports", async () => {
    seedRoots();
    const text = JSON.stringify(fileWithOneBookmark());

    await importState(text);
    const afterFirst = {
      positions: await getStorageValue(STORAGE_KEYS.POSITIONS),
      bookmarkSettings: await getStorageValue(STORAGE_KEYS.BOOKMARK_SETTINGS),
      folderSettings: await getStorageValue(STORAGE_KEYS.FOLDER_SETTINGS),
    };

    await importState(text);
    await importState(text);
    const afterThird = {
      positions: await getStorageValue(STORAGE_KEYS.POSITIONS),
      bookmarkSettings: await getStorageValue(STORAGE_KEYS.BOOKMARK_SETTINGS),
      folderSettings: await getStorageValue(STORAGE_KEYS.FOLDER_SETTINGS),
    };

    // Ids differ between runs, but the shape must not grow.
    expect(Object.keys(afterThird.positions ?? {})).toHaveLength(
      Object.keys(afterFirst.positions ?? {}).length,
    );
    expect(Object.keys(afterThird.bookmarkSettings ?? {})).toHaveLength(
      Object.keys(afterFirst.bookmarkSettings ?? {}).length,
    );
    expect(Object.keys(afterThird.folderSettings ?? {})).toHaveLength(
      Object.keys(afterFirst.folderSettings ?? {}).length,
    );
  });

  it("preserves the reserved global icon keys through the sweep", async () => {
    seedRoots();
    await importState(
      JSON.stringify(
        baseFile({
          roots: {
            "1": { title: "Bookmarks Bar", children: [] },
          },
          general: {
            sidebarWidth: 240,
            generalSettings: { background: { kind: "none" } },
            canvasBackgroundIcon: pngDataUrl(),
            defaultFolderIcon: pngDataUrl(),
          },
        }),
      ),
    );

    // The sweep runs with an empty keep-set here (no per-item icons), so this
    // is the case where a missing reserved-key exemption would wipe both.
    expect(await getCanvasBackground()).toBeDefined();
    expect(await getIcon(DEFAULT_FOLDER_ICON_KEY)).toBeDefined();
  });

  it("does not prune live data when a root is unavailable in this profile", async () => {
    // Only the bar exists; the file also carries content for Mobile ("3"),
    // whose getChildren throws — the partial-failure path where a naive sweep
    // could prune against an incomplete keep-set.
    mock.addNode(root("1", "Bookmarks Bar", 0));
    const file = baseFile({
      roots: {
        "1": {
          title: "Bookmarks Bar",
          children: [
            {
              type: "bookmark",
              title: "Kept",
              url: "https://kept.example",
              position: { page: 0, row: 0, col: 0 },
              settings: { labelDisplay: "tooltip", hasCustomIcon: true },
              icon: pngDataUrl(),
            },
          ],
        },
        "3": {
          title: "Mobile Bookmarks",
          children: [
            {
              type: "bookmark",
              title: "Lost",
              url: "https://lost.example",
              position: null,
              settings: { labelDisplay: "under-icon", hasCustomIcon: false },
              icon: null,
            },
          ],
        },
      },
    });

    const result = await importState(JSON.stringify(file));

    expect(result.ok).toBe(true);
    const kept = (await getBookmarksInFolder("1"))[0]!;
    // The successfully created item keeps all of its restored state.
    expect(await getFolderPositions("1")).toEqual({
      [kept.id]: { page: 0, row: 0, col: 0 },
    });
    expect(await getBookmarkSettings(kept.id)).toEqual({
      labelDisplay: "tooltip",
      hasCustomIcon: true,
    });
    expect(await getIcon(kept.id)).toBeDefined();
  });
});

describe("importState — global image validation", () => {
  it("clears rather than stores a global image that fails validation", async () => {
    seedRoots();
    // Pre-seed both globals so a failure to clear would be visible.
    await putIcon(
      DEFAULT_FOLDER_ICON_KEY,
      new Blob(["old"], { type: "image/png" }),
    );
    await putIcon(
      "__canvas_background__",
      new Blob(["old"], { type: "image/png" }),
    );

    // Valid base64, decodable to a Blob, but not a supported image format —
    // the case that previously reached put() unchecked.
    const notAnImage = `data:image/png;base64,${btoa("not-image-bytes")}`;
    const result = await importState(
      JSON.stringify(
        baseFile({
          roots: { "1": { title: "Bookmarks Bar", children: [] } },
          general: {
            sidebarWidth: 240,
            generalSettings: { background: { kind: "none" } },
            canvasBackgroundIcon: notAnImage,
            defaultFolderIcon: notAnImage,
          },
        }),
      ),
    );

    // Import still succeeds — a bad global image must not abort the restore.
    expect(result.ok).toBe(true);
    expect(await getCanvasBackground()).toBeUndefined();
    expect(await getIcon(DEFAULT_FOLDER_ICON_KEY)).toBeUndefined();
  });
});
