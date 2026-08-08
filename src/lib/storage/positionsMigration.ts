import { withPositionsLock } from "../concurrency/positionsLock";
import { cellToSlot, DEFAULT_GRID_CAPACITY } from "../grid/placement";
import { getMeasuredGridCapacity } from "./gridCapacity";
import { getStorageValue, setStorageValue } from "./local";
import { POSITIONS_SCHEMA_SLOTS, STORAGE_KEYS } from "./schema";
import type { FolderPositions } from "./schema";
import type { GridCapacity, GridCell } from "../grid/types";

/**
 * Converts positions written by a version that stored `(page, row, col)` cells
 * into capacity-free slots.
 *
 * A cell is a coordinate in a reference frame that was never recorded, so the
 * conversion needs one supplied. The honest choice is the capacity a new-tab
 * page most recently measured: that is the window the user last arranged in, so
 * framing on it reproduces the layout they last saw. Nothing better exists — the
 * information was not written down — so a profile whose last measurement came
 * from a different window shifts once, then is stable forever.
 *
 * Runs exactly once per profile, gated on a stored schema marker, so a second
 * context reads the finished conversion instead of re-deriving it against a
 * frame that may since have changed.
 */

function isCell(value: unknown): value is GridCell {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as GridCell).page === "number" &&
    typeof (value as GridCell).row === "number" &&
    typeof (value as GridCell).col === "number"
  );
}

/**
 * Reads either shape and yields slots. Entry-by-entry rather than all-or-nothing
 * so a store caught mid-conversion still reads correctly; the schema marker
 * makes that state unobservable once the conversion has committed.
 */
export function normalizePositions(
  raw: Record<string, Record<string, unknown>> | undefined,
  frame: GridCapacity,
): Record<string, FolderPositions> {
  const normalized: Record<string, FolderPositions> = {};
  for (const [folderId, folder] of Object.entries(raw ?? {})) {
    const positions: FolderPositions = {};
    for (const [bookmarkId, value] of Object.entries(folder ?? {})) {
      if (typeof value === "number") {
        positions[bookmarkId] = value;
      } else if (isCell(value)) {
        positions[bookmarkId] = cellToSlot(value, frame);
      }
    }
    normalized[folderId] = positions;
  }
  return normalized;
}

/** The frame the conversion is (and was) performed against. */
export async function getMigrationFrame(): Promise<GridCapacity> {
  return (await getMeasuredGridCapacity()) ?? DEFAULT_GRID_CAPACITY;
}

async function isMigrated(): Promise<boolean> {
  const schema = await getStorageValue(STORAGE_KEYS.POSITIONS_SCHEMA);
  return schema === POSITIONS_SCHEMA_SLOTS;
}

/**
 * Performs the conversion if it has not run yet. Caller MUST already hold the
 * positions lock — the read, the conversion, and the write must see one
 * snapshot, or a concurrent placement is converted twice or lost.
 */
export async function migratePositionsUnlocked(): Promise<void> {
  if (await isMigrated()) {
    return;
  }
  const raw = await getStorageValue(STORAGE_KEYS.POSITIONS);
  const frame = await getMigrationFrame();
  const converted = normalizePositions(
    raw as Record<string, Record<string, unknown>> | undefined,
    frame,
  );
  await setStorageValue(STORAGE_KEYS.POSITIONS, converted);
  await setStorageValue(STORAGE_KEYS.POSITIONS_SCHEMA, POSITIONS_SCHEMA_SLOTS);
}

/**
 * Converts stored positions to slots if needed. Idempotent and safe to call
 * from every context on startup; the second caller observes the marker and
 * returns without writing.
 */
export async function ensurePositionsMigrated(): Promise<void> {
  if (await isMigrated()) {
    return;
  }
  await withPositionsLock(migratePositionsUnlocked);
}
