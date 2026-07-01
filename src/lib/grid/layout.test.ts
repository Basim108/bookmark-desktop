import { describe, expect, it } from "vitest";
import { paginate } from "./layout";

describe("paginate", () => {
  it("returns a single empty page when there are no positions", () => {
    expect(paginate({})).toEqual([[]]);
  });

  it("groups entries onto their stored page", () => {
    const pages = paginate({
      a: { page: 0, row: 0, col: 0 },
      b: { page: 1, row: 0, col: 0 },
    });
    expect(pages).toHaveLength(2);
    expect(pages[0]?.map((e) => e.bookmarkId)).toEqual(["a"]);
    expect(pages[1]?.map((e) => e.bookmarkId)).toEqual(["b"]);
  });

  it("sorts entries within a page in reading order (row-major)", () => {
    const pages = paginate({
      c: { page: 0, row: 0, col: 2 },
      a: { page: 0, row: 0, col: 0 },
      d: { page: 0, row: 1, col: 0 },
      b: { page: 0, row: 0, col: 1 },
    });
    expect(pages[0]?.map((e) => e.bookmarkId)).toEqual(["a", "b", "c", "d"]);
  });

  it("produces empty intermediate pages if a higher page number is referenced", () => {
    const pages = paginate({ a: { page: 2, row: 0, col: 0 } });
    expect(pages).toHaveLength(3);
    expect(pages[0]).toEqual([]);
    expect(pages[1]).toEqual([]);
    expect(pages[2]?.map((e) => e.bookmarkId)).toEqual(["a"]);
  });
});
