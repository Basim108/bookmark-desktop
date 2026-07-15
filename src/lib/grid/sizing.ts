import type { GridCapacity } from "./types";

/** Viewport-width breakpoints for the grid's icon-size tiers. */
const MEDIUM_BREAKPOINT = 1660;
const LARGE_BREAKPOINT = 2100;

const SMALL_ICON_SIZE = 80;
const MEDIUM_ICON_SIZE = 106;
const LARGE_ICON_SIZE = 166;

/**
 * Icon size is a fixed step function of the canvas's own available width —
 * not configurable, not interpolated between tiers. Mirrors the style of
 * useSidebarResize's getMaxWidthForViewport.
 */
export function resolveTierIconSize(availableWidth: number): number {
  if (availableWidth < MEDIUM_BREAKPOINT) {
    return SMALL_ICON_SIZE;
  }
  if (availableWidth < LARGE_BREAKPOINT) {
    return MEDIUM_ICON_SIZE;
  }
  return LARGE_ICON_SIZE;
}

/**
 * Grid capacity is directly derived from the tier icon size: however many
 * whole cells fit in the available space, floored to a minimum of 1 per
 * dimension. Leftover space that doesn't divide evenly is left unused
 * rather than stretching icons to fill it.
 */
export function computeGridCapacity(
  availableWidth: number,
  availableHeight: number,
  iconSize: number,
): GridCapacity {
  return {
    cols: Math.max(1, Math.floor(availableWidth / iconSize)),
    rows: Math.max(1, Math.floor(availableHeight / iconSize)),
  };
}
