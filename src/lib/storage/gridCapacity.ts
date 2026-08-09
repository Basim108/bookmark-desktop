import { getStorageValue } from "./local";
import { STORAGE_KEYS } from "./schema";
import type { GridCapacity } from "../grid/types";

/**
 * The grid capacity a new-tab page measured, as recorded by a version of this
 * extension that stored positions as `(page, row, col)` cells.
 *
 * Read-only, and read by exactly one caller: the one-time conversion of those
 * cells into slots (storage/positionsMigration.ts) needs the frame they were
 * authored in, and this is the closest record of it — the window the user last
 * had open before upgrading.
 *
 * Nothing writes this key any more. It existed so that contexts which cannot
 * measure a capacity — chiefly the background service worker placing a bookmark
 * created by Chrome's own UI or arriving via sync — could place against the
 * capacity the canvas actually renders at. Placement no longer consults a
 * capacity at all (the next free slot is the lowest free integer), so there is
 * nothing left to keep in sync and no measurement left to publish.
 *
 * The stored value is deliberately left in place rather than deleted: it is the
 * only surviving evidence of the migration frame, and a profile that somehow
 * needs converting again should convert against the same frame as the first
 * time, not against a substituted default.
 */
export async function getMeasuredGridCapacity(): Promise<
  GridCapacity | undefined
> {
  return getStorageValue(STORAGE_KEYS.GRID_CAPACITY);
}
