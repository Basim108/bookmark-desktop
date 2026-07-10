import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  getSidebarWidth,
  setSidebarWidth,
} from "../../lib/storage/sidebarSettings";

/**
 * Drag-to-resize for the sidebar's right border. Width is persisted once
 * per drag (on release) rather than on every move, to avoid storage write
 * spam while dragging.
 */
export function useSidebarResize(): {
  width: number;
  isDragging: boolean;
  startDrag: (event: React.PointerEvent<HTMLElement>) => void;
} {
  const [width, setWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startWidth: number } | null>(
    null,
  );
  const widthRef = useRef(width);

  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  useEffect(() => {
    let cancelled = false;
    void getSidebarWidth().then((stored) => {
      if (!cancelled) {
        setWidth(stored);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    function handlePointerMove(event: PointerEvent) {
      const dragStart = dragStartRef.current;
      if (!dragStart) {
        return;
      }
      const delta = event.clientX - dragStart.startX;
      setWidth(Math.max(MIN_SIDEBAR_WIDTH, dragStart.startWidth + delta));
    }

    function endDrag() {
      dragStartRef.current = null;
      setIsDragging(false);
      void setSidebarWidth(widthRef.current);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, [isDragging]);

  function startDrag(event: React.PointerEvent<HTMLElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragStartRef.current = {
      startX: event.clientX,
      startWidth: widthRef.current,
    };
    setIsDragging(true);
  }

  return { width, isDragging, startDrag };
}
