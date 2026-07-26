import { createMutex } from "./mutex";

/**
 * Name of the lock guarding the stored-positions read-modify-write. One name,
 * shared by every context, is the whole point — the lock manager behind
 * `navigator.locks` is per-origin, and the background service worker and every
 * new-tab page share the `chrome-extension://<id>` origin.
 */
const POSITIONS_LOCK = "bookmark-desktop:positions";

/**
 * Serializes callers within this realm only. Used when `navigator.locks` is
 * unavailable — in practice jsdom under Vitest, which does not implement Web
 * Locks. Falling back to this keeps single-context serialization honest in
 * tests rather than silently running with no lock at all; real Chrome always
 * takes the Web Lock path, which the e2e suite exercises.
 */
const fallbackMutex = createMutex();

/**
 * Runs `fn` holding exclusive access to the stored-positions store.
 *
 * Positions live under a single `chrome.storage.local` key that is updated by
 * read-modify-write from two independent JS realms: the background service
 * worker (per-item placement on `onCreated`) and the new-tab page (whole-map
 * writes from backfill, reflow and drag). `createMutex` is a promise chain in
 * one module instance, so it cannot serialize across realms — without this
 * lock, a write built from a stale snapshot silently discards entries the other
 * realm committed in between, stranding bookmarks with no position forever.
 *
 * IMPORTANT: Web Locks are **not reentrant**. Requesting this name from inside
 * a callback that already holds it deadlocks. Anything called from within `fn`
 * must therefore use the `…Unlocked` primitives in storage/positions.ts rather
 * than the locked public operations.
 *
 * Keep locked sections short and free of unbounded waits: Web Locks have no
 * timeout, so a callback that never settles blocks every other writer.
 */
export function withPositionsLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = globalThis.navigator?.locks;
  if (!locks) {
    return fallbackMutex.runExclusive(fn);
  }
  return locks.request(POSITIONS_LOCK, fn);
}
