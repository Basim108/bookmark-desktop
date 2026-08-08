/**
 * A bookmark's stored position: an index into the folder's arrangement that
 * carries no capacity of its own. The displayed cell is derived from it per
 * render (see slotToCell), so the same slot means the same place in the
 * arrangement at every window size, and a size round trip is the identity.
 *
 * Stored rather than a GridCell because a `(page, row, col)` triple is a
 * coordinate in an unrecorded reference frame — the same tuple denotes
 * different places at different column counts, which is what forced the old
 * design to rewrite storage on resize to express "pull items forward".
 */
export type Slot = number;

/** A position on the rendered grid. Derived from a Slot; never stored. */
export interface GridCell {
  page: number;
  row: number;
  col: number;
}

export interface GridCapacity {
  cols: number;
  rows: number;
}
