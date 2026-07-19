import { describe, expect, it } from "vitest";
import {
  CANVAS_BACKGROUND_KEY,
  DEFAULT_FOLDER_ICON_KEY,
  deleteIcon,
  getIcon,
  pruneIconsExcept,
  putIcon,
} from "./iconDb";

describe("iconDb", () => {
  it("returns undefined for an item with no stored icon", async () => {
    expect(await getIcon("no-such-item")).toBeUndefined();
  });

  it("stores and retrieves an icon's bytes", async () => {
    const blob = new Blob(["fake-png-bytes"], { type: "image/png" });
    await putIcon("item-1", blob);

    const stored = await getIcon("item-1");
    expect(stored).toBeDefined();
    expect(stored?.type).toBe("image/png");
    expect(await stored?.text()).toBe("fake-png-bytes");
  });

  it("overwrites a previously stored icon for the same item", async () => {
    await putIcon("item-2", new Blob(["first"], { type: "image/png" }));
    await putIcon("item-2", new Blob(["second"], { type: "image/webp" }));

    const stored = await getIcon("item-2");
    expect(await stored?.text()).toBe("second");
    expect(stored?.type).toBe("image/webp");
  });

  it("deletes a stored icon", async () => {
    await putIcon("item-3", new Blob(["bytes"], { type: "image/png" }));
    await deleteIcon("item-3");
    expect(await getIcon("item-3")).toBeUndefined();
  });
});

describe("pruneIconsExcept", () => {
  it("keeps the icons in the keep-set and deletes the rest", async () => {
    await putIcon("keep-1", new Blob(["a"], { type: "image/png" }));
    await putIcon("keep-2", new Blob(["b"], { type: "image/png" }));
    await putIcon("drop-1", new Blob(["c"], { type: "image/png" }));
    await putIcon("drop-2", new Blob(["d"], { type: "image/png" }));

    await pruneIconsExcept(new Set(["keep-1", "keep-2"]));

    expect(await getIcon("keep-1")).toBeDefined();
    expect(await getIcon("keep-2")).toBeDefined();
    expect(await getIcon("drop-1")).toBeUndefined();
    expect(await getIcon("drop-2")).toBeUndefined();
  });

  // The prune's callers pass live bookmark/folder ids and must not have to
  // remember the globals — a reserved key deleted here is a user's canvas
  // background or shared folder icon silently vanishing on import.
  it("preserves the reserved global keys even when absent from the keep-set", async () => {
    await putIcon(DEFAULT_FOLDER_ICON_KEY, new Blob(["folder"]));
    await putIcon(CANVAS_BACKGROUND_KEY, new Blob(["background"]));
    await putIcon("orphan", new Blob(["gone"]));

    await pruneIconsExcept(new Set());

    expect(await getIcon(DEFAULT_FOLDER_ICON_KEY)).toBeDefined();
    expect(await getIcon(CANVAS_BACKGROUND_KEY)).toBeDefined();
    expect(await getIcon("orphan")).toBeUndefined();
  });

  it("deletes everything unreserved when the keep-set is empty", async () => {
    await putIcon("a", new Blob(["a"]));
    await putIcon("b", new Blob(["b"]));

    await pruneIconsExcept(new Set());

    expect(await getIcon("a")).toBeUndefined();
    expect(await getIcon("b")).toBeUndefined();
  });

  it("tolerates keep-set ids that have no stored record", async () => {
    await putIcon("real", new Blob(["real"]));

    await pruneIconsExcept(new Set(["real", "never-stored"]));

    expect(await getIcon("real")).toBeDefined();
  });
});
