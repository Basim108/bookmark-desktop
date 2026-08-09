import { useRef } from "react";

/**
 * Approximate line height used to convert `DOM_DELTA_LINE` wheel deltas into
 * pixels. Browsers that report wheel input in lines (notably Firefox) send
 * roughly 1-3 lines per detent; scaling by this lands them in the same range
 * as the pixel deltas Chrome reports, so one threshold serves both. Exported
 * so it can be retuned against real hardware.
 */
export const LINE_HEIGHT_PX = 16;

/**
 * Wheel input in a comparable unit regardless of how the browser reports it.
 * An unrecognised `deltaMode` is treated as pixels: under-scaling merely makes
 * the gesture feel heavy, whereas discarding the event would make the wheel
 * appear dead.
 */
export function normalizeWheelDeltaX(
  event: { deltaX: number; deltaMode: number },
  containerWidth: number,
): number {
  if (event.deltaMode === 1) {
    return event.deltaX * LINE_HEIGHT_PX;
  }
  if (event.deltaMode === 2) {
    return event.deltaX * containerWidth;
  }
  return event.deltaX;
}

/** Which way a resolved wheel gesture turns the page, if at all. */
export type TurnDirection = -1 | 0 | 1;

export interface WheelTurnState {
  /** Normalized input banked toward the next turn, signed by direction. */
  accumulator: number;
  /** Timestamp of the last turn; `-Infinity` before any has happened. */
  lastTurnAt: number;
  /** Timestamp of the last horizontal wheel event, for staleness detection. */
  lastEventAt?: number;
}

export interface WheelTurnDecision extends WheelTurnState {
  lastEventAt: number;
  direction: TurnDirection;
}

export interface WheelTurnOptions {
  thresholdPx: number;
  cooldownMs: number;
  /** Gap in wheel activity after which banked input is treated as a finished gesture. */
  idleResetMs?: number;
}

const DEFAULT_IDLE_RESET_MS = 500;

/**
 * The whole paging rule, as a pure function so it can be exercised without a
 * DOM: accumulate normalized input, turn a page once it reaches the threshold,
 * then refuse to turn again until the cooldown elapses.
 *
 * The clamp in the cooldown branch is what makes burst *magnitude* irrelevant:
 * without it a hard trackpad swipe banks hundreds of pixels and then pays out
 * a page turn every cooldown for seconds after the user stopped. Capping the
 * accumulator at one threshold means only how *long* input continues can
 * turn more pages.
 */
export function resolveWheelTurn(
  delta: number,
  state: WheelTurnState,
  now: number,
  options: WheelTurnOptions,
): WheelTurnDecision {
  const idleResetMs = options.idleResetMs ?? DEFAULT_IDLE_RESET_MS;

  // A purely vertical event is not horizontal activity: it neither banks input
  // nor counts toward staleness.
  if (delta === 0) {
    return {
      accumulator: state.accumulator,
      lastTurnAt: state.lastTurnAt,
      lastEventAt: state.lastEventAt ?? now,
      direction: 0,
    };
  }

  // Input banked by an earlier, finished gesture must not hand the next one a
  // head start — otherwise a gentle nudge minutes later turns a page at once.
  const stale =
    state.lastEventAt !== undefined && now - state.lastEventAt > idleResetMs;
  const carried = stale ? 0 : state.accumulator;

  // A reversal is a new intent, not a correction to the old one: dropping the
  // banked input makes the turn in the new direction arrive on its own merits.
  const reversed = carried !== 0 && Math.sign(delta) !== Math.sign(carried);
  const accumulator = reversed ? delta : carried + delta;

  if (Math.abs(accumulator) < options.thresholdPx) {
    return {
      accumulator,
      lastTurnAt: state.lastTurnAt,
      lastEventAt: now,
      direction: 0,
    };
  }

  if (now - state.lastTurnAt < options.cooldownMs) {
    return {
      accumulator: Math.sign(accumulator) * options.thresholdPx,
      lastTurnAt: state.lastTurnAt,
      lastEventAt: now,
      direction: 0,
    };
  }

  return {
    accumulator: 0,
    lastTurnAt: now,
    lastEventAt: now,
    direction: Math.sign(accumulator) as TurnDirection,
  };
}

/** No turn has happened yet, so the cooldown cannot block the first one. */
function initialState(): WheelTurnState {
  return { accumulator: 0, lastTurnAt: Number.NEGATIVE_INFINITY };
}

const DEFAULT_THRESHOLD_PX = 50;
const DEFAULT_COOLDOWN_MS = 250;

/**
 * Horizontal-wheel page turning: converts wheel input over the canvas into
 * one-page-at-a-time turns, so a single thumbwheel detent turns a single page
 * and a sustained roll keeps turning at a readable cadence.
 *
 * The caller owns the DOM concerns — registering the listener non-passively
 * and calling `preventDefault` — and supplies the container width only so
 * page-mode deltas can be scaled. `onTurn` receives the direction; enforcing
 * the first/last page bounds is the caller's business, since only it knows
 * how many pages exist.
 */
export function useWheelPagination(
  onTurn: (direction: TurnDirection) => void,
  options: {
    thresholdPx?: number;
    cooldownMs?: number;
    idleResetMs?: number;
  } = {},
) {
  const resolved: WheelTurnOptions = {
    thresholdPx: options.thresholdPx ?? DEFAULT_THRESHOLD_PX,
    cooldownMs: options.cooldownMs ?? DEFAULT_COOLDOWN_MS,
    idleResetMs: options.idleResetMs ?? DEFAULT_IDLE_RESET_MS,
  };
  const stateRef = useRef<WheelTurnState>(initialState());

  // No latest-callback ref here, unlike useEdgePagination: that hook arms a
  // setTimeout whose closure would go stale before it fires, whereas
  // handleWheel is only ever called synchronously, from whichever render's
  // closure the caller is holding. Re-created each render, it already closes
  // over the current onTurn.
  function handleWheel(
    event: { deltaX: number; deltaMode: number },
    containerWidth: number,
  ) {
    const delta = normalizeWheelDeltaX(event, containerWidth);
    const decision = resolveWheelTurn(
      delta,
      stateRef.current,
      Date.now(),
      resolved,
    );
    stateRef.current = {
      accumulator: decision.accumulator,
      lastTurnAt: decision.lastTurnAt,
      lastEventAt: decision.lastEventAt,
    };
    if (decision.direction !== 0) {
      onTurn(decision.direction);
    }
  }

  function reset() {
    stateRef.current = initialState();
  }

  return { handleWheel, reset };
}
