import { beforeEach, describe, expect, it } from "vitest";
import { installChromeMock } from "../../test/chromeMock";
import {
  DEFAULT_FOLDER_SETTINGS,
  getFolderSettings,
  removeFolderSettings,
  replaceAllFolderSettings,
  setFolderHasCustomIcon,
} from "./folderSettings";

const mock = installChromeMock();

beforeEach(() => {
  mock.reset();
});

describe("getFolderSettings", () => {
  it("returns the default (no custom icon) when nothing is stored", async () => {
    expect(await getFolderSettings("f1")).toEqual(DEFAULT_FOLDER_SETTINGS);
  });
});

describe("setFolderHasCustomIcon", () => {
  it("records that a folder has a custom icon", async () => {
    await setFolderHasCustomIcon("f1", true);
    expect((await getFolderSettings("f1")).hasCustomIcon).toBe(true);
  });

  it("clears the custom-icon flag", async () => {
    await setFolderHasCustomIcon("f1", true);
    await setFolderHasCustomIcon("f1", false);
    expect((await getFolderSettings("f1")).hasCustomIcon).toBe(false);
  });
});

describe("removeFolderSettings", () => {
  it("discards a folder's stored settings", async () => {
    await setFolderHasCustomIcon("f1", true);
    await removeFolderSettings("f1");
    expect(await getFolderSettings("f1")).toEqual(DEFAULT_FOLDER_SETTINGS);
  });
});

describe("replaceAllFolderSettings", () => {
  it("replaces the stored map rather than merging into it", async () => {
    await setFolderHasCustomIcon("old", true);

    await replaceAllFolderSettings({ new: { hasCustomIcon: true } });

    expect(await getFolderSettings("new")).toEqual({ hasCustomIcon: true });
    expect(await getFolderSettings("old")).toEqual(DEFAULT_FOLDER_SETTINGS);
  });

  it("empties the store when given an empty map", async () => {
    await setFolderHasCustomIcon("a", true);
    await replaceAllFolderSettings({});
    expect(await getFolderSettings("a")).toEqual(DEFAULT_FOLDER_SETTINGS);
  });
});
