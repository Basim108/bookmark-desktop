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
 * short delay, and — while the icon stays at the same edge — keeps advancing
 * to successive pages one delay apart, so a single drag can cross several
 * pages (e.g. page 1 -> 2 -> 3). Leaving the edge cancels a pending advance.
 *
 * `onAdvance` returns whether a further advance in the same direction is
 * still possible; the hook re-arms only while it does, so paging halts on
 * its own at the first/last page.
 */
export function useEdgePagination(
  onAdvance: (direction: EdgeDirection) => boolean,
  options: { thresholdPx?: number; holdMs?: number } = {},
) {
  const thresholdPx = options.thresholdPx ?? DEFAULT_THRESHOLD_PX;
  const holdMs = options.holdMs ?? DEFAULT_HOLD_MS;
  const activeEdgeRef = useRef<EdgeDirection>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Always call the latest onAdvance: after an advance triggers a re-render,
  // the re-armed timer must read the new page state, not the stale closure
  // captured when the drag first reached the edge.
  const onAdvanceRef = useRef(onAdvance);
  onAdvanceRef.current = onAdvance;

  function clearTimer() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function armTimer(edge: EdgeDirection) {
    timerRef.current = setTimeout(function fire() {
      const canAdvanceAgain = onAdvanceRef.current(edge);
      // Keep paging while the icon is still held at this edge and a further
      // page remains; otherwise idle until the edge state next changes.
      if (canAdvanceAgain && activeEdgeRef.current === edge) {
        timerRef.current = setTimeout(fire, holdMs);
      } else {
        timerRef.current = null;
      }
    }, holdMs);
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
      armTimer(edge);
    }
  }

  function reset() {
    activeEdgeRef.current = 0;
    clearTimer();
  }

  return { handleDragMove, reset };
}
