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
 * Gap between adjacent grid cells, and the grid's own padding on every side,
 * in px. Declared here — beside the capacity math that has to account for
 * them — and applied to the grid as inline style rather than in main.css, so
 * the numbers the arithmetic assumes and the numbers the browser lays out
 * with cannot drift apart. A CSS-side edit silently invalidating this math is
 * exactly how the right-edge clipping bug arose.
 */
export const GRID_GAP = 8;
export const GRID_PADDING = 8;

/**
 * Largest whole number of cells that fits along one axis: `n` cells consume
 * `n * cellSize + (n - 1) * gap` inside the padded box, which rearranges to
 * the division below. Floored to a minimum of 1 so a canvas narrower than a
 * single cell still renders one (clipped) cell rather than an empty grid.
 */
function fitCount(
  available: number,
  cellSize: number,
  gap: number,
  padding: number,
): number {
  const usable = Math.max(0, available - 2 * padding);
  return Math.max(1, Math.floor((usable + gap) / (cellSize + gap)));
}

/**
 * Grid capacity is derived from the space cells *actually* consume — the tier
 * icon size plus the gap between adjacent cells, within the grid's padding —
 * so every rendered cell is fully visible. Dividing by the icon size alone
 * over-counts by roughly one cell per screen, which is what clipped the
 * right-most column.
 *
 * Leftover space is never spent growing icons past their tier size. Along the
 * inline axis the renderer distributes it into the column tracks (icons stay
 * tier-sized and centred); along the block axis it is left unused below the
 * last row, keeping the desktop top-anchored.
 */
export function computeGridCapacity(
  availableWidth: number,
  availableHeight: number,
  iconSize: number,
  gap: number,
  padding: number,
): GridCapacity {
  return {
    cols: fitCount(availableWidth, iconSize, gap, padding),
    rows: fitCount(availableHeight, iconSize, gap, padding),
  };
}
