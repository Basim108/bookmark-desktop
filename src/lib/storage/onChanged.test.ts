import { beforeEach, describe, expect, it, vi } from "vitest";
import { installChromeMock } from "../../test/chromeMock";
import { onStorageKeysChanged } from "./onChanged";
import { setStorageValue } from "./local";
import { STORAGE_KEYS } from "./schema";

const mock = installChromeMock();

beforeEach(() => {
  mock.reset();
});

describe("onStorageKeysChanged", () => {
  it("invokes the callback when one of the watched keys changes", async () => {
    const callback = vi.fn();
    onStorageKeysChanged([STORAGE_KEYS.FOLDER_SETTINGS], callback);

    await setStorageValue(STORAGE_KEYS.FOLDER_SETTINGS, {
      f1: { sidebarDisplay: "label-only", hasCustomIcon: false },
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("ignores changes to keys that aren't being watched", async () => {
    const callback = vi.fn();
    onStorageKeysChanged([STORAGE_KEYS.FOLDER_SETTINGS], callback);

    await setStorageValue(STORAGE_KEYS.GLOBAL_GRID_SETTINGS, {
      mode: "auto",
      maxIconSize: 96,
      minIconSize: 48,
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it("stops receiving events after unsubscribing", async () => {
    const callback = vi.fn();
    const unsubscribe = onStorageKeysChanged(
      [STORAGE_KEYS.FOLDER_SETTINGS],
      callback,
    );
    unsubscribe();

    await setStorageValue(STORAGE_KEYS.FOLDER_SETTINGS, {
      f1: { sidebarDisplay: "label-only", hasCustomIcon: false },
    });

    expect(callback).not.toHaveBeenCalled();
  });
});
