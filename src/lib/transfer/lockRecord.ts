const TRANSFER_LOCK_KEY = "transferImportLock";

/**
 * How long a lock record stays trustworthy.
 *
 * The record exists so an import survives a service-worker restart, but that
 * same durability means an importer that dies without releasing (tab closed
 * mid-import, renderer crash) would otherwise suspend position tracking and
 * cleanup for the rest of the browser session. Treating an old record as absent
 * bounds that damage.
 *
 * Sized against a worst-case import rather than a typical one: a large tree
 * whose items carry custom icons spends most of its time in per-item IndexedDB
 * writes of up to 1 MB each. Ten minutes is far beyond any realistic import,
 * and the asymmetry favours a generous bound — expiring early re-opens the race
 * this record exists to close, while expiring late only leaves a profile
 * unsynchronized until the stale record ages out.
 */
export const TRANSFER_LOCK_MAX_AGE_MS = 10 * 60 * 1000;

interface TransferLockRecord {
  takenAt: number;
}

function isRecord(value: unknown): value is TransferLockRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { takenAt?: unknown }).takenAt === "number"
  );
}

/**
 * Records or clears the transfer lock in chrome.storage.session.
 *
 * session (not local) because the lock must outlive a service-worker restart
 * but must never outlive the browser session — a record persisted to disk could
 * suspend synchronization on next launch with no importer running. Best-effort:
 * a storage failure must not block or fail an import.
 */
export async function writeTransferLockRecord(held: boolean): Promise<void> {
  try {
    if (held) {
      const record: TransferLockRecord = { takenAt: Date.now() };
      await chrome.storage.session.set({ [TRANSFER_LOCK_KEY]: record });
    } else {
      await chrome.storage.session.remove(TRANSFER_LOCK_KEY);
    }
  } catch {
    // storage.session unavailable — the in-memory flag still applies.
  }
}

/**
 * Whether a transfer import currently holds the lock, according to the stored
 * record. Ignores a record older than TRANSFER_LOCK_MAX_AGE_MS so a crashed
 * importer cannot wedge synchronization permanently.
 *
 * Reads as "not held" on any failure: the listeners' normal behavior is the
 * safe default, since the importer's own writes are authoritative anyway.
 */
export async function isTransferLockRecordHeld(): Promise<boolean> {
  try {
    const stored = await chrome.storage.session.get(TRANSFER_LOCK_KEY);
    const record = stored[TRANSFER_LOCK_KEY];
    if (!isRecord(record)) {
      return false;
    }
    return Date.now() - record.takenAt < TRANSFER_LOCK_MAX_AGE_MS;
  } catch {
    return false;
  }
}
