const DB_NAME = "bookmark-desktop";
const DB_VERSION = 1;
const ICON_STORE = "icons";

interface StoredIcon {
  bytes: ArrayBuffer;
  type: string;
}

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

export async function deleteIcon(itemId: string): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(ICON_STORE, "readwrite");
    tx.objectStore(ICON_STORE).delete(itemId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
