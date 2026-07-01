import { useRef } from "react";

export type EdgeDirection = -1 | 0 | 1;

/** Which page-turn direction, if any, a dragged icon's rect is currently hovering near. */
export function computeEdgeDirection(
  draggedRect: { left: number; right: number },
  containerRect: { left: number; right: number },
  threshold: number,
): EdgeDirection {
  if (draggedRect.left < containerRect.left + threshold) {
    return -1;
  }
  if (draggedRect.right > containerRect.right - threshold) {
    return 1;
  }
  return 0;
}

const DEFAULT_THRESHOLD_PX = 40;
const DEFAULT_HOLD_MS = 600;

/**
 * Drag-to-edge auto-advance pagination (Launchpad/iOS-style): holding a
 * dragged icon near the canvas edge advances to the adjacent page after a
 * short delay. Re-entering the same edge doesn't restart the timer;
 * leaving it (or reaching a page with no further neighbor) cancels it.
 */
export function useEdgePagination(
  onAdvance: (direction: EdgeDirection) => void,
  options: { thresholdPx?: number; holdMs?: number } = {},
) {
  const thresholdPx = options.thresholdPx ?? DEFAULT_THRESHOLD_PX;
  const holdMs = options.holdMs ?? DEFAULT_HOLD_MS;
  const activeEdgeRef = useRef<EdgeDirection>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimer() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function handleDragMove(
    draggedRect: { left: number; right: number },
    containerRect: { left: number; right: number },
  ) {
    const edge = computeEdgeDirection(draggedRect, containerRect, thresholdPx);
    if (edge === activeEdgeRef.current) {
      return;
    }
    activeEdgeRef.current = edge;
    clearTimer();
    if (edge !== 0) {
      timerRef.current = setTimeout(() => {
        onAdvance(edge);
      }, holdMs);
    }
  }

  function reset() {
    activeEdgeRef.current = 0;
    clearTimer();
  }

  return { handleDragMove, reset };
}
