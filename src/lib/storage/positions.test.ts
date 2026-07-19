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
    await setBookmarkPosition("f1", "a", { page: 0, row: 0, col: 0 });
    await setBookmarkPosition("f1", "b", { page: 0, row: 0, col: 1 });

    // Swap a and b.
    await setBookmarkPositions("f1", [
      { bookmarkId: "a", cell: { page: 0, row: 0, col: 1 } },
      { bookmarkId: "b", cell: { page: 0, row: 0, col: 0 } },
    ]);

    expect(await getFolderPositions("f1")).toEqual({
      a: { page: 0, row: 0, col: 1 },
      b: { page: 0, row: 0, col: 0 },
    });
  });

  it("leaves positions for other bookmarks in the folder untouched", async () => {
    await setBookmarkPosition("f1", "a", { page: 0, row: 0, col: 0 });
    await setBookmarkPosition("f1", "c", { page: 0, row: 1, col: 0 });

    await setBookmarkPositions("f1", [
      { bookmarkId: "a", cell: { page: 0, row: 0, col: 2 } },
    ]);

    expect(await getFolderPositions("f1")).toEqual({
      a: { page: 0, row: 0, col: 2 },
      c: { page: 0, row: 1, col: 0 },
    });
  });
});

describe("replaceAllPositions", () => {
  it("replaces the stored map rather than merging into it", async () => {
    await setBookmarkPosition("old-folder", "old-bookmark", {
      page: 0,
      row: 0,
      col: 0,
    });

    await replaceAllPositions({
      "new-folder": { "new-bookmark": { page: 0, row: 1, col: 2 } },
    });

    expect(await getAllPositions()).toEqual({
      "new-folder": { "new-bookmark": { page: 0, row: 1, col: 2 } },
    });
    expect(await getFolderPositions("old-folder")).toEqual({});
  });

  it("empties the store when given an empty map", async () => {
    await setBookmarkPosition("f1", "a", { page: 0, row: 0, col: 0 });
    await replaceAllPositions({});
    expect(await getAllPositions()).toEqual({});
  });
});
