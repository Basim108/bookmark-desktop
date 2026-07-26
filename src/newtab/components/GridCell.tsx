import { useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";

interface GridCellProps {
  cellKey: string;
  /** The tier icon size. Sizes the highlight surface only — the cell's own width comes from its (space-absorbing) column track. */
  size: number;
  /** Whether this cell holds a bookmark — gates the plain-hover highlight/cursor, which shouldn't apply to empty cells. */
  occupied: boolean;
  children?: ReactNode;
}

/**
 * The cell spans its full column track, which is wider than the icon wherever
 * leftover canvas width got distributed. That deliberately splits three
 * concerns that used to coincide when a cell was exactly one icon wide:
 *
 * - droppable area: the whole track (no dead strips between columns)
 * - hover/drag-over hit area: the whole track (what lights up == what accepts
 *   a drop; a target that gives no feedback is worse than a highlight smaller
 *   than its hit area)
 * - painted highlight: a tier-sized square, centred — see the inner surface
 *
 * Hence the inner surface: with the highlight on the cell itself, adjacent
 * highlights would be separated only by the gap and a hovered row would read
 * as one continuous bar rather than discrete icons. The surface is rendered
 * for empty cells too, since drag-over highlights those as drop targets.
 */
export function GridCell({ cellKey, size, occupied, children }: GridCellProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: cellKey,
    data: { type: "cell" },
  });

  return (
    <div
      ref={setNodeRef}
      className={`grid-cell${occupied ? " grid-cell--occupied" : ""}${isOver ? " grid-cell--over" : ""}`}
      style={{ height: size }}
    >
      <div className="grid-cell-surface" style={{ width: size, height: size }}>
        {children}
      </div>
    </div>
  );
}
