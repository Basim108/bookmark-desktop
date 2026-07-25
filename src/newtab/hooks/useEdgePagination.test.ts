import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeEdgeDirection, useEdgePagination } from "./useEdgePagination";
import type { EdgeDirection } from "./useEdgePagination";

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

  it("keeps advancing across pages while held at the same edge", () => {
    // onAdvance reports "a further page still exists" twice, then stops —
    // so it should fire on each hold interval: 3 advances total.
    const onAdvance = vi
      .fn<(direction: EdgeDirection) => boolean>()
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);
    const { result } = renderHook(() =>
      useEdgePagination(onAdvance, { thresholdPx: 40, holdMs: 500 }),
    );

    result.current.handleDragMove({ left: 470, right: 490 }, container);
    vi.advanceTimersByTime(500);
    expect(onAdvance).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(500);
    expect(onAdvance).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(500);
    expect(onAdvance).toHaveBeenCalledTimes(3);
    // Reported no further page — must not keep firing.
    vi.advanceTimersByTime(1500);
    expect(onAdvance).toHaveBeenCalledTimes(3);
  });

  it("stops re-arming once onAdvance reports the last page is reached", () => {
    const onAdvance = vi
      .fn<(direction: EdgeDirection) => boolean>()
      .mockReturnValue(false);
    const { result } = renderHook(() =>
      useEdgePagination(onAdvance, { thresholdPx: 40, holdMs: 500 }),
    );

    result.current.handleDragMove({ left: 470, right: 490 }, container);
    vi.advanceTimersByTime(2000);

    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it("stops the auto-advance chain when the drag leaves the edge", () => {
    const onAdvance = vi
      .fn<(direction: EdgeDirection) => boolean>()
      .mockReturnValue(true);
    const { result } = renderHook(() =>
      useEdgePagination(onAdvance, { thresholdPx: 40, holdMs: 500 }),
    );

    result.current.handleDragMove({ left: 470, right: 490 }, container);
    vi.advanceTimersByTime(500);
    expect(onAdvance).toHaveBeenCalledTimes(1);
    // Pull back to the middle: the re-armed timer must be cancelled.
    result.current.handleDragMove({ left: 200, right: 240 }, container);
    vi.advanceTimersByTime(2000);
    expect(onAdvance).toHaveBeenCalledTimes(1);
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
