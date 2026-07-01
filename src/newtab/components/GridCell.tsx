import { useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";

interface GridCellProps {
  cellKey: string;
  size: number;
  children?: ReactNode;
}

export function GridCell({ cellKey, size, children }: GridCellProps) {
  const { setNodeRef, isOver } = useDroppable({ id: cellKey });

  return (
    <div
      ref={setNodeRef}
      className={`grid-cell${isOver ? " grid-cell--over" : ""}`}
      style={{ width: size, height: size }}
    >
      {children}
    </div>
  );
}
