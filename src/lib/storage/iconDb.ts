const DB_NAME = "bookmark-desktop";
const DB_VERSION = 1;
const ICON_STORE = "icons";

interface StoredIcon {
  bytes: ArrayBuffer;
  type: string;
}

/**
 * Icon keys that belong to the extension rather than to a bookmark/folder id.
 * Defined here — rather than in the modules that own each image — because
 * pruneIconsExcept must know them and those modules already depend on this one;
 * a second copy of the literals could drift, and a drifted reserved key means
 * the prune deletes a live global image. They re-export these.
 */
export const DEFAULT_FOLDER_ICON_KEY = "__default_folder_icon__";
export const CANVAS_BACKGROUND_KEY = "__canvas_background__";

const RESERVED_ICON_KEYS: readonly string[] = [
  DEFAULT_FOLDER_ICON_KEY,
  CANVAS_BACKGROUND_KEY,
];

let dbPromise: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ICON_STORE)) {
        db.createObjectStore(ICON_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

/**
 * Stores an icon's raw bytes for a bookmark or folder id. Stored as an
 * ArrayBuffer + MIME type rather than a Blob directly, since
 * structured-clone support for Blob is inconsistent across IndexedDB
 * implementations; getIcon reconstructs the Blob on read. Upload
 * validation (format/size) happens above this layer, in lib/icons.
 */
export async function putIcon(itemId: string, blob: Blob): Promise<void> {
  const record: StoredIcon = {
    bytes: await blob.arrayBuffer(),
    type: blob.type,
  };
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(ICON_STORE, "readwrite");
    tx.objectStore(ICON_STORE).put(record, itemId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getIcon(itemId: string): Promise<Blob | undefined> {
  const db = await openDatabase();
  const record = await new Promise<StoredIcon | undefined>(
    (resolve, reject) => {
      const tx = db.transaction(ICON_STORE, "readonly");
      const request = tx.objectStore(ICON_STORE).get(itemId);
      request.onsuccess = () =>
        resolve(request.result as StoredIcon | undefined);
      request.onerror = () => reject(request.error);
    },
  );
  return record ? new Blob([record.bytes], { type: record.type }) : undefined;
}

/**
 * Deletes every icon record whose key is not in `keep`, in a single readwrite
 * transaction so no concurrent putIcon can be lost to a read-then-write window.
 * The reserved global keys are exempt unconditionally — callers pass the set of
 * live bookmark/folder ids and must not have to remember the globals.
 *
 * Used by the state-transfer import: the replace-import runs under a lock that
 * suspends the per-item removal cleanup, so the importer prunes to the set of
 * ids it created rather than leaving the replaced tree's blobs orphaned (they
 * are up to 1 MB each and no UI can reach them again).
 */
export async function pruneIconsExcept(
  keep: ReadonlySet<string>,
): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(ICON_STORE, "readwrite");
    const store = tx.objectStore(ICON_STORE);
    const request = store.getAllKeys();
    request.onsuccess = () => {
      for (const key of request.result) {
        const id = String(key);
        if (keep.has(id) || RESERVED_ICON_KEYS.includes(id)) {
          continue;
        }
        store.delete(key);
      }
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteIcon(itemId: string): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(ICON_STORE, "readwrite");
    tx.objectStore(ICON_STORE).delete(itemId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
