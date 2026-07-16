import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_FOLDER_ICON_KEY,
  seedDefaultFolderIcon,
} from "./defaultFolderIcon";
import { deleteIcon, getIcon } from "./iconDb";

// The bundled asset import resolves to a URL string under Vite; the network
// fetch of it is stubbed so the seed's byte source is deterministic in tests.
function stubFetch(bytes = "default-folder-png") {
  const fetchMock = vi.fn(async () => ({
    blob: async () => new Blob([bytes], { type: "image/png" }),
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(async () => {
  await deleteIcon(DEFAULT_FOLDER_ICON_KEY);
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("seedDefaultFolderIcon", () => {
  it("seeds the default icon when none is stored", async () => {
    const fetchMock = stubFetch("seed-bytes");

    await seedDefaultFolderIcon();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const stored = await getIcon(DEFAULT_FOLDER_ICON_KEY);
    expect(stored).toBeDefined();
    expect(await stored?.text()).toBe("seed-bytes");
    expect(stored?.type).toBe("image/png");
  });

  it("no-ops (no fetch, no overwrite) when the default icon already exists", async () => {
    stubFetch("first");
    await seedDefaultFolderIcon();
    expect(await (await getIcon(DEFAULT_FOLDER_ICON_KEY))?.text()).toBe(
      "first",
    );

    const secondFetch = stubFetch("second");
    await seedDefaultFolderIcon();

    expect(secondFetch).not.toHaveBeenCalled();
    const stored = await getIcon(DEFAULT_FOLDER_ICON_KEY);
    expect(await stored?.text()).toBe("first");
  });

  it("uses a key that cannot collide with numeric Chrome bookmark ids", () => {
    expect(DEFAULT_FOLDER_ICON_KEY).not.toMatch(/^\d+$/);
  });
});
