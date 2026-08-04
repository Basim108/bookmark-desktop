import { pointerWithin, rectIntersection } from "@dnd-kit/core";
import type { CollisionDetection } from "@dnd-kit/core";
import { isGapLiveFor, type GapDropData } from "../lib/bookmarks/reorderSlot";

/**
 * Resolve the drop target by the pointer's position first, falling back to
 * rectangle-intersection only when the pointer is over no droppable. The
 * default (rectIntersection alone) targets whichever droppable the dragged
 * element's *rectangle* overlaps most — unreliable when a large bookmark
 * icon (up to 166px) is dragged over the stack of ~22px sidebar folder rows,
 * where the icon rect overlaps several rows and can resolve to the wrong
 * folder even though the cursor is squarely inside the intended one. The
 * fallback preserves forgiving canvas-cell drops (e.g. onto a grid gap).
 *
 * Sidebar reorder gaps are then applied on top, in two steps:
 *
 * 1. **Drop gaps that aren't live for this drag.** Every gap is mounted and
 *    enabled at all times so dnd-kit measures it reliably (see FolderDropGap),
 *    which means the ones that don't apply have to be filtered out here.
 *    Removing them rather than disabling them is what lets the pointer fall
 *    through to the row beneath, so that row shows its normal reparent
 *    highlight instead of leaving a dead zone.
 * 2. **Let a surviving gap win outright.** A gap strip straddles the edge of
 *    the row it is anchored to, so near a boundary the pointer is inside both.
 *    Without an explicit winner the row wash and the insert line would show at
 *    once, which reads as broken.
 */
export const collisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  const collisions =
    pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args);

  const activeData = args.active.data.current as
    { type?: string; sourceParentId?: string } | undefined;
  const activeId = String(args.active.id);

  let firstLiveGap: (typeof collisions)[number] | undefined;
  const withoutDeadGaps = collisions.filter((collision) => {
    const data = args.droppableContainers.find(
      (container) => container.id === collision.id,
    )?.data.current as (GapDropData & { type?: string }) | undefined;
    if (data?.type !== "folder-gap") {
      return true;
    }
    const live =
      activeData?.type === "folder" &&
      isGapLiveFor(data, activeId, activeData.sourceParentId);
    if (live && !firstLiveGap) {
      firstLiveGap = collision;
    }
    return live;
  });

  return firstLiveGap ? [firstLiveGap] : withoutDeadGaps;
};
