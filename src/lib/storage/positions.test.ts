import { beforeEach, describe, expect, it } from "vitest";
import { installChromeMock } from "../../test/chromeMock";
import {
  getAllPositions,
  getFolderPositions,
  replaceAllPositions,
  setBookmarkPosition,
  setBookmarkPositions,
} from "./positions";

const mock = installChromeMock();

beforeEach(() => {
  mock.reset();
});

describe("setBookmarkPositions", () => {
  it("applies multiple updates in a single read-modify-write", async () => {
    await setBookmarkPosition("f1", "a", 0);
    await setBookmarkPosition("f1", "b", 1);

    // Swap a and b.
    await setBookmarkPositions("f1", [
      { bookmarkId: "a", slot: 1 },
      { bookmarkId: "b", slot: 0 },
    ]);

    expect(await getFolderPositions("f1")).toEqual({ a: 1, b: 0 });
  });

  it("leaves positions for other bookmarks in the folder untouched", async () => {
    await setBookmarkPosition("f1", "a", 0);
    await setBookmarkPosition("f1", "c", 3);

    await setBookmarkPositions("f1", [{ bookmarkId: "a", slot: 2 }]);

    expect(await getFolderPositions("f1")).toEqual({ a: 2, c: 3 });
  });
});

describe("replaceAllPositions", () => {
  it("replaces the stored map rather than merging into it", async () => {
    await setBookmarkPosition("old-folder", "old-bookmark", 0);

    await replaceAllPositions({ "new-folder": { "new-bookmark": 5 } });

    expect(await getAllPositions()).toEqual({
      "new-folder": { "new-bookmark": 5 },
    });
    expect(await getFolderPositions("old-folder")).toEqual({});
  });

  it("empties the store when given an empty map", async () => {
    await setBookmarkPosition("f1", "a", 0);
    await replaceAllPositions({});
    expect(await getAllPositions()).toEqual({});
  });
});
