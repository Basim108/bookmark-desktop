import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LINE_HEIGHT_PX,
  normalizeWheelDeltaX,
  resolveWheelTurn,
  useWheelPagination,
} from "./useWheelPagination";
import type { TurnDirection } from "./useWheelPagination";

const CONTAINER_WIDTH = 800;

const OPTIONS = { thresholdPx: 50, cooldownMs: 250 };
/** A state that has never turned, so the cooldown can never block the first turn. */
const FRESH = { accumulator: 0, lastTurnAt: Number.NEGATIVE_INFINITY };

describe("normalizeWheelDeltaX", () => {
  it("passes pixel-mode deltas through unchanged", () => {
    expect(
      normalizeWheelDeltaX({ deltaX: 40, deltaMode: 0 }, CONTAINER_WIDTH),
    ).toBe(40);
  });

  it("scales line-mode deltas by the line height", () => {
    expect(
      normalizeWheelDeltaX({ deltaX: 3, deltaMode: 1 }, CONTAINER_WIDTH),
    ).toBe(3 * LINE_HEIGHT_PX);
  });

  it("scales page-mode deltas by the container width", () => {
    expect(
      normalizeWheelDeltaX({ deltaX: 2, deltaMode: 2 }, CONTAINER_WIDTH),
    ).toBe(2 * CONTAINER_WIDTH);
  });

  it("preserves the sign of a leftward delta", () => {
    expect(
      normalizeWheelDeltaX({ deltaX: -2, deltaMode: 1 }, CONTAINER_WIDTH),
    ).toBe(-2 * LINE_HEIGHT_PX);
  });

  it("treats an unknown delta mode as pixels rather than discarding the input", () => {
    expect(
      normalizeWheelDeltaX({ deltaX: 40, deltaMode: 99 }, CONTAINER_WIDTH),
    ).toBe(40);
  });
});

describe("resolveWheelTurn", () => {
  it("accumulates without turning while below the threshold", () => {
    const result = resolveWheelTurn(30, FRESH, 1000, OPTIONS);

    expect(result.direction).toBe(0);
    expect(result.accumulator).toBe(30);
  });

  it("turns once the accumulated input reaches the threshold", () => {
    const partial = resolveWheelTurn(30, FRESH, 1000, OPTIONS);
    const result = resolveWheelTurn(30, partial, 1050, OPTIONS);

    expect(result.direction).toBe(1);
    expect(result.accumulator).toBe(0);
    expect(result.lastTurnAt).toBe(1050);
  });

  it("turns backwards for leftward input", () => {
    const result = resolveWheelTurn(-50, FRESH, 1000, OPTIONS);

    expect(result.direction).toBe(-1);
  });

  it("turns a single page for one detent's worth of input", () => {
    const result = resolveWheelTurn(50, FRESH, 1000, OPTIONS);

    expect(result.direction).toBe(1);
    expect(result.accumulator).toBe(0);
  });

  it("discards accumulated input when the direction reverses", () => {
    const partial = resolveWheelTurn(40, FRESH, 1000, OPTIONS);
    const result = resolveWheelTurn(-20, partial, 1050, OPTIONS);

    // Had the 40 been retained, the -20 would have left +20 banked and the
    // eventual leftward turn would arrive late.
    expect(result.accumulator).toBe(-20);
    expect(result.direction).toBe(0);
  });

  it("does not turn again while the cooldown is still running", () => {
    const turned = resolveWheelTurn(50, FRESH, 1000, OPTIONS);
    const result = resolveWheelTurn(50, turned, 1100, OPTIONS);

    expect(result.direction).toBe(0);
  });

  it("turns again once the cooldown has elapsed", () => {
    const turned = resolveWheelTurn(50, FRESH, 1000, OPTIONS);
    const result = resolveWheelTurn(50, turned, 1250, OPTIONS);

    expect(result.direction).toBe(1);
  });

  it("clamps a high-magnitude burst so it banks no credit for later turns", () => {
    const turned = resolveWheelTurn(50, FRESH, 1000, OPTIONS);
    // A hard trackpad swipe: far more than one page's worth, mid-cooldown.
    const burst = resolveWheelTurn(800, turned, 1100, OPTIONS);

    expect(burst.direction).toBe(0);
    expect(burst.accumulator).toBe(OPTIONS.thresholdPx);
  });

  it("pays out only one turn after a clamped burst, not one per banked page", () => {
    const turned = resolveWheelTurn(50, FRESH, 1000, OPTIONS);
    const burst = resolveWheelTurn(800, turned, 1100, OPTIONS);
    // Input has stopped; only the passage of time remains. A zero-delta event
    // stands in for "the next thing that happens".
    const afterCooldown = resolveWheelTurn(0, burst, 1400, OPTIONS);

    expect(afterCooldown.accumulator).toBe(OPTIONS.thresholdPx);
    expect(afterCooldown.direction).toBe(0);
  });

  it("discards stale accumulated input after a long gap in wheel activity", () => {
    const partial = resolveWheelTurn(40, FRESH, 1000, OPTIONS);
    // A separate gesture, seconds later. Without a staleness reset the 40 left
    // over from the previous one would turn a page on the very first event.
    const result = resolveWheelTurn(20, partial, 9000, OPTIONS);

    expect(result.direction).toBe(0);
    expect(result.accumulator).toBe(20);
  });

  it("ignores a zero delta without disturbing accumulated input", () => {
    const partial = resolveWheelTurn(30, FRESH, 1000, OPTIONS);
    const result = resolveWheelTurn(0, partial, 1050, OPTIONS);

    expect(result.direction).toBe(0);
    expect(result.accumulator).toBe(30);
    expect(result.lastTurnAt).toBe(partial.lastTurnAt);
  });
});

