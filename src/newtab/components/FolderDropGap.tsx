import { useDndContext, useDroppable } from "@dnd-kit/core";
import {
  isGapLiveFor,
  type ReorderSlot,
} from "../../lib/bookmarks/reorderSlot";

/** Row indent step, matching the per-depth padding folder rows use. */
const INDENT_STEP = 16;
/** Width of the expand-toggle column, which the row's icon starts after. */
const TOGGLE_WIDTH = 16;

interface FolderDropGapProps {
  /** The parent whose sibling list this gap is a slot in. */
  parentId: string | undefined;
  slot: ReorderSlot;
  /** The subfolder rendered immediately above this gap, if any. */
  previousSubfolderId: string | undefined;
  /** Depth of the sibling rows this gap sits among; sets the line's indent. */
  depth: number;
}

/**
 * A between-rows drop target that reorders a folder among its existing
 * siblings, keeping its parent — the counterpart to dropping onto a row, which
 * reparents.
 *
 * Mounted and enabled from first render, never conditionally on a drag: dnd-kit
 * measures droppables when a drag starts, so a gap that appeared (or enabled
 * itself) at that same moment could go unmeasured and be silently unhittable.
 * Liveness is applied a layer up instead, in App's collisionDetection, which
 * drops gaps that aren't slots for the folder being dragged so the pointer
 * falls through to the row beneath and that row offers its normal reparent
 * highlight.
 *
 * The element is inert to the pointer (`pointer-events: none`); dnd-kit resolves
 * drop targets from measured rects, not DOM hit-testing, so the gap needs a box
 * but never needs to intercept events from the row's own controls.
 */
export function FolderDropGap({
  parentId,
  slot,
  previousSubfolderId,
  depth,
}: FolderDropGapProps) {
  const { active } = useDndContext();
  const { setNodeRef, isOver } = useDroppable({
    id:
      slot.kind === "end"
        ? `folder-gap-end-${parentId}`
        : `folder-gap-before-${slot.subfolderId}`,
    data: {
      type: "folder-gap",
      gapParentId: parentId,
      slot,
      previousSubfolderId,
    },
  });

  // Belt and braces alongside the collision filter: even if a non-live gap were
  // ever reported as `over`, it must not draw an insert line promising a move
  // that resolveCrossFolderDrop will refuse.
  const activeData = active?.data.current as
    { type?: string; sourceParentId?: string } | undefined;
  const live =
    active !== null &&
    activeData?.type === "folder" &&
    isGapLiveFor(
      { gapParentId: parentId, slot, previousSubfolderId },
      String(active.id),
      activeData.sourceParentId,
    );

  return (
    <div ref={setNodeRef} className="folder-drop-gap" aria-hidden="true">
      {live && isOver && (
        <span
          className="folder-drop-line"
          style={{ left: depth * INDENT_STEP + TOGGLE_WIDTH }}
        />
      )}
    </div>
  );
}
