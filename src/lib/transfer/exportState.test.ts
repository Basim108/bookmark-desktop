import { beforeEach, describe, expect, it } from "vitest";
import { blobToDataUrl } from "../import/dataUrl";
import { putCanvasBackground } from "../storage/canvasBackground";
import { putIcon } from "../storage/iconDb";
import { setStorageValue } from "../storage/local";
import { STORAGE_KEYS } from "../storage/schema";
import { setSidebarWidth } from "../storage/sidebarSettings";
import { installChromeMock } from "../../test/chromeMock";
import { exportState } from "./exportState";
import { EXPORT_FORMAT_VERSION } from "./version";

const mock = installChromeMock();

function folder(id: string, parentId: string, title: string, index: number) {
  return { id, parentId, title, index, syncing: false } as const;
}
function bookmark(
  id: string,
  parentId: string,
  title: string,
  url: string,
  index: number,
) {
  return { id, parentId, title, url, index, syncing: false } as const;
}

beforeEach(() => {
  mock.reset();
});

describe("exportState", () => {
  it("serializes the tree, settings, positions, icons, and general block id-free", async () => {
    // Roots under synthetic "0"; a folder in the bar with one bookmark.
    mock.addNode(folder("1", "0", "Bookmarks Bar", 0));
    mock.addNode(folder("2", "0", "Other Bookmarks", 1));
    mock.addNode(folder("exp-work", "1", "Work", 0));
    mock.addNode(
      bookmark("exp-docs", "exp-work", "Docs", "https://docs.example", 0),
    );

    await setStorageValue(STORAGE_KEYS.POSITIONS, {
      "exp-work": { "exp-docs": { page: 0, row: 1, col: 2 } },
    });
    await setStorageValue(STORAGE_KEYS.BOOKMARK_SETTINGS, {
      "exp-docs": { labelDisplay: "tooltip", hasCustomIcon: true },
    });
    await setStorageValue(STORAGE_KEYS.FOLDER_SETTINGS, {
      "exp-work": { hasCustomIcon: true },
    });
    await setSidebarWidth(280);

    const folderIcon = new Blob(["FOLDER"], { type: "image/png" });
    const bmIcon = new Blob(["BOOKMARK"], { type: "image/webp" });
    const background = new Blob(["BG"], { type: "image/jpeg" });
    await putIcon("exp-work", folderIcon);
    await putIcon("exp-docs", bmIcon);
    await putCanvasBackground(background);

    const result = await exportState();

    expect(result.version).toBe(EXPORT_FORMAT_VERSION);
    // No Chrome ids anywhere as keys — top level is keyed by protected roots.
    expect(Object.keys(result.roots)).toEqual(["1", "2"]);
    // Each root records its live display title.
    expect(result.roots["1"]!.title).toBe("Bookmarks Bar");
    expect(result.roots["2"]!.title).toBe("Other Bookmarks");

    const work = result.roots["1"]!.children[0]!;
    expect(work).toMatchObject({
      type: "folder",
      title: "Work",
      settings: { hasCustomIcon: true },
      icon: await blobToDataUrl(folderIcon),
    });

    const docs = (work as { children: unknown[] }).children[0]!;
    expect(docs).toEqual({
      type: "bookmark",
      title: "Docs",
      url: "https://docs.example",
      position: { page: 0, row: 1, col: 2 },
      settings: { labelDisplay: "tooltip", hasCustomIcon: true },
      icon: await blobToDataUrl(bmIcon),
    });

    expect(result.general.sidebarWidth).toBe(280);
    expect(result.general.canvasBackgroundIcon).toBe(
      await blobToDataUrl(background),
    );
    expect(result.general.defaultFolderIcon).toBeNull();
  });

  it("defaults settings/position/icon when nothing is stored", async () => {
    mock.addNode(folder("1", "0", "Bookmarks Bar", 0));
    mock.addNode(
      bookmark("exp-plain", "1", "Plain", "https://plain.example", 0),
    );

    const result = await exportState();

    expect(result.roots["1"]!.children[0]).toEqual({
      type: "bookmark",
      title: "Plain",
      url: "https://plain.example",
      position: null,
      settings: { labelDisplay: "under-icon", hasCustomIcon: false },
      icon: null,
    });
  });

  it("does not export the last opened folder", async () => {
    // Session state describing where one machine's user was last working —
    // carrying it into a file would restore a stale cursor position on
    // whatever profile the file is imported into.
    mock.addNode(folder("1", "0", "Bookmarks Bar", 0));
    mock.addNode(folder("exp-work", "1", "Work", 0));
    await setStorageValue(STORAGE_KEYS.LAST_FOLDER_ID, "exp-work");

    const result = await exportState();

    expect(JSON.stringify(result)).not.toContain("lastFolderId");
    expect(result.general).not.toHaveProperty("lastFolderId");
  });

  it("does not export the measured grid capacity", async () => {
    // Same class of reason as the last opened folder: derived from one
    // machine's window and display geometry, not a setting the user chose.
    // Restoring it onto another profile would make that profile place
    // bookmarks against a grid its canvas does not have — the exact defect
    // persisting the measurement exists to prevent.
    mock.addNode(folder("1", "0", "Bookmarks Bar", 0));
    await setStorageValue(STORAGE_KEYS.GRID_CAPACITY, { cols: 9, rows: 5 });

    const result = await exportState();

    expect(JSON.stringify(result)).not.toContain("gridCapacity");
    expect(result.general).not.toHaveProperty("gridCapacity");
  });
});