describe("useWheelPagination", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /** A pixel-mode wheel event carrying only horizontal input. */
  function wheel(deltaX: number) {
    return { deltaX, deltaMode: 0 };
  }

  it("turns exactly one page for a single detent", () => {
    const onTurn = vi.fn();
    const { result } = renderHook(() => useWheelPagination(onTurn, OPTIONS));

    result.current.handleWheel(wheel(50), CONTAINER_WIDTH);

    expect(onTurn).toHaveBeenCalledTimes(1);
    expect(onTurn).toHaveBeenCalledWith(1);
  });

  it("turns backwards for leftward input", () => {
    const onTurn = vi.fn();
    const { result } = renderHook(() => useWheelPagination(onTurn, OPTIONS));

    result.current.handleWheel(wheel(-50), CONTAINER_WIDTH);

    expect(onTurn).toHaveBeenCalledWith(-1);
  });

  it("keeps turning pages at the cooldown cadence while rolling continues", () => {
    const onTurn = vi.fn();
    const { result } = renderHook(() => useWheelPagination(onTurn, OPTIONS));

    // Twelve detents 60ms apart — a steady thumbwheel roll over 720ms.
    for (let i = 0; i < 12; i++) {
      vi.advanceTimersByTime(60);
      result.current.handleWheel(wheel(40), CONTAINER_WIDTH);
    }

    // 720ms of rolling at a 250ms cooldown yields three turns, not twelve.
    expect(onTurn).toHaveBeenCalledTimes(3);
  });

  it("turns one page for a burst many times the threshold", () => {
    const onTurn = vi.fn();
    const { result } = renderHook(() => useWheelPagination(onTurn, OPTIONS));

    result.current.handleWheel(wheel(800), CONTAINER_WIDTH);

    expect(onTurn).toHaveBeenCalledTimes(1);
  });

  it("turns no further pages once a burst's input has stopped", () => {
    const onTurn = vi.fn();
    const { result } = renderHook(() => useWheelPagination(onTurn, OPTIONS));

    result.current.handleWheel(wheel(800), CONTAINER_WIDTH);
    vi.advanceTimersByTime(2000);

    expect(onTurn).toHaveBeenCalledTimes(1);
  });

  it("ignores events carrying no horizontal input", () => {
    const onTurn = vi.fn();
    const { result } = renderHook(() => useWheelPagination(onTurn, OPTIONS));

    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(60);
      result.current.handleWheel(wheel(0), CONTAINER_WIDTH);
    }

    expect(onTurn).not.toHaveBeenCalled();
  });

  it("converts line-mode deltas before applying the threshold", () => {
    const onTurn = vi.fn();
    const { result } = renderHook(() => useWheelPagination(onTurn, OPTIONS));

    // 4 lines × 16px = 64px, over the 50px threshold; unconverted, 4 would not be.
    result.current.handleWheel({ deltaX: 4, deltaMode: 1 }, CONTAINER_WIDTH);

    expect(onTurn).toHaveBeenCalledTimes(1);
  });

  it("discards banked input on reset so a later gesture starts clean", () => {
    const onTurn = vi.fn();
    const { result } = renderHook(() => useWheelPagination(onTurn, OPTIONS));

    result.current.handleWheel(wheel(40), CONTAINER_WIDTH);
    result.current.reset();
    vi.advanceTimersByTime(60);
    result.current.handleWheel(wheel(40), CONTAINER_WIDTH);

    // Without the reset the two 40s would have summed past the threshold.
    expect(onTurn).not.toHaveBeenCalled();
  });

  it("calls the latest onTurn rather than the one captured on first render", () => {
    const stale = vi.fn();
    const fresh = vi.fn();
    const { result, rerender } = renderHook(
      ({ onTurn }: { onTurn: (direction: TurnDirection) => void }) =>
        useWheelPagination(onTurn, OPTIONS),
      { initialProps: { onTurn: stale } },
    );

    rerender({ onTurn: fresh });
    result.current.handleWheel(wheel(50), CONTAINER_WIDTH);

    expect(fresh).toHaveBeenCalledTimes(1);
    expect(stale).not.toHaveBeenCalled();
  });
});
