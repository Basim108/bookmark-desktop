import { cellToSlot, slotToCell } from "../grid/placement";
import type { GridCapacity, GridCell, Slot } from "../grid/types";

/**
 * Frame used to express a slot as a `(page, row, col)` cell in an export file,
 * and to read one back.
 *
 * Fixed rather than measured, for two reasons. A capacity is device-derived
 * geometry that the format deliberately never carries (restoring one machine's
 * capacity onto another is the mismatch the whole design avoids), and a constant
 * makes an export reproducible — the same state exports byte-identically from
 * any window size.
 *
 * This value is part of the file format. Changing it would silently relabel
 * every `position` field, so it must stay 6x4 for as long as the compatibility
 * field is emitted, independently of any grid constant it happens to match.
 */
export const EXPORT_REFERENCE_CAPACITY: GridCapacity = { cols: 6, rows: 4 };

/** The compatibility `position` field for a stored slot. */
export function slotToExportPosition(slot: Slot): GridCell {
  return slotToCell(slot, EXPORT_REFERENCE_CAPACITY);
}

/** The slot a pre-slot file's `position` field denotes. */
export function exportPositionToSlot(cell: GridCell): Slot {
  return cellToSlot(cell, EXPORT_REFERENCE_CAPACITY);
}

/**
 * The slot a bookmark node in an export file carries, or null when it has no
 * position at all.
 *
 * `slot` wins whenever present: it is the stored form, while `position` is a
 * lossy rendering of it kept only so importers predating slots can still read
 * the file. A file written before slots existed carries `position` alone, and
 * converting it against the same fixed frame restores exactly what it meant.
 */
export function readNodeSlot(node: {
  slot?: unknown;
  position?: unknown;
}): Slot | null {
  if (typeof node.slot === "number" && Number.isInteger(node.slot)) {
    return node.slot;
  }
  const position = node.position;
  if (
    typeof position === "object" &&
    position !== null &&
    typeof (position as GridCell).page === "number" &&
    typeof (position as GridCell).row === "number" &&
    typeof (position as GridCell).col === "number"
  ) {
    return exportPositionToSlot(position as GridCell);
  }
  return null;
}
