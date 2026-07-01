import { beforeEach, describe, expect, it } from "vitest";
import { installChromeMock } from "../../test/chromeMock";
import {
  DEFAULT_BOOKMARK_SETTINGS,
  getBookmarkSettings,
  removeBookmarkSettings,
  setBookmarkHasCustomIcon,
  setBookmarkLabelDisplay,
} from "./bookmarkSettings";

const mock = installChromeMock();

beforeEach(() => {
  mock.reset();
});

describe("getBookmarkSettings", () => {
  it("returns the default (under-icon label, no icon) when nothing is stored", async () => {
    expect(await getBookmarkSettings("b1")).toEqual(DEFAULT_BOOKMARK_SETTINGS);
  });
});

describe("setBookmarkLabelDisplay", () => {
  it("stores the label display mode independently per bookmark", async () => {
    await setBookmarkLabelDisplay("b1", "tooltip");
    await setBookmarkLabelDisplay("b2", "under-icon");

    expect((await getBookmarkSettings("b1")).labelDisplay).toBe("tooltip");
    expect((await getBookmarkSettings("b2")).labelDisplay).toBe("under-icon");
  });
});

describe("setBookmarkHasCustomIcon", () => {
  it("updates the custom-icon flag without touching label display", async () => {
    await setBookmarkLabelDisplay("b1", "tooltip");
    await setBookmarkHasCustomIcon("b1", true);

    const settings = await getBookmarkSettings("b1");
    expect(settings.hasCustomIcon).toBe(true);
    expect(settings.labelDisplay).toBe("tooltip");
  });
});

describe("removeBookmarkSettings", () => {
  it("discards stored settings, reverting to defaults", async () => {
    await setBookmarkLabelDisplay("b1", "tooltip");
    await removeBookmarkSettings("b1");
    expect(await getBookmarkSettings("b1")).toEqual(DEFAULT_BOOKMARK_SETTINGS);
  });

  it("is a no-op when nothing is stored for that bookmark", async () => {
    await expect(removeBookmarkSettings("unknown")).resolves.toBeUndefined();
  });
});
