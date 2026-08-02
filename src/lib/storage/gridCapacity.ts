import { getStorageValue, setStorageValue } from "./local";
import { STORAGE_KEYS } from "./schema";
import type { GridCapacity } from "../grid/types";

/**
 * IMPORTANT: nothing in this module may take `withPositionsLock`.
 *
 * `placeNewBookmark` (lib/bookmarks/events.ts) calls getMeasuredGridCapacity
 * from *inside* a held positions lock, and Web Locks are not reentrant — see
 * lib/concurrency/positionsLock.ts. Requesting that lock here would deadlock
 * every placement. This is a different storage key with a single writer (the
 * new-tab page's measurement effect) and no read-modify-write, so it needs no
 * lock of its own; keep it that way.
 */

/**
 * The grid capacity most recently measured by a new-tab page, or `undefined`
 * when no page has ever measured one.
 *
 * `undefined` is returned rather than a substituted default so the caller
 * decides the bootstrap. On a fresh profile the service worker can be asked to
 * place a bookmark before any new-tab page has rendered, and that caller wants
 * to name DEFAULT_GRID_CAPACITY explicitly rather than have it appear here as
 * an indistinguishable real measurement.
 */
export async function getMeasuredGridCapacity(): Promise<
  GridCapacity | undefined
> {
  return getStorageValue(STORAGE_KEYS.GRID_CAPACITY);
}

/**
 * Records the capacity a new-tab page just measured.
 *
 * Last-measured-wins by design: two pages at different window sizes overwrite
 * each other and nothing reconciles them. Callers must not write a capacity
 * derived from an unmeasured (zero-sized) canvas — see useGridLayout.
 */
export async function setMeasuredGridCapacity(
  capacity: GridCapacity,
): Promise<void> {
  await setStorageValue(STORAGE_KEYS.GRID_CAPACITY, capacity);
}
