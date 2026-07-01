import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeEdgeDirection, useEdgePagination } from "./useEdgePagination";

const container = { left: 0, right: 500 };

describe("computeEdgeDirection", () => {
  it("returns 0 when comfortably away from both edges", () => {
    expect(computeEdgeDirection({ left: 200, right: 240 }, container, 40)).toBe(
      0,
    );
  });

  it("returns -1 when near the left edge", () => {
    expect(computeEdgeDirection({ left: 10, right: 50 }, container, 40)).toBe(
      -1,
    );
  });

  it("returns 1 when near the right edge", () => {
    expect(computeEdgeDirection({ left: 470, right: 490 }, container, 40)).toBe(
      1,
    );
  });
});

describe("useEdgePagination", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("advances after holding near an edge for the configured delay", () => {
    const onAdvance = vi.fn();
    const { result } = renderHook(() =>
      useEdgePagination(onAdvance, { thresholdPx: 40, holdMs: 500 }),
    );

    result.current.handleDragMove({ left: 470, right: 490 }, container);
    expect(onAdvance).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(onAdvance).toHaveBeenCalledWith(1);
  });

  it("does not advance if the drag leaves the edge before the delay elapses", () => {
    const onAdvance = vi.fn();
    const { result } = renderHook(() =>
      useEdgePagination(onAdvance, { thresholdPx: 40, holdMs: 500 }),
    );

    result.current.handleDragMove({ left: 470, right: 490 }, container);
    vi.advanceTimersByTime(300);
    result.current.handleDragMove({ left: 200, right: 240 }, container);
    vi.advanceTimersByTime(500);

    expect(onAdvance).not.toHaveBeenCalled();
  });

  it("does not restart the timer while staying on the same edge", () => {
    const onAdvance = vi.fn();
    const { result } = renderHook(() =>
      useEdgePagination(onAdvance, { thresholdPx: 40, holdMs: 500 }),
    );

    result.current.handleDragMove({ left: 470, right: 490 }, container);
    vi.advanceTimersByTime(400);
    // Still near the same (right) edge, slightly different position.
    result.current.handleDragMove({ left: 475, right: 495 }, container);
    vi.advanceTimersByTime(100);

    expect(onAdvance).toHaveBeenCalledWith(1);
  });

  it("reset() cancels a pending advance", () => {
    const onAdvance = vi.fn();
    const { result } = renderHook(() =>
      useEdgePagination(onAdvance, { thresholdPx: 40, holdMs: 500 }),
    );

    result.current.handleDragMove({ left: 470, right: 490 }, container);
    result.current.reset();
    vi.advanceTimersByTime(500);

    expect(onAdvance).not.toHaveBeenCalled();
  });
});
