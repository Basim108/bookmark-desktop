import type { GridCapacity } from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Auto mode: as many columns/rows fit at the minimum icon size (like CSS
 * grid's `repeat(auto-fill, minmax(min, max))`); the actual rendered icon
 * size then stretches up to fill the available space, capped at max. This
 * is what makes icon size grow continuously with the window and, once at
 * max, makes further growth add columns/rows instead — there's leftover
 * slack space rather than icons exceeding max.
 */
export function computeAutoCapacity(
  availableWidth: number,
  availableHeight: number,
  minIconSize: number,
): GridCapacity {
  return {
    cols: Math.max(1, Math.floor(availableWidth / minIconSize)),
    rows: Math.max(1, Math.floor(availableHeight / minIconSize)),
  };
}

export function computeAutoIconSize(
  availableWidth: number,
  availableHeight: number,
  capacity: GridCapacity,
  maxIconSize: number,
): number {
  const widthPerCol = availableWidth / capacity.cols;
  const heightPerRow = availableHeight / capacity.rows;
  return Math.min(widthPerCol, heightPerRow, maxIconSize);
}

export interface FixedSizingResult {
  iconSize: number;
  /** True once the natural fit would go below minIconSize — the canvas should scroll instead of shrinking icons further. */
  needsScroll: boolean;
}

/**
 * Fixed mode: cell count never changes with viewport size. Icon size
 * scales to fit, clamped to [minIconSize, maxIconSize]; hitting the floor
 * triggers scrolling instead of further shrinking.
 */
export function computeFixedIconSize(
  availableWidth: number,
  availableHeight: number,
  capacity: GridCapacity,
  minIconSize: number,
  maxIconSize: number,
): FixedSizingResult {
  const naturalFit = Math.min(
    availableWidth / capacity.cols,
    availableHeight / capacity.rows,
  );
  return {
    iconSize: clamp(naturalFit, minIconSize, maxIconSize),
    needsScroll: naturalFit < minIconSize,
  };
}
