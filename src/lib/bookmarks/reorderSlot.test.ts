import { describe, expect, it } from "vitest";
import { isGapLiveFor, isNoOpSlot, resolveSlotIndex } from "./reorderSlot";

function folder(id: string): chrome.bookmarks.BookmarkTreeNode {
  return { id, parentId: "p", index: 0, title: id, syncing: false };
}

function bookmark(id: string): chrome.bookmarks.BookmarkTreeNode {
  return {
    id,
    parentId: "p",
    index: 0,
    title: id,
    syncing: false,
    url: `https://example.com/${id}`,
  };
}

/** children: [bm-a] [F1] [bm-b] [F2] [F3] — sidebar shows F1, F2, F3 only. */
const interleaved = [
  bookmark("bm-a"),
  folder("F1"),
  bookmark("bm-b"),
  folder("F2"),
  folder("F3"),
];

describe("resolveSlotIndex", () => {
  it("anchors to the following subfolder's own child index, not its visible position", () => {
    // F2 is the 2nd *visible* subfolder but the 4th child.
    expect(
      resolveSlotIndex(interleaved, { kind: "before", subfolderId: "F2" }),
    ).toBe(3);
  });

  it("maps the first slot to the first subfolder's child index", () => {
    // Not 0 — a bookmark precedes F1, and it stays ahead of the insertion.
    expect(
      resolveSlotIndex(interleaved, { kind: "before", subfolderId: "F1" }),
    ).toBe(1);
  });

  it("maps the end slot to the parent's child count", () => {
    expect(resolveSlotIndex(interleaved, { kind: "end" })).toBe(5);
  });

  it("appends when the anchor has vanished from the children", () => {
    expect(
      resolveSlotIndex(interleaved, { kind: "before", subfolderId: "gone" }),
    ).toBe(5);
  });

  it("handles a parent whose children are all subfolders", () => {
    const children = [folder("F1"), folder("F2"), folder("F3")];
    expect(
      resolveSlotIndex(children, { kind: "before", subfolderId: "F1" }),
    ).toBe(0);
    expect(
      resolveSlotIndex(children, { kind: "before", subfolderId: "F3" }),
    ).toBe(2);
    expect(resolveSlotIndex(children, { kind: "end" })).toBe(3);
  });

  /**
   * Guards the trap documented on resolveSlotIndex: Chrome reads `index`
   * against the pre-removal child list, so the anchor's current index is
   * correct in BOTH directions and must not be adjusted. These assertions fail
   * the moment someone "corrects" the apparent off-by-one on downward moves.
   */
  describe("no adjustment is applied in either direction", () => {
    const children = [folder("A"), folder("B"), folder("C"), folder("D")];

    it("moving later passes the anchor's index unchanged", () => {
      // Drag A onto the gap before C. Chrome inserts at pre-removal index 2,
      // yielding BACD — A does precede C.
      expect(
        resolveSlotIndex(children, { kind: "before", subfolderId: "C" }),
      ).toBe(2);
    });

    it("moving earlier passes the anchor's index unchanged", () => {
      // Drag D onto the gap before B: index 1, yielding ADBC.
      expect(
        resolveSlotIndex(children, { kind: "before", subfolderId: "B" }),
      ).toBe(1);
    });
  });
});

describe("isNoOpSlot", () => {
  it("flags the gap immediately before the folder itself", () => {
    expect(
      isNoOpSlot(interleaved, "F2", { kind: "before", subfolderId: "F2" }),
    ).toBe(true);
  });

  it("flags the gap immediately after the folder", () => {
    // The gap after F1 is the "before F2" gap — F2 is F1's next subfolder
    // sibling, even though a bookmark sits between them.
    expect(
      isNoOpSlot(interleaved, "F1", { kind: "before", subfolderId: "F2" }),
    ).toBe(true);
  });

  it("flags the end slot for a folder that is already last", () => {
    expect(isNoOpSlot(interleaved, "F3", { kind: "end" })).toBe(true);
  });

  it("does not flag the end slot for a folder that is not last", () => {
    expect(isNoOpSlot(interleaved, "F1", { kind: "end" })).toBe(false);
  });

  it("does not flag a genuine move", () => {
    expect(
      isNoOpSlot(interleaved, "F3", { kind: "before", subfolderId: "F1" }),
    ).toBe(false);
    expect(
      isNoOpSlot(interleaved, "F1", { kind: "before", subfolderId: "F3" }),
    ).toBe(false);
  });

  it("returns false for a folder that is not among the children", () => {
    expect(isNoOpSlot(interleaved, "other", { kind: "end" })).toBe(false);
  });
});

/**
 * The sidebar shows, under parent "p": F1, F2, F3. Its gaps are therefore
 *   before-F1 (previous: none)
 *   before-F2 (previous: F1)
 *   before-F3 (previous: F2)
 *   end       (previous: F3)
 */
describe("isGapLiveFor", () => {
  const gaps = {
    beforeF1: {
      gapParentId: "p",
      slot: { kind: "before", subfolderId: "F1" },
      previousSubfolderId: undefined,
    },
    beforeF2: {
      gapParentId: "p",
      slot: { kind: "before", subfolderId: "F2" },
      previousSubfolderId: "F1",
    },
    beforeF3: {
      gapParentId: "p",
      slot: { kind: "before", subfolderId: "F3" },
      previousSubfolderId: "F2",
    },
    end: {
      gapParentId: "p",
      slot: { kind: "end" },
      previousSubfolderId: "F3",
    },
  } as const;

  it("offers only the non-adjacent gaps of the dragged folder's own parent", () => {
    // Dragging F1: its own before-gap and the gap after it (before-F2) do
    // nothing; the rest are live.
    expect(isGapLiveFor(gaps.beforeF1, "F1", "p")).toBe(false);
    expect(isGapLiveFor(gaps.beforeF2, "F1", "p")).toBe(false);
    expect(isGapLiveFor(gaps.beforeF3, "F1", "p")).toBe(true);
    expect(isGapLiveFor(gaps.end, "F1", "p")).toBe(true);
  });

  it("treats the end gap as a no-op for the folder already last", () => {
    expect(isGapLiveFor(gaps.beforeF1, "F3", "p")).toBe(true);
    expect(isGapLiveFor(gaps.beforeF2, "F3", "p")).toBe(true);
    expect(isGapLiveFor(gaps.beforeF3, "F3", "p")).toBe(false);
    expect(isGapLiveFor(gaps.end, "F3", "p")).toBe(false);
  });

  it("offers nothing under a parent the dragged folder does not belong to", () => {
    for (const gap of Object.values(gaps)) {
      expect(isGapLiveFor(gap, "elsewhere", "other-parent")).toBe(false);
    }
  });

  it("offers nothing when the dragged folder's parent is unknown", () => {
    expect(isGapLiveFor(gaps.beforeF1, "F3", undefined)).toBe(false);
  });

  it("offers nothing for a gap missing its slot or parent data", () => {
    expect(isGapLiveFor({ gapParentId: "p", slot: undefined }, "F1", "p")).toBe(
      false,
    );
    expect(
      isGapLiveFor(
        { gapParentId: undefined, slot: { kind: "end" } },
        "F1",
        "p",
      ),
    ).toBe(false);
  });
});
