import { describe, expect, it } from "vitest";
import { collisionDetection } from "./collisionDetection";

/**
 * dnd-kit's collision detection is a pure function of the active drag and the
 * measured droppable rects, so it can be driven directly with synthetic
 * geometry — no DOM, no drag simulation.
 *
 * The layout below mirrors the real sidebar: a folder row with a gap strip
 * straddling its top edge, so a pointer near the boundary lands inside both.
 *
 *      y=0   ┌─ gap "before F2" (y 0..10) ─┐
 *      y=5   ├─ row F2        (y 5..35) ───┤
 *      y=35  └─────────────────────────────┘
 */
function rect(top: number, height: number) {
  return {
    top,
    bottom: top + height,
    left: 0,
    right: 200,
    width: 200,
    height,
  };
}

interface Droppable {
  id: string;
  top: number;
  height: number;
  data: Record<string, unknown>;
}

function buildArgs(
  droppables: Droppable[],
  pointer: { x: number; y: number },
  activeData: Record<string, unknown>,
  activeId = "F1",
) {
  const containers = droppables.map((d) => ({
    id: d.id,
    key: d.id,
    disabled: false,
    node: { current: null },
    rect: { current: rect(d.top, d.height) },
    data: { current: d.data },
  }));
  return {
    active: {
      id: activeId,
      data: { current: activeData },
      rect: { current: { initial: null, translated: rect(0, 30) } },
    },
    collisionRect: rect(pointer.y - 15, 30),
    droppableRects: new Map(
      droppables.map((d) => [d.id, rect(d.top, d.height)]),
    ),
    droppableContainers: containers,
    pointerCoordinates: pointer,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const rowF2: Droppable = {
  id: "F2",
  top: 5,
  height: 30,
  data: { type: "folder", folderId: "F2" },
};

const gapBeforeF2: Droppable = {
  id: "folder-gap-before-F2",
  top: 0,
  height: 10,
  data: {
    type: "folder-gap",
    gapParentId: "p",
    slot: { kind: "before", subfolderId: "F2" },
    previousSubfolderId: "F1",
  },
};

const gapBeforeF3: Droppable = {
  id: "folder-gap-before-F3",
  top: 0,
  height: 10,
  data: {
    type: "folder-gap",
    gapParentId: "p",
    slot: { kind: "before", subfolderId: "F3" },
    previousSubfolderId: "F2",
  },
};

describe("collisionDetection", () => {
  it("lets a live gap win outright over the row it overlaps", () => {
    // Dragging F1 over the gap before F3 — a real move, and the pointer is
    // inside both the gap strip and F2's row.
    const result = collisionDetection(
      buildArgs(
        [rowF2, gapBeforeF3],
        { x: 50, y: 7 },
        { type: "folder", sourceParentId: "p" },
      ),
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("folder-gap-before-F3");
  });

  it("falls through to the row beneath when the gap is adjacent to the dragged folder", () => {
    // The gap before F2 sits immediately after F1, so dropping there would
    // change nothing. It must not swallow the pointer.
    const result = collisionDetection(
      buildArgs(
        [rowF2, gapBeforeF2],
        { x: 50, y: 7 },
        { type: "folder", sourceParentId: "p" },
      ),
    );

    expect(result.map((c) => String(c.id))).toEqual(["F2"]);
  });

  it("falls through to the row beneath for a gap under a different parent", () => {
    const result = collisionDetection(
      buildArgs(
        [rowF2, gapBeforeF3],
        { x: 50, y: 7 },
        { type: "folder", sourceParentId: "somewhere-else" },
      ),
    );

    expect(result.map((c) => String(c.id))).toEqual(["F2"]);
  });

  it("offers no gap at all while a bookmark is being dragged", () => {
    const result = collisionDetection(
      buildArgs(
        [rowF2, gapBeforeF3],
        { x: 50, y: 7 },
        { type: "bookmark", sourceFolderId: "p" },
        "bookmark-1",
      ),
    );

    expect(result.map((c) => String(c.id))).toEqual(["F2"]);
  });

  it("still resolves plain folder rows when no gap is involved", () => {
    const result = collisionDetection(
      buildArgs(
        [rowF2],
        { x: 50, y: 20 },
        { type: "folder", sourceParentId: "p" },
      ),
    );

    expect(result.map((c) => String(c.id))).toEqual(["F2"]);
  });
});
