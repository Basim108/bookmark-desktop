const DB_NAME = "bookmark-desktop";
const DB_VERSION = 1;
const ICON_STORE = "icons";

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

/** Stores raw icon bytes for a bookmark or folder id. Upload validation (format/size) happens in Group 7, above this layer. */
export async function putIcon(itemId: string, blob: Blob): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(ICON_STORE, "readwrite");
    tx.objectStore(ICON_STORE).put(blob, itemId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getIcon(itemId: string): Promise<Blob | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ICON_STORE, "readonly");
    const request = tx.objectStore(ICON_STORE).get(itemId);
    request.onsuccess = () => resolve(request.result as Blob | undefined);
    request.onerror = () => reject(request.error);
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
