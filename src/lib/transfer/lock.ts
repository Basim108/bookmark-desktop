import {
  forceBookmarkResync,
  resumeBookmarkSubscribers,
  suspendBookmarkSubscribers,
} from "../bookmarks/events";
import type { TransferLockMessage } from "../bookmarks/events";
import { writeTransferLockRecord } from "./lockRecord";

/**
 * Tells the background service worker's bookmark listeners to lock/unlock, and
 * awaits the ack. Awaiting the ack is what makes the lock race-free: once it
 * resolves, the background flag is set, so every bookmark event the importer
 * subsequently triggers is delivered to handlers that already see the lock.
 * Best-effort — a missing/asleep background just means no ack, which we tolerate
 * rather than block the import (unlock is likewise best-effort).
 */
async function setBackgroundLock(locked: boolean): Promise<void> {
  const message: TransferLockMessage = { type: "transfer:setLock", locked };
  try {
    await chrome.runtime.sendMessage(message);
  } catch {
    // No receiver / SW unavailable — proceed; the newtab half of the lock still
    // applies, and auto-placement is overwritten by the importer's own writes.
  }
}

/**
 * Acquires the state-transfer lock: suspends the background position/cleanup
 * listeners (via runtime message, awaited) and the newtab live-refetch
 * subscribers. Call before any delete/create.
 */
export async function acquireTransferLock(): Promise<void> {
  // Written before the message so a service worker that starts up mid-import —
  // including one woken by the import's own bookmark events — reads a lock that
  // is already held rather than racing the ack.
  await writeTransferLockRecord(true);
  await setBackgroundLock(true);
  suspendBookmarkSubscribers();
}

/**
 * Releases the state-transfer lock. Idempotent and unconditional — resumes the
 * newtab subscribers, catches the UI up with a single resync, and clears the
 * background lock — so it is safe to call in a `finally` even after a partial or
 * never-completed acquire.
 */
export async function releaseTransferLock(): Promise<void> {
  resumeBookmarkSubscribers();
  forceBookmarkResync();
  await setBackgroundLock(false);
  // Cleared last: while the in-memory flag is being unset, the record is the
  // only thing a freshly restarted worker could consult.
  await writeTransferLockRecord(false);
}
