import type { GridCapacity } from "./types";

/** Viewport-width breakpoints for the grid's icon-size tiers. */
const MEDIUM_BREAKPOINT = 512;
const LARGE_BREAKPOINT = 1024;

const SMALL_ICON_SIZE = 80;
const MEDIUM_ICON_SIZE = 106;
const LARGE_ICON_SIZE = 166;

const SMALL_LABEL_FONT_SIZE = "0.75rem";
const MEDIUM_LABEL_FONT_SIZE = "0.85rem";
const LARGE_LABEL_FONT_SIZE = "1rem";

export interface GridTier {
  iconSize: number;
  labelFontSize: string;
}

/**
 * Icon size and label font-size are a fixed step function of the canvas's
 * own available width — not configurable, not interpolated between tiers.
 * Mirrors the style of useSidebarResize's getMaxWidthForViewport. Resolved
 * together (rather than via two parallel lookups) so the two values can
 * never drift out of sync with each other.
 */
export function resolveTier(availableWidth: number): GridTier {
  if (availableWidth < MEDIUM_BREAKPOINT) {
    return { iconSize: SMALL_ICON_SIZE, labelFontSize: SMALL_LABEL_FONT_SIZE };
  }
  if (availableWidth < LARGE_BREAKPOINT) {
    return {
      iconSize: MEDIUM_ICON_SIZE,
      labelFontSize: MEDIUM_LABEL_FONT_SIZE,
    };
  }
  return { iconSize: LARGE_ICON_SIZE, labelFontSize: LARGE_LABEL_FONT_SIZE };
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
