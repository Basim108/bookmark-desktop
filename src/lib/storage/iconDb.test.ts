import { describe, expect, it } from "vitest";
import { deleteIcon, getIcon, putIcon } from "./iconDb";

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
